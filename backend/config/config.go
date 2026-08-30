// Package config centralizes environment-derived configuration so it's read (and validated)
// in one place instead of scattered os.Getenv calls across main.go and individual handlers.
package config

import (
	"log/slog"
	"os"
)

type Config struct {
	DBHost     string
	DBUser     string
	DBPassword string
	DBName     string
	DBPort     string

	JWTSecret string
	Port      string

	// DBAutoMigrate controls whether the API server runs pending migrations on boot. Set
	// DB_AUTO_MIGRATE=false for multi-replica production deploys that run `cmd/migrate` as a
	// separate release step instead, to avoid replicas racing to migrate concurrently.
	DBAutoMigrate bool
}

// Load reads and validates all required environment variables once at boot, failing fast
// with a clear error instead of letting a missing var surface later as a confusing DB/auth
// failure deep inside a request.
func Load() Config {
	return Config{
		DBHost:        mustGetenv("DB_HOST"),
		DBUser:        mustGetenv("DB_USER"),
		DBPassword:    mustGetenv("DB_PASSWORD"),
		DBName:        mustGetenv("DB_NAME"),
		DBPort:        mustGetenv("DB_PORT"),
		JWTSecret:     mustGetenv("JWT_SECRET"),
		Port:          getenvDefault("PORT", "8000"),
		DBAutoMigrate: getenvDefault("DB_AUTO_MIGRATE", "true") != "false",
	}
}

func mustGetenv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		slog.Error("required environment variable is not set", "key", key)
		os.Exit(1)
	}
	return v
}

func getenvDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
