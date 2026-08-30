package handlers_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/nattapon/mentorsync/models"
)

func TestSLARuleCRUD(t *testing.T) {
	h := newTestHandlers(t)

	app := fiber.New()
	app.Post("/sla-rules", h.CreateSLARule)
	app.Put("/sla-rules/:id", h.UpdateSLARule)
	app.Delete("/sla-rules/:id", h.DeleteSLARule)

	t.Run("create rejects missing required fields", func(t *testing.T) {
		resp := doJSON(t, app, "POST", "/sla-rules", map[string]string{})
		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", resp.StatusCode)
		}
	})

	var created models.SLARule
	t.Run("create succeeds with valid input", func(t *testing.T) {
		resp := doJSON(t, app, "POST", "/sla-rules", map[string]string{
			"name":         "Test Rule",
			"metric_type":  "quality",
			"eval_type":    "ticket",
			"target_value": "100%",
			"scope":        "Engineering",
		})
		if resp.StatusCode != http.StatusCreated {
			t.Fatalf("expected 201, got %d", resp.StatusCode)
		}
		if err := json.NewDecoder(resp.Body).Decode(&created); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if !created.IsActive {
			t.Fatalf("expected a newly created rule to be active")
		}
	})

	t.Run("update cannot smuggle id or is_active (mass-assignment)", func(t *testing.T) {
		spoofedID := uuid.New()
		resp := doJSON(t, app, "PUT", "/sla-rules/"+created.ID.String(), map[string]any{
			"name":         "Test Rule (edited)",
			"metric_type":  "quality",
			"eval_type":    "ticket",
			"target_value": "90%",
			"scope":        "Engineering",
			"is_active":    false,
			"id":           spoofedID.String(),
		})
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("expected 200, got %d", resp.StatusCode)
		}

		var updated models.SLARule
		if err := json.NewDecoder(resp.Body).Decode(&updated); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if updated.ID != created.ID {
			t.Fatalf("id must not be overwritable via request body: got %s want %s", updated.ID, created.ID)
		}
		if !updated.IsActive {
			t.Fatalf("is_active must not be overwritable via request body")
		}
		if updated.Name != "Test Rule (edited)" {
			t.Fatalf("expected the legitimate field to update, got %q", updated.Name)
		}
	})

	t.Run("delete removes the rule", func(t *testing.T) {
		resp := doJSON(t, app, "DELETE", "/sla-rules/"+created.ID.String(), nil)
		if resp.StatusCode != http.StatusNoContent {
			t.Fatalf("expected 204, got %d", resp.StatusCode)
		}
	})
}
