// Command migrate applies pending database migrations and exits. Run it as a distinct
// deploy step (e.g. a Kubernetes Job/init container, or a CI/CD pipeline stage) before
// rolling out a new app version, instead of relying on the API server's DB_AUTO_MIGRATE
// convenience path — this avoids multiple server replicas racing to migrate at once.
package main

import (
	"log/slog"
	"os"

	"github.com/joho/godotenv"
	"github.com/nattapon/mentorsync/config"
	"github.com/nattapon/mentorsync/database"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	if err := godotenv.Load(); err != nil {
		slog.Warn("could not load .env file, relying on system env vars")
	}

	cfg := config.Load()
	database.ConnectDB(cfg)

	if err := database.Migrate(); err != nil {
		slog.Error("migration failed", "error", err)
		os.Exit(1)
	}

	slog.Info("migration complete")
}
