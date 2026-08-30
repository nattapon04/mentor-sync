package database

import (
	"fmt"
	"log/slog"
	"os"

	"github.com/nattapon/mentorsync/config"
	"github.com/nattapon/mentorsync/database/migrations"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

// Connect opens a database connection for the given config with no side effects on package
// state — tests use this directly to get their own *gorm.DB without touching the production
// singleton. ConnectDB (below) is what application boot uses.
func Connect(cfg config.Config) (*gorm.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=%s",
		cfg.DBHost, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBPort, cfg.DBSSLMode,
	)
	return gorm.Open(postgres.Open(dsn), &gorm.Config{})
}

// ConnectDB connects and sets the package-level DB, exiting fatally on failure. For use at
// application boot only — tests and other callers that want to handle a connection failure
// themselves should call Connect directly.
func ConnectDB(cfg config.Config) {
	db, err := Connect(cfg)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}

	slog.Info("database connection opened")
	DB = db
}

// Migrate applies pending schema/seed migrations. See database/migrations for the ordered list.
func Migrate() error {
	return migrations.Run(DB)
}
