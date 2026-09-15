package handlers

import "gorm.io/gorm"

// distinctNonEmptyStrings runs query (already scoped to a model and any extra conditions the
// caller needs) and returns every distinct non-empty value of column, ordered alphabetically —
// the shared shape behind free-text autocomplete endpoints like GetDepartments and GetSprints,
// so a future change to the pattern (trimming, case-insensitive dedup, ...) only happens once.
func distinctNonEmptyStrings(query *gorm.DB, column string) ([]string, error) {
	var values []string
	err := query.
		Where(column + " != ''").
		Distinct(column).
		Order(column).
		Pluck(column, &values).Error
	return values, err
}
