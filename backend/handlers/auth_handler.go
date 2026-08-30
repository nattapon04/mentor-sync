package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/nattapon/mentorsync/models"
	"golang.org/x/crypto/bcrypt"
)

func (h *Handlers) Login(c *fiber.Ctx) error {
	type LoginInput struct {
		Email    string `json:"email" validate:"required,email"`
		Password string `json:"password" validate:"required"`
	}
	var input LoginInput
	if !bindAndValidate(c, &input) {
		return nil
	}

	var user models.User
	if err := h.DB.Where("email = ?", input.Email).First(&user).Error; err != nil {
		return respondError(c, fiber.StatusUnauthorized, "Invalid email or password")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		return respondError(c, fiber.StatusUnauthorized, "Invalid email or password")
	}

	// Create JWT token. "tv" (token version) is checked on every request by
	// middleware.RequireCurrentSession so an admin action can revoke this token before it
	// naturally expires.
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"id":    user.ID,
		"roles": user.Roles,
		"tv":    user.TokenVersion,
		"exp":   time.Now().Add(time.Hour * 72).Unix(),
	})

	t, err := token.SignedString([]byte(h.JWTSecret))
	if err != nil {
		return respondError(c, fiber.StatusInternalServerError, "Could not login")
	}

	return c.JSON(fiber.Map{
		"token": t,
		"user": fiber.Map{
			"id":    user.ID,
			"name":  user.Name,
			"email": user.Email,
			"roles": user.Roles,
		},
	})
}
