package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/nattapon/mentorsync/models"
)

// GetSLARules fetches all active SLA rules, optionally filtered by scope and eval_type
// ?scope=global, ?scope=QA, ?scope=Engineering, etc.
// ?eval_type=ticket, ?eval_type=sprint — rules marked "both" always match
func (h *Handlers) GetSLARules(c *fiber.Ctx) error {
	var rules []models.SLARule
	query := h.DB.Where("is_active = ?", true)

	scope := c.Query("scope")
	if scope != "" {
		query = query.Where("scope = ?", scope)
	}

	evalType := c.Query("eval_type")
	if evalType != "" {
		query = query.Where("eval_type = ? OR eval_type = ?", evalType, models.EvalTypeBoth)
	}

	if err := query.Find(&rules).Error; err != nil {
		return respondError(c, fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(rules)
}

// GetDepartments returns distinct departments from all users
func (h *Handlers) GetDepartments(c *fiber.Ctx) error {
	var departments []string
	if err := h.DB.Model(&models.User{}).
		Where("department != ''").
		Distinct("department").
		Pluck("department", &departments).Error; err != nil {
		return respondError(c, fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(departments)
}

// CreateSLARule creates a new SLA rule. Bound into a restricted DTO rather than
// models.SLARule directly — the latter would let a client dictate the primary key or forge
// created_at/updated_at, since GORM keeps a caller-supplied non-zero value instead of
// generating its own.
func (h *Handlers) CreateSLARule(c *fiber.Ctx) error {
	type CreateInput struct {
		Name                     string            `json:"name" validate:"required"`
		MetricType               models.MetricType `json:"metric_type" validate:"required,oneof=quality velocity soft_skill"`
		EvalType                 models.EvalType   `json:"eval_type" validate:"omitempty,oneof=ticket sprint both"`
		TargetValue              string            `json:"target_value" validate:"required"`
		TargetOperator           string            `json:"target_operator" validate:"omitempty,oneof=>= <= ="`
		TargetNumeric            *float64          `json:"target_numeric"`
		TargetRelativeToEstimate bool              `json:"target_relative_to_estimate"`
		Scope                    string            `json:"scope"`
	}
	var input CreateInput
	if !bindAndValidate(c, &input) {
		return nil
	}

	rule := models.SLARule{
		Name:                     input.Name,
		MetricType:               input.MetricType,
		EvalType:                 input.EvalType,
		TargetValue:              input.TargetValue,
		TargetOperator:           input.TargetOperator,
		TargetNumeric:            input.TargetNumeric,
		TargetRelativeToEstimate: input.TargetRelativeToEstimate,
		Scope:                    input.Scope,
		IsActive:                 true,
	}
	if err := h.DB.Create(&rule).Error; err != nil {
		return respondError(c, fiber.StatusInternalServerError, err.Error())
	}
	return c.Status(fiber.StatusCreated).JSON(rule)
}

// UpdateSLARule updates an existing SLA rule. Only the fields a client is allowed to edit are
// bound from the request body — binding straight onto the loaded row would let a client also
// overwrite is_active (or any other field) via the same request.
func (h *Handlers) UpdateSLARule(c *fiber.Ctx) error {
	id := c.Params("id")
	var rule models.SLARule

	if err := h.DB.First(&rule, "id = ?", id).Error; err != nil {
		return respondError(c, fiber.StatusNotFound, "SLA rule not found")
	}

	type UpdateInput struct {
		Name                     string            `json:"name" validate:"required"`
		MetricType               models.MetricType `json:"metric_type" validate:"required,oneof=quality velocity soft_skill"`
		EvalType                 models.EvalType   `json:"eval_type" validate:"omitempty,oneof=ticket sprint both"`
		TargetValue              string            `json:"target_value" validate:"required"`
		TargetOperator           string            `json:"target_operator" validate:"omitempty,oneof=>= <= ="`
		TargetNumeric            *float64          `json:"target_numeric"`
		TargetRelativeToEstimate bool              `json:"target_relative_to_estimate"`
		Scope                    string            `json:"scope"`
	}
	var input UpdateInput
	if !bindAndValidate(c, &input) {
		return nil
	}

	rule.Name = input.Name
	rule.MetricType = input.MetricType
	rule.EvalType = input.EvalType
	rule.TargetValue = input.TargetValue
	rule.TargetOperator = input.TargetOperator
	rule.TargetNumeric = input.TargetNumeric
	rule.TargetRelativeToEstimate = input.TargetRelativeToEstimate
	rule.Scope = input.Scope

	if err := h.DB.Save(&rule).Error; err != nil {
		return respondError(c, fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(rule)
}

// DeleteSLARule soft deletes an SLA rule
func (h *Handlers) DeleteSLARule(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := h.DB.Delete(&models.SLARule{}, "id = ?", id).Error; err != nil {
		return respondError(c, fiber.StatusInternalServerError, err.Error())
	}
	return c.SendStatus(fiber.StatusNoContent)
}
