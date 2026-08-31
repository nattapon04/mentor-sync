package migrations

import (
	"github.com/google/uuid"
	"github.com/nattapon/mentorsync/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// seedUserIfMissing creates a user by email if no row with that email exists yet — including
// soft-deleted ones (Unscoped), so a demo account someone intentionally deleted doesn't get
// silently resurrected, and so we don't violate the unique index on email trying to insert a
// duplicate of a soft-deleted row.
func seedUserIfMissing(tx *gorm.DB, email, name, department string, roles []models.Role) error {
	var count int64
	if err := tx.Unscoped().Model(&models.User{}).Where("email = ?", email).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	hash, err := bcrypt.GenerateFromPassword([]byte("password"), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	return tx.Create(&models.User{
		Email:        email,
		PasswordHash: string(hash),
		Name:         name,
		Roles:        roles,
		Department:   department,
	}).Error
}

// seedSLARuleIfMissing creates an SLA rule identified by (name, scope) if it doesn't already
// exist. This is the mechanism that lets us append new default SLA rules in a later migration
// without touching or re-inserting the ones seeded by an earlier migration.
func seedSLARuleIfMissing(tx *gorm.DB, rule models.SLARule) error {
	var count int64
	if err := tx.Model(&models.SLARule{}).
		Where("name = ? AND scope = ?", rule.Name, rule.Scope).
		Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	rule.IsActive = true
	return tx.Create(&rule).Error
}

// engineeringSLARulesV1 are the SLA rules originally shipped with the app.
func engineeringSLARulesV1() []models.SLARule {
	return []models.SLARule{
		{Name: "การตรวจสอบด้วยตัวเอง (Self-Verification)", MetricType: models.MetricTypeQuality, EvalType: models.EvalTypeTicket, TargetValue: "100%", Scope: "Engineering"},
		{Name: "จำนวนรอบการแก้โค้ดที่รีวิว (Code Review Rework)", MetricType: models.MetricTypeQuality, EvalType: models.EvalTypeTicket, TargetValue: "<= 2 รอบ/PR", Scope: "Engineering"},
		{Name: "บั๊กที่หลุดไปโปรดักชัน (Production Escape Bugs)", MetricType: models.MetricTypeQuality, EvalType: models.EvalTypeTicket, TargetValue: "0 Bugs", Scope: "Engineering"},
		{Name: "ระยะเวลาทำทิกเก็ต (Ticket Cycle Time)", MetricType: models.MetricTypeVelocity, EvalType: models.EvalTypeTicket, TargetValue: "<= 3 วัน", Scope: "Engineering"},
		{Name: "ความสำเร็จตามสปริ้นท์ (Sprint Commitment)", MetricType: models.MetricTypeVelocity, EvalType: models.EvalTypeSprint, TargetValue: ">= 85%", Scope: "Engineering"},
		{Name: "การคิดเชิงวิพากษ์ (Critical Thinking)", MetricType: models.MetricTypeSoftSkill, EvalType: models.EvalTypeBoth, TargetValue: ">= 4/5", Scope: "Engineering"},
		{Name: "การซัพพอร์ตและตรวจสอบ (Support & Investigate)", MetricType: models.MetricTypeSoftSkill, EvalType: models.EvalTypeBoth, TargetValue: ">= 4/5", Scope: "Engineering"},
		{Name: "การรีวิวโค้ดให้เพื่อน (Peer Code Reviews)", MetricType: models.MetricTypeSoftSkill, EvalType: models.EvalTypeSprint, TargetValue: ">= 5 PRs/Sprint", Scope: "Engineering"},
	}
}

// engineeringSLARulesV2 are the ticket/sprint metrics added on top of engineeringSLARulesV1.
// See docs/SLA_METRICS.md for what each one measures and how to score it.
func engineeringSLARulesV2() []models.SLARule {
	return []models.SLARule{
		{Name: "อัตราผ่านโดยไม่ต้องแก้ไขซ้ำ (First-Time-Right Rate)", MetricType: models.MetricTypeQuality, EvalType: models.EvalTypeTicket, TargetValue: "0 Reopens", Scope: "Engineering"},
		{Name: "ระยะเวลาตอบสนองงานแรก (Time-to-First-Response)", MetricType: models.MetricTypeVelocity, EvalType: models.EvalTypeTicket, TargetValue: "<= 4 ชม. (เวลาทำงาน)", Scope: "Engineering"},
		{Name: "ความครบถ้วนของเอกสารประกอบงาน (Documentation Completeness)", MetricType: models.MetricTypeQuality, EvalType: models.EvalTypeTicket, TargetValue: "100%", Scope: "Engineering"},
		{Name: "ความแม่นยำของการประเมิน Story Point (Estimation Accuracy)", MetricType: models.MetricTypeVelocity, EvalType: models.EvalTypeSprint, TargetValue: "<= 20% ส่วนต่าง", Scope: "Engineering"},
		{Name: "การแบ่งปันความรู้ในทีม (Knowledge Sharing)", MetricType: models.MetricTypeSoftSkill, EvalType: models.EvalTypeSprint, TargetValue: ">= 1 ครั้ง/สปริ้นท์", Scope: "Engineering"},
		{Name: "การเข้าร่วมกิจกรรม Scrum (Standup/Ceremony Participation)", MetricType: models.MetricTypeSoftSkill, EvalType: models.EvalTypeSprint, TargetValue: ">= 90% เข้าร่วม", Scope: "Engineering"},
	}
}

// backfillSLARuleTargetNumerics sets TargetOperator/TargetNumeric on the default rules seeded
// by engineeringSLARulesV1/V2 above, parsed from the same targets documented in
// docs/SLA_METRICS.md. Only fills rows where target_operator is still unset, so it never
// overwrites a value an admin has since edited through the SLA Config UI.
func backfillSLARuleTargetNumerics(tx *gorm.DB) error {
	type target struct {
		name     string
		operator string
		numeric  float64
	}
	targets := []target{
		{"การตรวจสอบด้วยตัวเอง (Self-Verification)", ">=", 100},
		{"จำนวนรอบการแก้โค้ดที่รีวิว (Code Review Rework)", "<=", 2},
		{"บั๊กที่หลุดไปโปรดักชัน (Production Escape Bugs)", "<=", 0},
		{"ระยะเวลาทำทิกเก็ต (Ticket Cycle Time)", "<=", 3},
		{"ความสำเร็จตามสปริ้นท์ (Sprint Commitment)", ">=", 85},
		{"การคิดเชิงวิพากษ์ (Critical Thinking)", ">=", 4},
		{"การซัพพอร์ตและตรวจสอบ (Support & Investigate)", ">=", 4},
		{"การรีวิวโค้ดให้เพื่อน (Peer Code Reviews)", ">=", 5},
		{"อัตราผ่านโดยไม่ต้องแก้ไขซ้ำ (First-Time-Right Rate)", "<=", 0},
		{"ระยะเวลาตอบสนองงานแรก (Time-to-First-Response)", "<=", 4},
		{"ความครบถ้วนของเอกสารประกอบงาน (Documentation Completeness)", ">=", 100},
		{"ความแม่นยำของการประเมิน Story Point (Estimation Accuracy)", "<=", 20},
		{"การแบ่งปันความรู้ในทีม (Knowledge Sharing)", ">=", 1},
		{"การเข้าร่วมกิจกรรม Scrum (Standup/Ceremony Participation)", ">=", 90},
	}

	for _, t := range targets {
		if err := tx.Model(&models.SLARule{}).
			Where("name = ? AND scope = ? AND target_operator IS NULL", t.name, "Engineering").
			Updates(map[string]any{"target_operator": t.operator, "target_numeric": t.numeric}).Error; err != nil {
			return err
		}
	}
	return nil
}

// seedDemoBadges awards a starter set of badges to the demo mentee, for local/demo environments.
// No-ops if the demo users aren't present (e.g. deleted from a shared/demo DB, or a production
// DB where seedDefaultUsers was skipped). Uses Find (not First) so an absent row is a normal
// empty result, not a logged error.
func seedDemoBadges(tx *gorm.DB) error {
	var mentee models.User
	if err := tx.Where("email = ?", "mentee@mentorsync.com").Find(&mentee).Error; err != nil {
		return err
	}
	if mentee.ID == uuid.Nil {
		return nil
	}
	var mentor models.User
	if err := tx.Where("email = ?", "mentor@mentorsync.com").Find(&mentor).Error; err != nil {
		return err
	}
	if mentor.ID == uuid.Nil {
		return nil
	}

	var count int64
	if err := tx.Model(&models.EarnedBadge{}).Where("mentee_id = ?", mentee.ID).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	badges := []models.EarnedBadge{
		{MenteeID: mentee.ID, AwardedByID: &mentor.ID, BadgeType: "zero_defect"},
		{MenteeID: mentee.ID, AwardedByID: &mentor.ID, BadgeType: "one_shot"},
		{MenteeID: mentee.ID, AwardedByID: &mentor.ID, BadgeType: "qa_friend"},
		{MenteeID: mentee.ID, AwardedByID: &mentor.ID, BadgeType: "sprint_master"},
	}
	return tx.Create(&badges).Error
}
