package models

import (
	"time"

	"github.com/google/uuid"
)

// Mentorship represents a many-to-many relationship between a mentor and a mentee.
// A mentee can have multiple mentors, and a mentor can manage multiple mentees.
type Mentorship struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	MentorID  uuid.UUID `gorm:"type:uuid;not null;index;uniqueIndex:idx_mentorships_pair" json:"mentor_id"`
	MenteeID  uuid.UUID `gorm:"type:uuid;not null;index;uniqueIndex:idx_mentorships_pair" json:"mentee_id"`
	CreatedAt time.Time `json:"created_at"`

	Mentor User `gorm:"foreignKey:MentorID" json:"mentor,omitempty"`
	Mentee User `gorm:"foreignKey:MenteeID" json:"mentee,omitempty"`
}
