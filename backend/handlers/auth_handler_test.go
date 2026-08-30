package handlers_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/nattapon/mentorsync/models"
	"golang.org/x/crypto/bcrypt"
)

func TestLogin(t *testing.T) {
	h := newTestHandlers(t)

	hash, err := bcrypt.GenerateFromPassword([]byte("correct-password"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("failed to hash password: %v", err)
	}
	user := models.User{
		Email:        "login-test@example.com",
		PasswordHash: string(hash),
		Name:         "Login Test",
		Roles:        []models.Role{models.RoleMentee},
	}
	if err := h.DB.Create(&user).Error; err != nil {
		t.Fatalf("failed to seed test user: %v", err)
	}

	app := fiber.New()
	app.Post("/login", h.Login)

	t.Run("valid credentials returns a token", func(t *testing.T) {
		resp := doJSON(t, app, "POST", "/login", map[string]string{
			"email":    "login-test@example.com",
			"password": "correct-password",
		})
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("expected 200, got %d", resp.StatusCode)
		}

		var body map[string]any
		if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if token, _ := body["token"].(string); token == "" {
			t.Fatalf("expected a non-empty token in response, got %v", body)
		}
	})

	t.Run("wrong password is rejected", func(t *testing.T) {
		resp := doJSON(t, app, "POST", "/login", map[string]string{
			"email":    "login-test@example.com",
			"password": "wrong-password",
		})
		if resp.StatusCode != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d", resp.StatusCode)
		}
	})

	t.Run("missing password fails validation before touching the DB", func(t *testing.T) {
		resp := doJSON(t, app, "POST", "/login", map[string]string{
			"email": "login-test@example.com",
		})
		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", resp.StatusCode)
		}
	})
}
