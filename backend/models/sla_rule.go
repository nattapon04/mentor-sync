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
	ID          uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name        string         `gorm:"not null" json:"name" validate:"required"`
	MetricType  MetricType     `gorm:"type:varchar(20);not null" json:"metric_type" validate:"required,oneof=quality velocity soft_skill"`
	EvalType    EvalType       `gorm:"type:varchar(10);not null;default:'both'" json:"eval_type" validate:"omitempty,oneof=ticket sprint both"`
	TargetValue string         `json:"target_value" validate:"required"`
	Scope       string         `json:"scope"`
	IsActive    bool           `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}
