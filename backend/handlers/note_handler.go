package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/nattapon/mentorsync/models"
)

func (h *Handlers) GetNotes(c *fiber.Ctx) error {
	menteeID := c.Query("mentee_id")
	var notes []models.GeneralNote

	query := h.DB.Preload("Author")
	if menteeID != "" {
		query = query.Where("mentee_id = ?", menteeID)
	}
	
	if err := query.Order("created_at desc").Find(&notes).Error; err != nil {
		return respondError(c, fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(notes)
}

func (h *Handlers) CreateNote(c *fiber.Ctx) error {
	type Input struct {
		MenteeID string          `json:"mentee_id" validate:"required,uuid"`
		AuthorID string          `json:"author_id" validate:"required,uuid"`
		NoteType models.NoteType `json:"note_type" validate:"required,oneof=positive neutral constructive"`
		Message  string          `json:"message" validate:"required"`
	}
	var input Input
	if !bindAndValidate(c, &input) {
		return nil
	}

	menteeUUID, err := uuid.Parse(input.MenteeID)
	if err != nil { return respondError(c, fiber.StatusBadRequest, "Invalid Mentee ID") }
	
	authorUUID, err := uuid.Parse(input.AuthorID)
	if err != nil { return respondError(c, fiber.StatusBadRequest, "Invalid Author ID") }

	note := models.GeneralNote{
		MenteeID:          menteeUUID,
		AuthorID:          authorUUID,
		NoteType:          input.NoteType,
		Message:           input.Message,
		IsVisibleToMentee: true,
	}

	if err := h.DB.Create(&note).Error; err != nil {
		return respondError(c, fiber.StatusInternalServerError, "Failed to create note")
	}

	h.DB.Preload("Author").First(&note, "id = ?", note.ID)
	return c.JSON(note)
}

func (h *Handlers) UpdateNote(c *fiber.Ctx) error {
	id := c.Params("id")
	type Input struct {
		NoteType models.NoteType `json:"note_type" validate:"required,oneof=positive neutral constructive"`
		Message  string          `json:"message" validate:"required"`
	}
	var input Input
	if !bindAndValidate(c, &input) {
		return nil
	}

	var note models.GeneralNote
	if err := h.DB.First(&note, "id = ?", id).Error; err != nil {
		return respondError(c, fiber.StatusNotFound, "Note not found")
	}

	note.NoteType = input.NoteType
	note.Message = input.Message

	if err := h.DB.Save(&note).Error; err != nil {
		return respondError(c, fiber.StatusInternalServerError, "Failed to update note")
	}

	h.DB.Preload("Author").First(&note, "id = ?", note.ID)
	return c.JSON(note)
}

func (h *Handlers) DeleteNote(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := h.DB.Delete(&models.GeneralNote{}, "id = ?", id).Error; err != nil {
		return respondError(c, fiber.StatusInternalServerError, "Failed to delete note")
	}
	return c.JSON(fiber.Map{"message": "Note deleted"})
}
