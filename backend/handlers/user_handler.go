package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/nattapon/mentorsync/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// GetUsers returns every user (not filtered by the caller's role or department) — pagination
// via ?page=&limit=, free-text search via ?search=.
func (h *Handlers) GetUsers(c *fiber.Ctx) error {
	var users []models.User
	query := h.DB.Preload("Manager").Preload("Mentors")

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

// AssignMentee lets a mentor (or admin acting as that mentor) add a mentee to their roster.
// Inserts a row in the mentorships junction table; duplicate pairs are silently ignored.
func (h *Handlers) AssignMentee(c *fiber.Ctx) error {
	mentorId := c.Params("mentorId")
	mentorUUID, err := uuid.Parse(mentorId)
	if err != nil {
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

	menteeUUID, err := uuid.Parse(input.MenteeID)
	if err != nil {
		return respondError(c, fiber.StatusBadRequest, "Invalid mentee ID")
	}

	// Insert into the junction table; ON CONFLICT DO NOTHING makes this idempotent.
	if err := h.DB.Exec(
		`INSERT INTO mentorships (id, mentor_id, mentee_id, created_at)
		 VALUES (gen_random_uuid(), ?, ?, NOW())
		 ON CONFLICT (mentor_id, mentee_id) DO NOTHING`,
		mentorUUID, menteeUUID,
	).Error; err != nil {
		return respondError(c, fiber.StatusInternalServerError, "Failed to assign mentee")
	}
	return c.JSON(fiber.Map{"message": "Mentee assigned successfully"})
}

// UnassignMentee lets a mentor (or admin acting as that mentor) remove a mentee from their roster.
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

	result := h.DB.Where("mentor_id = ? AND mentee_id = ?", mentorId, input.MenteeID).
		Delete(&models.Mentorship{})
	if result.Error != nil {
		return respondError(c, fiber.StatusInternalServerError, "Failed to unassign mentee")
	}
	if result.RowsAffected == 0 {
		return respondError(c, fiber.StatusNotFound, "Mentorship not found")
	}
	return c.JSON(fiber.Map{"message": "Mentee unassigned successfully"})
}

// AdminAssignMentors lets an admin set the complete list of mentors for any mentee.
// This is a full replacement — mentors not in the new list are removed, new ones are added.
func (h *Handlers) AdminAssignMentors(c *fiber.Ctx) error {
	menteeId := c.Params("menteeId")
	if _, err := uuid.Parse(menteeId); err != nil {
		return respondError(c, fiber.StatusBadRequest, "Invalid mentee ID")
	}

	type AdminAssignInput struct {
		MentorIDs []string `json:"mentor_ids" validate:"required"`
	}
	var input AdminAssignInput
	if !bindAndValidate(c, &input) {
		return nil
	}

	// Validate that the mentee exists
	var mentee models.User
	if err := h.DB.First(&mentee, "id = ?", menteeId).Error; err != nil {
		return respondError(c, fiber.StatusNotFound, "Mentee not found")
	}

	// Reject a mentee being listed as their own mentor.
	for _, mentorID := range input.MentorIDs {
		if mentorID == menteeId {
			return respondError(c, fiber.StatusBadRequest, "A mentee cannot be their own mentor")
		}
	}

	// Validate all mentor IDs exist
	if len(input.MentorIDs) > 0 {
		var count int64
		if err := h.DB.Model(&models.User{}).Where("id IN ?", input.MentorIDs).Count(&count).Error; err != nil {
			return respondError(c, fiber.StatusInternalServerError, err.Error())
		}
		if int(count) != len(input.MentorIDs) {
			return respondError(c, fiber.StatusBadRequest, "One or more mentor IDs are invalid")
		}
	}

	// Replace mentor list in a transaction: delete current, insert new.
	err := h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("mentee_id = ?", menteeId).Delete(&models.Mentorship{}).Error; err != nil {
			return err
		}
		for _, mentorID := range input.MentorIDs {
			if err := tx.Exec(
				`INSERT INTO mentorships (id, mentor_id, mentee_id, created_at)
				 VALUES (gen_random_uuid(), ?, ?, NOW())
				 ON CONFLICT (mentor_id, mentee_id) DO NOTHING`,
				mentorID, menteeId,
			).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return respondError(c, fiber.StatusInternalServerError, "Failed to assign mentors")
	}

	return c.JSON(fiber.Map{"message": "Mentors assigned successfully"})
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
