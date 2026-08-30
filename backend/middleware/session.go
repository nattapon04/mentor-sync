package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/nattapon/mentorsync/models"
	"gorm.io/gorm"
)

// RequireCurrentSession invalidates a JWT whose "tv" (token version) claim no longer matches
// the user's current token_version in the database. Without this, an admin action that should
// revoke access (a role change, a demotion, a profile edit) has no effect until the token's
// full expiry window (72h) passes — see docs/PRODUCTION_READINESS_CHECKLIST.md. Must run after
// the JWT auth middleware, and before any role-gated route.
func RequireCurrentSession(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		token, ok := c.Locals("user").(*jwt.Token)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
		}
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
		}

		idStr, _ := claims["id"].(string)
		// JSON numbers decode into jwt.MapClaims as float64.
		claimedVersion, _ := claims["tv"].(float64)

		// Using models.User{} (not a plain struct via .Table()) so GORM's soft-delete scope
		// applies automatically — a soft-deleted user's token is rejected here too, for free.
		var user models.User
		if err := db.Select("token_version").Where("id = ?", idStr).Take(&user).Error; err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Session expired, please log in again"})
		}

		if int64(claimedVersion) != user.TokenVersion {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Session expired, please log in again"})
		}

		return c.Next()
	}
}
