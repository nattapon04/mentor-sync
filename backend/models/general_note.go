package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type NoteType string

const (
	NoteTypePositive     NoteType = "positive"
	NoteTypeNeutral      NoteType = "neutral"
	NoteTypeConstructive NoteType = "constructive"
)

type GeneralNote struct {
	ID                 uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	MenteeID           uuid.UUID      `gorm:"type:uuid;not null" json:"mentee_id"`
	Mentee             User           `gorm:"foreignKey:MenteeID" json:"mentee"`
	AuthorID           uuid.UUID      `gorm:"type:uuid;not null" json:"author_id"`
	Author             User           `gorm:"foreignKey:AuthorID" json:"author"`
	NoteType           NoteType       `gorm:"type:varchar(20);not null" json:"note_type"`
	Message            string         `gorm:"type:text;not null" json:"message"`
	IsVisibleToMentee  bool           `gorm:"default:true" json:"is_visible_to_mentee"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"-"`
}
