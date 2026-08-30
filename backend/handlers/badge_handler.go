package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/nattapon/mentorsync/models"
)

func (h *Handlers) GetEarnedBadges(c *fiber.Ctx) error {
	menteeID := c.Query("mentee_id")
	var badges []models.EarnedBadge

	query := h.DB.Preload("Mentee").Preload("AwardedBy")
	if menteeID != "" {
		query = query.Where("mentee_id = ?", menteeID)
	}
	
	if err := query.Order("created_at desc").Find(&badges).Error; err != nil {
		return respondError(c, fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(badges)
}

func (h *Handlers) AwardBadge(c *fiber.Ctx) error {
	type Input struct {
		MenteeID    string `json:"mentee_id" validate:"required,uuid"`
		AwardedByID string `json:"awarded_by_id" validate:"omitempty,uuid"`
		BadgeType   string `json:"badge_type" validate:"required"`
	}
	var input Input
	if !bindAndValidate(c, &input) {
		return nil
	}

	menteeUUID, err := uuid.Parse(input.MenteeID)
	if err != nil {
		return respondError(c, fiber.StatusBadRequest, "Invalid Mentee ID")
	}

	var awardedByUUID *uuid.UUID
	if input.AwardedByID != "" {
		parsed, err := uuid.Parse(input.AwardedByID)
		if err == nil {
			awardedByUUID = &parsed
		}
	}

	badge := models.EarnedBadge{
		MenteeID:    menteeUUID,
		AwardedByID: awardedByUUID,
		BadgeType:   input.BadgeType,
	}

	if err := h.DB.Create(&badge).Error; err != nil {
		return respondError(c, fiber.StatusInternalServerError, "Failed to award badge")
	}

	// Preload to return full object
	h.DB.Preload("AwardedBy").First(&badge, "id = ?", badge.ID)
	return c.JSON(badge)
}

func (h *Handlers) DeleteBadge(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := h.DB.Delete(&models.EarnedBadge{}, "id = ?", id).Error; err != nil {
		return respondError(c, fiber.StatusInternalServerError, "Failed to delete badge")
	}
	return c.JSON(fiber.Map{"message": "Badge deleted"})
}
