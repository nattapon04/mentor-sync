package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/nattapon/mentorsync/models"
)

// callerClaims extracts the authenticated caller's JWT claims from c.Locals, set by the JWT
// auth middleware. Returns ok=false if the caller is unauthenticated or the token is malformed.
func callerClaims(c *fiber.Ctx) (jwt.MapClaims, bool) {
	token, ok := c.Locals("user").(*jwt.Token)
	if !ok {
		return nil, false
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	return claims, ok
}

// claimsHaveAdminRole reports whether claims' "roles" array contains the admin role.
func claimsHaveAdminRole(claims jwt.MapClaims) bool {
	roles, _ := claims["roles"].([]any)
	for _, r := range roles {
		if roleStr, ok := r.(string); ok && roleStr == string(models.RoleAdmin) {
			return true
		}
	}
	return false
}

// callerID returns the authenticated caller's user id from the JWT claims, or "" if the token
// is missing or malformed.
func callerID(c *fiber.Ctx) string {
	claims, ok := callerClaims(c)
	if !ok {
		return ""
	}
	id, _ := claims["id"].(string)
	return id
}

// callerIsAdmin reports whether the authenticated caller holds the admin role.
func callerIsAdmin(c *fiber.Ctx) bool {
	claims, ok := callerClaims(c)
	if !ok {
		return false
	}
	return claimsHaveAdminRole(claims)
}

// callerIsSelfOrAdmin reports whether the authenticated caller is either the given user id or
// holds the admin role. A role check alone (middleware.RequireRole) only knows the caller's
// role, not which specific resource they're trying to act on — this is the ownership check that
// role-gating can't express, e.g. so one mentor can't manage another mentor's mentees.
func callerIsSelfOrAdmin(c *fiber.Ctx, targetUserID string) bool {
	claims, ok := callerClaims(c)
	if !ok {
		return false
	}
	if id, _ := claims["id"].(string); id != "" && id == targetUserID {
		return true
	}
	return claimsHaveAdminRole(claims)
}
