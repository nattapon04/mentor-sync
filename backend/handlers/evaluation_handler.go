package handlers

import (
	"log/slog"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/nattapon/mentorsync/models"
	"gorm.io/gorm"
)

type CreateEvaluationInput struct {
	MenteeID       uuid.UUID                 `json:"mentee_id"`
	EvaluatorID    uuid.UUID                 `json:"evaluator_id"`
	EvaluationType string                    `json:"evaluation_type" validate:"omitempty,oneof=ticket sprint"`
	ReferenceID    string                    `json:"reference_id" validate:"required"`
	Metrics        []models.EvaluationMetric `json:"metrics"`
}

// GetEvaluations fetches all evaluations
func (h *Handlers) GetEvaluations(c *fiber.Ctx) error {
	var evaluations []models.JiraEvaluation
	query := h.DB.Preload("Mentee").Preload("Evaluator").Preload("Metrics").Preload("Metrics.SLARule")

	if menteeID := c.Query("mentee_id"); menteeID != "" {
		query = query.Where("mentee_id = ?", menteeID)
	}
	if startDate := c.Query("start_date"); startDate != "" {
		query = query.Where("created_at >= ?", startDate)
	}
	if endDate := c.Query("end_date"); endDate != "" {
		// Append time to include the whole end day
		query = query.Where("created_at <= ?", endDate+" 23:59:59")
	}

	if err := query.Order("created_at desc").Find(&evaluations).Error; err != nil {
		return respondError(c, fiber.StatusInternalServerError, err.Error())
	}

	return c.JSON(evaluations)
}

// CreateEvaluation creates an evaluation and its metrics in a transaction
func (h *Handlers) CreateEvaluation(c *fiber.Ctx) error {
	var input CreateEvaluationInput
	if !bindAndValidate(c, &input) {
		return nil
	}
	// validator's `required` can't detect a zero-valued uuid.UUID (it's a fixed-size array,
	// always non-empty by length), so check these two explicitly.
	if input.MenteeID == uuid.Nil || input.EvaluatorID == uuid.Nil {
		return respondError(c, fiber.StatusBadRequest, "mentee_id and evaluator_id are required")
	}

	evaluation := models.JiraEvaluation{
		MenteeID:       input.MenteeID,
		EvaluatorID:    input.EvaluatorID,
		EvaluationType: input.EvaluationType,
		ReferenceID:    input.ReferenceID,
	}

	if evaluation.EvaluationType == "" {
		evaluation.EvaluationType = "ticket"
	}

	err := h.DB.Transaction(func(tx *gorm.DB) error {
		// Create the evaluation first
		if err := tx.Create(&evaluation).Error; err != nil {
			return err
		}

		// Create the metrics linked to the evaluation
		for i := range input.Metrics {
			input.Metrics[i].EvaluationID = evaluation.ID
		}

		if len(input.Metrics) > 0 {
			if err := tx.Create(&input.Metrics).Error; err != nil {
				return err
			}
		}
		
		return nil
	})

	if err != nil {
		return respondError(c, fiber.StatusInternalServerError, err.Error())
	}

	// Trigger Auto Badges asynchronously. Recovers from panics and logs errors instead of
	// letting either take down the whole process — this runs detached from the request.
	go func(menteeID uuid.UUID) {
		defer func() {
			if r := recover(); r != nil {
				slog.Error("checkAndAwardAutoBadges panicked", "mentee_id", menteeID, "panic", r)
			}
		}()
		h.checkAndAwardAutoBadges(menteeID)
	}(input.MenteeID)

	// Fetch the newly created evaluation with preloaded data to return
	var createdEvaluation models.JiraEvaluation
	h.DB.Preload("Mentee").Preload("Evaluator").Preload("Metrics").Preload("Metrics.SLARule").First(&createdEvaluation, evaluation.ID)

	return c.Status(fiber.StatusCreated).JSON(createdEvaluation)
}

// DeleteEvaluation deletes an evaluation and its metrics
func (h *Handlers) DeleteEvaluation(c *fiber.Ctx) error {
	id := c.Params("id")

	err := h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("evaluation_id = ?", id).Delete(&models.EvaluationMetric{}).Error; err != nil {
			return err
		}
		if err := tx.Delete(&models.JiraEvaluation{}, "id = ?", id).Error; err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		return respondError(c, fiber.StatusInternalServerError, "Failed to delete evaluation")
	}

	return c.JSON(fiber.Map{"message": "Evaluation deleted"})
}

// Auto Badge logic
func (h *Handlers) checkAndAwardAutoBadges(menteeID uuid.UUID) {
	// 1. Fetch last 5 evaluations for the mentee, ordered by newest first
	var evals []models.JiraEvaluation
	if err := h.DB.Preload("Metrics").Preload("Metrics.SLARule").
		Where("mentee_id = ?", menteeID).
		Order("created_at desc").
		Limit(5).Find(&evals).Error; err != nil {
		slog.Error("failed to load evaluations for auto-badge check", "mentee_id", menteeID, "error", err)
		return
	}

	if len(evals) == 0 {
		return
	}

	// Helper to award badge if they don't have it today
	awardIfNotExists := func(badgeType string) {
		// Check if they already earned it in the last 24h to avoid spam
		var count int64
		if err := h.DB.Model(&models.EarnedBadge{}).
			Where("mentee_id = ? AND badge_type = ? AND created_at > CURRENT_DATE", menteeID, badgeType).
			Count(&count).Error; err != nil {
			slog.Error("failed to check existing auto-badge", "badge_type", badgeType, "mentee_id", menteeID, "error", err)
			return
		}

		if count == 0 {
			badge := models.EarnedBadge{
				MenteeID:      menteeID,
				BadgeType:     badgeType,
				IsAutoAwarded: true,
				// AwardedByID is left nil to represent System
			}
			if err := h.DB.Create(&badge).Error; err != nil {
				slog.Error("failed to award auto-badge", "badge_type", badgeType, "mentee_id", menteeID, "error", err)
			}
		}
	}

	// Analyze the evals
	consecutiveZeroDefect := 0
	consecutiveOneShot := 0
	consecutiveEagleEye := 0

	for _, ev := range evals {
		if ev.EvaluationType == "sprint" {
			// Sprint Master: Pass on 'Sprint Commitment'
			for _, m := range ev.Metrics {
				if m.SLARule.Name == "Sprint Commitment" && m.ValueString == "Pass" {
					awardIfNotExists("sprint_master")
				}
			}
		} else {
			// Ticket metrics
			passedEscapeBugs := false
			passedCodeRework := false
			passedSelfVerify := false

			for _, m := range ev.Metrics {
				if m.ValueString != "Pass" {
					continue
				}
				switch m.SLARule.Name {
				case "Production Escape Bugs":
					passedEscapeBugs = true
				case "Code Review Rework":
					passedCodeRework = true
				case "Self-Verification":
					passedSelfVerify = true
				}
			}

			if passedEscapeBugs { consecutiveZeroDefect++ } else { consecutiveZeroDefect = 0 }
			if passedCodeRework { consecutiveOneShot++ } else { consecutiveOneShot = 0 }
			if passedSelfVerify { consecutiveEagleEye++ } else { consecutiveEagleEye = 0 }
		}
	}

	// 3 consecutive passes
	if consecutiveZeroDefect >= 3 {
		awardIfNotExists("zero_defect")
	}
	if consecutiveOneShot >= 3 {
		awardIfNotExists("one_shot")
	}
	if consecutiveEagleEye >= 3 {
		awardIfNotExists("eagle_eye")
	}
}

