package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/nattapon/mentorsync/models"
	"golang.org/x/crypto/bcrypt"
)

// GetUsers returns every user (not filtered by the caller's role or department) — pagination
// via ?page=&limit=, free-text search via ?search=.
func (h *Handlers) GetUsers(c *fiber.Ctx) error {
	var users []models.User
	query := h.DB.Preload("Manager")

	// Search
	if search := c.Query("search"); search != "" {
		query = query.Where("name ILIKE ? OR email ILIKE ?", "%"+search+"%", "%"+search+"%")
	}

	// Pagination
	page := c.QueryInt("page", 0)
	limit := c.QueryInt("limit", 0)
	
	if page > 0 && limit > 0 {
		var total int64
		query.Model(&models.User{}).Count(&total)
		
		offset := (page - 1) * limit
		if err := query.Offset(offset).Limit(limit).Order("created_at desc").Find(&users).Error; err != nil {
			return respondError(c, fiber.StatusInternalServerError, err.Error())
		}
		
		return c.JSON(fiber.Map{
			"data": users,
			"total": total,
			"page": page,
			"limit": limit,
			"total_pages": (int(total) + limit - 1) / limit,
		})
	}

	if err := query.Order("created_at desc").Find(&users).Error; err != nil {
		return respondError(c, fiber.StatusInternalServerError, err.Error())
	}
	
	return c.JSON(users)
}

func (h *Handlers) GetUser(c *fiber.Ctx) error {
	id := c.Params("id")
	var user models.User
	if err := h.DB.First(&user, "id = ?", id).Error; err != nil {
		return respondError(c, fiber.StatusNotFound, "User not found")
	}
	return c.JSON(user)
}

// Create User (Admin creates anyone)
func (h *Handlers) CreateUser(c *fiber.Ctx) error {
	type CreateInput struct {
		Name         string        `json:"name" validate:"required"`
		Email        string        `json:"email" validate:"required,email"`
		PasswordHash string        `json:"passwordHash" validate:"required,min=8"`
		Roles        []models.Role `json:"roles" validate:"required,min=1,dive,oneof=admin mentor mentee"`
		Department   string        `json:"department"`
	}
	var input CreateInput
	if !bindAndValidate(c, &input) {
		return nil
	}

	user := models.User{
		Name:       input.Name,
		Email:      input.Email,
		Roles:      input.Roles,
		Department: input.Department,
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.PasswordHash), bcrypt.DefaultCost)
	if err != nil {
		return respondError(c, fiber.StatusInternalServerError, "Failed to hash password")
	}
	user.PasswordHash = string(hashedPassword)

	if err := h.DB.Create(&user).Error; err != nil {
		if strings.Contains(err.Error(), "SQLSTATE 23505") {
			return respondError(c, fiber.StatusConflict, "Email already exists")
		}
		return respondError(c, fiber.StatusInternalServerError, "Failed to create user")
	}
	return c.Status(fiber.StatusCreated).JSON(user)
}

// Update User
func (h *Handlers) UpdateUser(c *fiber.Ctx) error {
	id := c.Params("id")
	type UpdateInput struct {
		Name         string        `json:"name" validate:"required"`
		Email        string        `json:"email" validate:"required,email"`
		PasswordHash string        `json:"passwordHash" validate:"omitempty,min=8"`
		Roles        []models.Role `json:"roles" validate:"required,min=1,dive,oneof=admin mentor mentee"`
		Department   string        `json:"department"`
	}
	var input UpdateInput
	if !bindAndValidate(c, &input) {
		return nil
	}

	var user models.User
	if err := h.DB.First(&user, "id = ?", id).Error; err != nil {
		return respondError(c, fiber.StatusNotFound, "User not found")
	}

	// Update fields
	user.Name = input.Name
	user.Email = input.Email
	user.Roles = input.Roles
	user.Department = input.Department
	// A profile/role edit should revoke any JWT already issued to this user, instead of
	// leaving their old role/details valid until that token's 72h expiry — see
	// middleware.RequireCurrentSession.
	user.TokenVersion++

	// Optionally update password if provided
	if input.PasswordHash != "" {
		hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(input.PasswordHash), bcrypt.DefaultCost)
		user.PasswordHash = string(hashedPassword)
	}

	if err := h.DB.Save(&user).Error; err != nil {
		if strings.Contains(err.Error(), "SQLSTATE 23505") {
			return respondError(c, fiber.StatusConflict, "Email already exists")
		}
		return respondError(c, fiber.StatusInternalServerError, "Failed to update user")
	}
	return c.JSON(user)
}

