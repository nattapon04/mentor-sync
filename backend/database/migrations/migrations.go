// Package migrations manages the database schema and seed data as an ordered,
// versioned list of steps instead of GORM's blanket AutoMigrate.
//
// Rules for adding to this file:
//  1. Never edit an existing migration once it has shipped (i.e. once it might have run
//     against any real database, including a teammate's local one). Add a new migration
//     with a new ID instead — that's what lets us extend the schema/seed data without
//     deleting or rewriting what's already there.
//  2. IDs are sortable timestamps ("YYYYMMDDHHmm_description") so migrations always run in
//     the order they were authored.
//  3. Prefer raw SQL / gorm.Migrator() calls for schema changes over tx.AutoMigrate(&models.X{}):
//     AutoMigrate reflects the *current* struct, so a migration that calls it will silently
//     change behavior if the struct gains fields later. The one exception is the initial
//     baseline migration, which is allowed to reflect "current" because it defines day one.
package migrations

import (
	"log/slog"

	"github.com/go-gormigrate/gormigrate/v2"
	"github.com/nattapon/mentorsync/models"
	"gorm.io/gorm"
)

func all() []*gormigrate.Migration {
	return []*gormigrate.Migration{
		{
			ID: "202608300001_init_schema",
			Migrate: func(tx *gorm.DB) error {
				return tx.AutoMigrate(
					&models.User{},
					&models.SLARule{},
					&models.JiraEvaluation{},
					&models.EvaluationMetric{},
					&models.GeneralNote{},
					&models.EarnedBadge{},
				)
			},
		},
		{
			ID: "202608300002_seed_default_users",
			Migrate: func(tx *gorm.DB) error {
				if err := seedUserIfMissing(tx, "admin@mentorsync.com", "Super Admin", "IT", []models.Role{models.RoleAdmin}); err != nil {
					return err
				}
				if err := seedUserIfMissing(tx, "mentor@mentorsync.com", "Jane (Mentor & Mentee)", "Engineering", []models.Role{models.RoleMentor, models.RoleMentee}); err != nil {
					return err
				}
				return seedUserIfMissing(tx, "mentee@mentorsync.com", "Alex (Mentee)", "Engineering", []models.Role{models.RoleMentee})
			},
		},
		{
			ID: "202608300003_seed_engineering_sla_rules_v1",
			Migrate: func(tx *gorm.DB) error {
				for _, rule := range engineeringSLARulesV1() {
					if err := seedSLARuleIfMissing(tx, rule); err != nil {
						return err
					}
				}
				return nil
			},
		},
		{
			ID: "202608300004_seed_demo_badges",
			Migrate: func(tx *gorm.DB) error {
				return seedDemoBadges(tx)
			},
		},
		{
			// Adds ticket/sprint-scoped SLA metrics on top of engineeringSLARulesV1 without
			// touching it — the pattern to follow for every future SLA rule addition too.
			ID: "202608300005_seed_engineering_sla_rules_v2",
			Migrate: func(tx *gorm.DB) error {
				for _, rule := range engineeringSLARulesV2() {
					if err := seedSLARuleIfMissing(tx, rule); err != nil {
						return err
					}
				}
				return nil
			},
		},
		{
			// The baseline unique index on users.email didn't exclude soft-deleted rows, so
			// re-inviting/re-creating a user with a previously-deleted account's email always
			// failed. models.User now declares a partial unique index (active rows only); this
			// migration transitions any database that already applied 0001 with the old index.
			// Uses raw SQL rather than AutoMigrate(&models.User{}) so this step's behavior stays
			// frozen even as the User struct gains fields later (see the package rule above).
			ID: "202608300006_partial_unique_index_users_email",
			Migrate: func(tx *gorm.DB) error {
				if err := tx.Exec(`DROP INDEX IF EXISTS idx_users_email`).Error; err != nil {
					return err
				}
				return tx.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_active ON users (email) WHERE deleted_at IS NULL`).Error
			},
		},
		{
			// Lets an admin action (role change, profile edit) invalidate a user's already-issued
			// JWTs immediately instead of waiting out the token's full expiry window — see
			// User.TokenVersion and middleware.RequireCurrentSession.
			ID: "202608310001_add_users_token_version",
			Migrate: func(tx *gorm.DB) error {
				return tx.Exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version bigint NOT NULL DEFAULT 0`).Error
			},
		},
		{
			// Adds an optional structured (operator, numeric) form of SLARule.TargetValue, so
			// Focus Areas (frontend gap analysis) can compute an actual numeric gap-to-target
			// instead of only a pass/fail rate. Existing rules keep working unchanged — these
			// columns are nullable and TargetValue stays the source of truth for display.
			ID: "202608310002_add_sla_rules_target_operator_numeric",
			Migrate: func(tx *gorm.DB) error {
				if err := tx.Exec(`ALTER TABLE sla_rules ADD COLUMN IF NOT EXISTS target_operator varchar(2)`).Error; err != nil {
					return err
				}
				if err := tx.Exec(`ALTER TABLE sla_rules ADD COLUMN IF NOT EXISTS target_numeric double precision`).Error; err != nil {
					return err
				}
				return backfillSLARuleTargetNumerics(tx)
			},
		},
		{
			// seedUserIfMissing's password ("password") is documented in README.md as the
			// fresh/seeded-database default — fine for a local docker-compose db, but nothing
			// ever gated it to non-production use, so it shipped as a real, publicly-documented
			// login on any environment (including a hosted production deploy) that ran the
			// baseline migrations. Rotates the 3 demo accounts off that fixed password — see
			// rotateDemoUserPasswords for why a soft-deleted demo account is already unreachable
			// regardless.
			ID: "202608310003_rotate_demo_user_passwords",
			Migrate: func(tx *gorm.DB) error {
				return rotateDemoUserPasswords(tx)
			},
		},
	}
}

// Run applies any migrations that haven't run yet, tracked in the `migrations` table.
func Run(db *gorm.DB) error {
	m := gormigrate.New(db, gormigrate.DefaultOptions, all())
	if err := m.Migrate(); err != nil {
		return err
	}
	slog.Info("database migrations up to date")
	return nil
}
