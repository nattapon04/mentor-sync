// Package routes wires every HTTP route onto a Fiber app, grouped by domain with role guards
// applied where docs/BA_REQUIREMENTS.md restricts an action to specific roles.
package routes

import (
	jwtware "github.com/gofiber/contrib/jwt"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/nattapon/mentorsync/handlers"
	"github.com/nattapon/mentorsync/middleware"
	"github.com/nattapon/mentorsync/models"
)

// Register mounts all routes on app using h for handler dependencies (DB, JWT secret).
func Register(app *fiber.App, h *handlers.Handlers) {
	app.Use(logger.New())
	app.Use(cors.New())

	adminOnly := middleware.RequireRole(string(models.RoleAdmin))
	mentorOrAdmin := middleware.RequireRole(string(models.RoleMentor), string(models.RoleAdmin))

	api := app.Group("/api")

	// Health check
	api.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "success", "message": "MentorSync API is running!"})
	})

	// Auth Routes (unprotected)
	api.Post("/auth/login", h.Login)

	// Everything below requires a valid JWT whose token version still matches the current DB
	// row — the latter is what lets a role change or profile edit revoke an already-issued
	// token immediately instead of waiting out its full expiry window.
	api.Use(jwtware.New(jwtware.Config{
		SigningKey: jwtware.SigningKey{Key: []byte(h.JWTSecret)},
	}))
	api.Use(middleware.RequireCurrentSession(h.DB))

	// User Routes — read access is shared (mentor dashboards list all users too); mutations
	// and role/department changes are admin-only.
	api.Get("/users", h.GetUsers)
	api.Get("/users/:id", h.GetUser)
	api.Post("/users", adminOnly, h.CreateUser)
	api.Put("/users/:id", adminOnly, h.UpdateUser)
	api.Delete("/users/:id", adminOnly, h.DeleteUser)
	api.Post("/users/:mentorId/assign-mentee", mentorOrAdmin, h.AssignMentee)
	api.Post("/users/:mentorId/unassign-mentee", mentorOrAdmin, h.UnassignMentee)
	api.Put("/users/:id/preferences", h.UpdatePreferences)

	// SLA Rules — mentors configure SLAs per docs/BA_REQUIREMENTS.md; reads stay open (the
	// evaluation form needs them regardless of the caller's role).
	api.Get("/sla-rules", h.GetSLARules)
	api.Post("/sla-rules", mentorOrAdmin, h.CreateSLARule)
	api.Put("/sla-rules/:id", mentorOrAdmin, h.UpdateSLARule)
	api.Delete("/sla-rules/:id", mentorOrAdmin, h.DeleteSLARule)

	// Departments
	api.Get("/departments", h.GetDepartments)

	// Evaluations — mentors create/delete; mentees need to read their own history.
	api.Get("/evaluations", h.GetEvaluations)
	api.Post("/evaluations", mentorOrAdmin, h.CreateEvaluation)
	api.Delete("/evaluations/:id", mentorOrAdmin, h.DeleteEvaluation)

	// Badges — mentors award/revoke; mentees need to read their own badges.
	api.Get("/badges", h.GetEarnedBadges)
	api.Post("/badges", mentorOrAdmin, h.AwardBadge)
	api.Delete("/badges/:id", mentorOrAdmin, h.DeleteBadge)

	// Notes — mentors write/edit/delete; mentees need to read notes about them.
	api.Get("/notes", h.GetNotes)
	api.Post("/notes", mentorOrAdmin, h.CreateNote)
	api.Put("/notes/:id", mentorOrAdmin, h.UpdateNote)
	api.Delete("/notes/:id", mentorOrAdmin, h.DeleteNote)

	// Reports — team-wide rollups are a mentor/admin view.
	api.Get("/reports/team", mentorOrAdmin, h.GetTeamReports)
}