// Delete User
func (h *Handlers) DeleteUser(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := h.DB.Delete(&models.User{}, "id = ?", id).Error; err != nil {
		return respondError(c, fiber.StatusInternalServerError, "Failed to delete user")
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// Mentor Add Mentee
func (h *Handlers) AssignMentee(c *fiber.Ctx) error {
	mentorId := c.Params("mentorId")
	if _, err := uuid.Parse(mentorId); err != nil {
		return respondError(c, fiber.StatusBadRequest, "Invalid mentor ID")
	}
	// RequireRole only checked that the caller holds the mentor/admin role, not that mentorId
	// is *their own* ID — without this, any mentor could reassign any other mentor's mentees.
	if !callerIsSelfOrAdmin(c, mentorId) {
		return respondError(c, fiber.StatusForbidden, "You can only manage your own mentees")
	}

	type AssignInput struct {
		MenteeID string `json:"mentee_id" validate:"required,uuid"`
	}
	var input AssignInput
	if !bindAndValidate(c, &input) {
		return nil
	}

	var mentee models.User
	if err := h.DB.First(&mentee, "id = ?", input.MenteeID).Error; err != nil {
		return respondError(c, fiber.StatusNotFound, "Mentee not found")
	}

	if err := h.DB.Model(&mentee).Update("manager_id", mentorId).Error; err != nil {
		return respondError(c, fiber.StatusInternalServerError, "Failed to assign mentee")
	}
	return c.JSON(fiber.Map{"message": "Mentee assigned successfully"})
}

// Mentor Remove Mentee
func (h *Handlers) UnassignMentee(c *fiber.Ctx) error {
	mentorId := c.Params("mentorId")
	if _, err := uuid.Parse(mentorId); err != nil {
		return respondError(c, fiber.StatusBadRequest, "Invalid mentor ID")
	}
	if !callerIsSelfOrAdmin(c, mentorId) {
		return respondError(c, fiber.StatusForbidden, "You can only manage your own mentees")
	}

	type UnassignInput struct {
		MenteeID string `json:"mentee_id" validate:"required,uuid"`
	}
	var input UnassignInput
	if !bindAndValidate(c, &input) {
		return nil
	}

	var mentee models.User
	if err := h.DB.First(&mentee, "id = ?", input.MenteeID).Error; err != nil {
		return respondError(c, fiber.StatusNotFound, "Mentee not found")
	}

	// Verify mentor
	if mentee.ManagerID == nil || mentee.ManagerID.String() != mentorId {
		return respondError(c, fiber.StatusForbidden, "Mentee does not belong to this mentor")
	}

	if err := h.DB.Model(&mentee).Update("manager_id", nil).Error; err != nil {
		return respondError(c, fiber.StatusInternalServerError, "Failed to unassign mentee")
	}
	return c.JSON(fiber.Map{"message": "Mentee unassigned successfully"})
}

// Update UI Preferences
func (h *Handlers) UpdatePreferences(c *fiber.Ctx) error {
	id := c.Params("id")

	type PrefInput struct {
		Theme    string `json:"theme_preference"`
		Language string `json:"language_preference"`
	}
	var input PrefInput
	if !bindAndValidate(c, &input) {
		return nil
	}

	if err := h.DB.Model(&models.User{}).Where("id = ?", id).Updates(models.User{
		ThemePreference:    input.Theme,
		LanguagePreference: input.Language,
	}).Error; err != nil {
		return respondError(c, fiber.StatusInternalServerError, "Failed to update preferences")
	}

	return c.JSON(fiber.Map{"message": "Preferences updated"})
}
