package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/nattapon/mentorsync/config"
	"github.com/nattapon/mentorsync/database"
	"github.com/nattapon/mentorsync/handlers"
	"gorm.io/gorm"
)

// newTestHandlers opens a transaction against the local dev Postgres (see docker-compose.yml /
// backend/.env) and rolls it back via t.Cleanup, so tests exercise real Postgres-specific
// behavior (uuid generation, JSONB roles, the partial unique index on users.email) without
// leaving data behind. Skips if no local Postgres is reachable, e.g. `docker compose up -d db`
// hasn't been run.
func newTestHandlers(t *testing.T) *handlers.Handlers {
	t.Helper()

	db := testDB(t)
	tx := db.Begin()
	t.Cleanup(func() { tx.Rollback() })

	return handlers.New(tx, "test-secret")
}

func testDB(t *testing.T) *gorm.DB {
	t.Helper()

	cfg := config.Config{
		DBHost:     envDefault("TEST_DB_HOST", "localhost"),
		DBUser:     envDefault("TEST_DB_USER", "postgres"),
		DBPassword: envDefault("TEST_DB_PASSWORD", "password"),
		DBName:     envDefault("TEST_DB_NAME", "mentorsync"),
		DBPort:     envDefault("TEST_DB_PORT", "5432"),
	}

	db, err := database.Connect(cfg)
	if err != nil {
		t.Skipf("skipping: local postgres not reachable (%v) — run `docker compose up -d db`", err)
	}
	return db
}

func envDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// doJSON sends a JSON request to app via Fiber's in-process test transport (no real network
// socket involved). Pass nil for body to send an empty body (e.g. for DELETE).
func doJSON(t *testing.T, app *fiber.App, method, path string, body any) *http.Response {
	t.Helper()

	var reader *bytes.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("failed to marshal request body: %v", err)
		}
		reader = bytes.NewReader(b)
	} else {
		reader = bytes.NewReader(nil)
	}

	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	return resp
}
