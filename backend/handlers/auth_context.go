package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/nattapon/mentorsync/models"
)

// callerIsSelfOrAdmin reports whether the authenticated caller is either the given user id or
// holds the admin role. A role check alone (middleware.RequireRole) only knows the caller's
// role, not which specific resource they're trying to act on — this is the ownership check that
// role-gating can't express, e.g. so one mentor can't manage another mentor's mentees.
func callerIsSelfOrAdmin(c *fiber.Ctx, targetUserID string) bool {
	token, ok := c.Locals("user").(*jwt.Token)
	if !ok {
		return false
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return false
	}

	if idStr, _ := claims["id"].(string); idStr != "" && idStr == targetUserID {
		return true
	}

	roles, _ := claims["roles"].([]any)
	for _, r := range roles {
		if roleStr, ok := r.(string); ok && roleStr == string(models.RoleAdmin) {
			return true
		}
	}
	return false
}
