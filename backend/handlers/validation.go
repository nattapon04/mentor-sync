package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/go-playground/validator/v10"
)

var validate = validator.New()

// bindAndValidate parses the request body into out, then validates it against out's
// `validate` struct tags. On failure it writes the error response itself and returns false —
// callers should just `return nil` in that case, since the response is already written.
func bindAndValidate(c *fiber.Ctx, out any) bool {
	if err := c.BodyParser(out); err != nil {
		_ = respondError(c, fiber.StatusBadRequest, "Invalid input")
		return false
	}
	if err := validate.Struct(out); err != nil {
		_ = respondError(c, fiber.StatusBadRequest, "Validation failed: "+err.Error())
		return false
	}
	return true
}
