package main

import (
	"log/slog"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/joho/godotenv"
	"github.com/nattapon/mentorsync/config"
	"github.com/nattapon/mentorsync/database"
	"github.com/nattapon/mentorsync/handlers"
	"github.com/nattapon/mentorsync/routes"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	// Load .env
	if err := godotenv.Load(); err != nil {
		slog.Warn("could not load .env file, relying on system env vars")
	}

	cfg := config.Load()

	// Connect to Database
	database.ConnectDB(cfg)

	// Schema/seed migrations run on boot by default. Set DB_AUTO_MIGRATE=false to disable
	// (e.g. multi-replica production deploys that run `go run ./cmd/migrate` as a separate
	// release step instead).
	if cfg.DBAutoMigrate {
		if err := database.Migrate(); err != nil {
			slog.Error("failed to run database migrations", "error", err)
			os.Exit(1)
		}
	}

	h := handlers.New(database.DB, cfg.JWTSecret)

	app := fiber.New()
	routes.Register(app, h)

	slog.Info("starting server", "port", cfg.Port)
	if err := app.Listen(":" + cfg.Port); err != nil {
		slog.Error("server stopped", "error", err)
		os.Exit(1)
	}
}
