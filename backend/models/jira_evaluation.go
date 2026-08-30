package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type JiraEvaluation struct {
	ID             uuid.UUID          `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	MenteeID       uuid.UUID          `gorm:"type:uuid;not null;index" json:"mentee_id"`
	Mentee         User               `gorm:"foreignKey:MenteeID" json:"mentee"`
	EvaluatorID    uuid.UUID          `gorm:"type:uuid;not null;index" json:"evaluator_id"`
	Evaluator      User               `gorm:"foreignKey:EvaluatorID" json:"evaluator"`
	EvaluationType string             `gorm:"type:varchar(50);default:'ticket';not null" json:"evaluation_type"`
	ReferenceID    string             `gorm:"type:varchar(100)" json:"reference_id"`
	CreatedAt      time.Time          `json:"created_at"`
	UpdatedAt      time.Time          `json:"updated_at"`
	DeletedAt      gorm.DeletedAt     `gorm:"index" json:"-"`
	
	Metrics        []EvaluationMetric `gorm:"foreignKey:EvaluationID" json:"metrics"`
}
