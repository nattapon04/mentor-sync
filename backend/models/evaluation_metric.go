package models

import (
	"time"

	"github.com/google/uuid"
)

type EvaluationMetric struct {
	ID           uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	EvaluationID uuid.UUID `gorm:"type:uuid;not null;index" json:"evaluation_id"`
	SLARuleID    uuid.UUID `gorm:"type:uuid;not null" json:"sla_rule_id"`
	SLARule      SLARule   `gorm:"foreignKey:SLARuleID" json:"sla_rule"`
	IsEnabled    bool      `gorm:"default:true" json:"is_enabled"`
	ValueNumeric *float64  `json:"value_numeric"`
	ValueString  string    `json:"value_string"`
	Comment      string    `json:"comment"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
