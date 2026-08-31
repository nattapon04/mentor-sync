package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type MetricType string

const (
	MetricTypeQuality   MetricType = "quality"
	MetricTypeVelocity  MetricType = "velocity"
	MetricTypeSoftSkill MetricType = "soft_skill"
)

type EvalType string

const (
	EvalTypeTicket EvalType = "ticket"
	EvalTypeSprint EvalType = "sprint"
	EvalTypeBoth   EvalType = "both"
)

type SLARule struct {
	ID          uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name        string     `gorm:"not null" json:"name" validate:"required"`
	MetricType  MetricType `gorm:"type:varchar(20);not null" json:"metric_type" validate:"required,oneof=quality velocity soft_skill"`
	EvalType    EvalType   `gorm:"type:varchar(10);not null;default:'both'" json:"eval_type" validate:"omitempty,oneof=ticket sprint both"`
	TargetValue string     `json:"target_value" validate:"required"`
	// TargetOperator/TargetNumeric are an optional structured form of TargetValue (e.g.
	// TargetValue "<= 2 rounds/PR" -> TargetOperator "<=", TargetNumeric 2), letting Focus
	// Areas compute an actual numeric gap-to-target instead of only a pass/fail rate. Both are
	// nil/empty for rules that haven't been given a structured target — TargetValue alone still
	// fully describes the rule for display and Pass/Fail evaluation.
	TargetOperator string   `gorm:"type:varchar(2)" json:"target_operator,omitempty" validate:"omitempty,oneof=>= <= ="`
	TargetNumeric  *float64 `json:"target_numeric,omitempty"`
	// TargetRelativeToEstimate marks a rule whose numeric target isn't a fixed number but
	// varies per ticket (e.g. Ticket Cycle Time compared against that ticket's own estimated
	// days, not a flat "<= 3 days" for every ticket). When true, TargetOperator still gives the
	// comparison direction, but TargetNumeric is unused — each EvaluationMetric instead supplies
	// its own EstimateNumeric to compare against.
	TargetRelativeToEstimate bool           `gorm:"default:false" json:"target_relative_to_estimate"`
	Scope                    string         `json:"scope"`
	IsActive                 bool           `gorm:"default:true" json:"is_active"`
	CreatedAt                time.Time      `json:"created_at"`
	UpdatedAt                time.Time      `json:"updated_at"`
	DeletedAt                gorm.DeletedAt `gorm:"index" json:"-"`
}
