package handlers

import "gorm.io/gorm"

// Handlers holds dependencies shared by HTTP handlers, injected at construction instead of
// read from a package-level global — this is what lets handler logic be exercised in tests
// against a real (or per-test-transaction) *gorm.DB instead of the production singleton.
type Handlers struct {
	DB        *gorm.DB
	JWTSecret string
}

func New(db *gorm.DB, jwtSecret string) *Handlers {
	return &Handlers{DB: db, JWTSecret: jwtSecret}
}
