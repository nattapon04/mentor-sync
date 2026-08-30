package handlers

import "github.com/gofiber/fiber/v2"

// respondError writes a consistent {"error": msg} JSON body at the given status. Every handler
// should use this instead of hand-rolling c.Status(...).JSON(fiber.Map{"error": ...}) directly,
// so error responses have one shape and status codes are always named constants, not raw ints.
func respondError(c *fiber.Ctx, status int, msg string) error {
	return c.Status(status).JSON(fiber.Map{"error": msg})
}
