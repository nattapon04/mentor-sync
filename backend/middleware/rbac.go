// Package middleware holds Fiber middleware shared across route groups.
package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// RequireRole returns middleware that allows the request through only if the caller's JWT
// "roles" claim contains at least one of the given roles. It must run after the JWT auth
// middleware (jwtware.New), which stores the parsed token in c.Locals("user").
func RequireRole(roles ...string) fiber.Handler {
	allowed := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}

	return func(c *fiber.Ctx) error {
		token, ok := c.Locals("user").(*jwt.Token)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
		}
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
		}

		// "roles" was serialized from []models.Role ([]string) at login, so it comes back
		// out of the generic JSON-backed MapClaims as []interface{} of strings.
		userRoles, _ := claims["roles"].([]any)
		for _, r := range userRoles {
			roleStr, ok := r.(string)
			if !ok {
				continue
			}
			if _, found := allowed[roleStr]; found {
				return c.Next()
			}
		}

		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden: insufficient role"})
	}
}
