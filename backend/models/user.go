package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Role string

const (
	RoleAdmin  Role = "admin"
	RoleMentor Role = "mentor"
	RoleMentee Role = "mentee"
)

type User struct {
	ID                 uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Email              string         `gorm:"uniqueIndex:idx_users_email_active,where:deleted_at IS NULL;not null" json:"email"`
	PasswordHash       string         `gorm:"not null" json:"-"`
	Name               string         `gorm:"not null" json:"name"`
	Department         string         `json:"department"`
	Roles              []Role         `gorm:"type:jsonb;serializer:json;not null" json:"roles"`
	// ManagerID is kept for backward compatibility — new code should use the Mentors/Mentees
	// relations which are backed by the mentorships junction table.
	ManagerID          *uuid.UUID     `gorm:"type:uuid" json:"manager_id"`
	Manager            *User          `gorm:"foreignKey:ManagerID" json:"manager,omitempty"`
	// Mentors are the users who mentor this user (many-to-many via mentorships table).
	Mentors            []User         `gorm:"many2many:mentorships;joinForeignKey:MenteeID;joinReferences:MentorID" json:"mentors,omitempty"`
	// Mentees are the users this user mentors (many-to-many via mentorships table).
	Mentees            []User         `gorm:"many2many:mentorships;joinForeignKey:MentorID;joinReferences:MenteeID" json:"mentees,omitempty"`
	ThemePreference    string         `gorm:"default:'light'" json:"theme_preference"`
	LanguagePreference string         `gorm:"default:'en'" json:"language_preference"`
	// TokenVersion is bumped whenever a user's access should be revoked (role/profile change),
	// so an already-issued JWT can be invalidated immediately instead of waiting out its full
	// expiry window. Never exposed via JSON — it's an internal security field.
	TokenVersion int64 `gorm:"not null;default:0" json:"-"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"-"`
}
