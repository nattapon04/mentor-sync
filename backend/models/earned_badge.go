package models

import (
	"time"

	"github.com/google/uuid"
)

type EarnedBadge struct {
	ID            uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	MenteeID      uuid.UUID  `gorm:"type:uuid;not null" json:"mentee_id"`
	Mentee        User       `gorm:"foreignKey:MenteeID" json:"mentee"`
	AwardedByID   *uuid.UUID `gorm:"type:uuid" json:"awarded_by_id"`
	AwardedBy     *User      `gorm:"foreignKey:AwardedByID" json:"awarded_by"`
	BadgeType     string     `gorm:"not null" json:"badge_type"`
	IsAutoAwarded bool       `gorm:"default:false" json:"is_auto_awarded"`
	CreatedAt     time.Time  `json:"created_at"`
}
