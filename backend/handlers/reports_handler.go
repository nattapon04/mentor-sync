package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/nattapon/mentorsync/models"
)

type TeamReportResponse struct {
	TotalEvaluations int              `json:"total_evaluations"`
	TotalBadges      int              `json:"total_badges"`
	TotalNotes       int              `json:"total_notes"`
	DepartmentStats  []DepartmentStat `json:"department_stats"`
}

type DepartmentStat struct {
	Department        string  `json:"department"`
	MenteeCount       int     `json:"mentee_count"`
	TotalTickets      int     `json:"total_tickets"`
	PassRatePercent   float64 `json:"pass_rate_percent"`
	PositiveNotes     int     `json:"positive_notes"`
	NeutralNotes      int     `json:"neutral_notes"`
	ConstructiveNotes int     `json:"constructive_notes"`
}

func (h *Handlers) GetTeamReports(c *fiber.Ctx) error {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	var response TeamReportResponse

	evalDataQuery := h.DB.Preload("Mentee").Preload("Metrics")
	badgeDataQuery := h.DB.Preload("Mentee")
	noteDataQuery := h.DB.Preload("Mentee")

	if startDate != "" {
		evalDataQuery = evalDataQuery.Where("created_at >= ?", startDate)
		badgeDataQuery = badgeDataQuery.Where("created_at >= ?", startDate)
		noteDataQuery = noteDataQuery.Where("created_at >= ?", startDate)
	}
	if endDate != "" {
		evalDataQuery = evalDataQuery.Where("created_at <= ?", endDate+" 23:59:59")
		badgeDataQuery = badgeDataQuery.Where("created_at <= ?", endDate+" 23:59:59")
		noteDataQuery = noteDataQuery.Where("created_at <= ?", endDate+" 23:59:59")
	}

	// Fetch all mentees
	var mentees []models.User
	// PostgreSQL JSONB querying to find users with "mentee" role
	if err := h.DB.Where("roles::jsonb ? 'mentee'").Find(&mentees).Error; err != nil {
		return respondError(c, fiber.StatusInternalServerError, err.Error())
	}

	deptMap := make(map[string]*DepartmentStat)
	for _, m := range mentees {
		dept := m.Department
		if dept == "" {
			dept = "Unassigned"
		}
		if _, ok := deptMap[dept]; !ok {
			deptMap[dept] = &DepartmentStat{Department: dept, MenteeCount: 0, TotalTickets: 0, PassRatePercent: 0}
		}
		deptMap[dept].MenteeCount++
	}

	// Fetch all evaluations (within the selected date range) with their metrics
	var evaluations []models.JiraEvaluation
	if err := evalDataQuery.Find(&evaluations).Error; err != nil {
		return respondError(c, fiber.StatusInternalServerError, err.Error())
	}

	deptTotalMetrics := make(map[string]int)
	deptPassedMetrics := make(map[string]int)

	for _, ev := range evaluations {
		if ev.Mentee.ID == uuid.Nil {
			continue // mentee soft-deleted or missing
		}
		response.TotalEvaluations++
		dept := ev.Mentee.Department
		if dept == "" {
			dept = "Unassigned"
		}
		stat, ok := deptMap[dept]
		if !ok {
			continue
		}
		// Derived from this same date-filtered, soft-delete-respecting query so it always
		// agrees with the pass-rate below — a separate all-time COUNT query here previously
		// ignored the date range and double-counted soft-deleted mentees' tickets.
		stat.TotalTickets++
		for _, m := range ev.Metrics {
			if !m.IsEnabled || (m.ValueString != "Pass" && m.ValueString != "Fail") {
				continue
			}
			deptTotalMetrics[dept]++
			if m.ValueString == "Pass" {
				deptPassedMetrics[dept]++
			}
		}
	}

	// Fetch all badges (within the selected date range), same soft-delete-respecting shape as
	// evaluations above — a bare COUNT(*) here previously included badges belonging to a
	// soft-deleted mentee (e.g. the seeded demo mentee), inflating "Badges Awarded" with
	// achievements that don't belong to any mentee visible anywhere else in the app.
	var badges []models.EarnedBadge
	if err := badgeDataQuery.Find(&badges).Error; err != nil {
		return respondError(c, fiber.StatusInternalServerError, err.Error())
	}
	for _, b := range badges {
		if b.Mentee.ID == uuid.Nil {
			continue // mentee soft-deleted or missing
		}
		response.TotalBadges++
	}

	// Fetch all feedback notes (within the selected date range), same soft-delete-respecting,
	// date-filtered shape as the evaluations above so note counts can't drift out of sync with
	// the rest of the report the way total_tickets used to (see the comment above).
	var notes []models.GeneralNote
	if err := noteDataQuery.Find(&notes).Error; err != nil {
		return respondError(c, fiber.StatusInternalServerError, err.Error())
	}

	for _, n := range notes {
		if n.Mentee.ID == uuid.Nil {
			continue // mentee soft-deleted or missing
		}
		dept := n.Mentee.Department
		if dept == "" {
			dept = "Unassigned"
		}
		stat, ok := deptMap[dept]
		if !ok {
			continue
		}
		response.TotalNotes++
		switch n.NoteType {
		case models.NoteTypePositive:
			stat.PositiveNotes++
		case models.NoteTypeNeutral:
			stat.NeutralNotes++
		case models.NoteTypeConstructive:
			stat.ConstructiveNotes++
		}
	}

	for dept, stat := range deptMap {
		if deptTotalMetrics[dept] > 0 {
			stat.PassRatePercent = float64(deptPassedMetrics[dept]) / float64(deptTotalMetrics[dept]) * 100
		}
		response.DepartmentStats = append(response.DepartmentStats, *stat)
	}

	return c.JSON(response)
}

// MenteeReport holds all per-mentee stats returned by GetMenteeReports.
type MenteeReport struct {
	Mentee           models.User   `json:"mentee"`
	Mentors          []models.User `json:"mentors"`
	TotalEvaluations int           `json:"total_evaluations"`
	PassRatePercent  float64       `json:"pass_rate_percent"`
	// PassRateTrend holds the pass-rate (0–100) for each of the last ≤6 evaluations,
	// oldest first, so the frontend can draw a mini sparkline.
	PassRateTrend     []float64 `json:"pass_rate_trend"`
	TotalBadges       int       `json:"total_badges"`
	PositiveNotes     int       `json:"positive_notes"`
	NeutralNotes      int       `json:"neutral_notes"`
	ConstructiveNotes int       `json:"constructive_notes"`
	// Status is derived from PassRatePercent: on_track ≥80%, at_risk ≥50%, off_track <50%.
	Status string `json:"status"`
}

type MenteeReportsResponse struct {
	Mentees []MenteeReport `json:"mentees"`
}

// GetMenteeReports returns per-mentee performance stats for the Mentee-centric report page.
// Supports ?start_date= and ?end_date= for date filtering, and ?mentor_id= to scope to one mentor's mentees.
func (h *Handlers) GetMenteeReports(c *fiber.Ctx) error {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	mentorIDFilter := c.Query("mentor_id")

	// 1. Fetch mentees — optionally filtered to those under a specific mentor.
	var mentees []models.User
	menteeQuery := h.DB.Where("roles::jsonb ? 'mentee'")
	if mentorIDFilter != "" {
		// Only mentees who have a mentorship row with this mentor.
		menteeQuery = menteeQuery.Where(
			"id IN (SELECT mentee_id FROM mentorships WHERE mentor_id = ?)", mentorIDFilter,
		)
	}
	if err := menteeQuery.Find(&mentees).Error; err != nil {
		return respondError(c, fiber.StatusInternalServerError, err.Error())
	}

	// Build a lookup set for mentee IDs so we can scope further queries cheaply.
	menteeIDs := make([]uuid.UUID, 0, len(mentees))
	menteeIndex := make(map[uuid.UUID]int, len(mentees)) // menteeID → slice index
	for i, m := range mentees {
		menteeIDs = append(menteeIDs, m.ID)
		menteeIndex[m.ID] = i
	}

	reports := make([]MenteeReport, len(mentees))
	for i, m := range mentees {
		reports[i].Mentee = m
		reports[i].Mentors = []models.User{}
		reports[i].PassRateTrend = []float64{}
	}

	// 2. Load mentor lists from the junction table for all mentees in one query.
	type mentorshipRow struct {
		MentorID uuid.UUID
		MenteeID uuid.UUID
	}
	var mentorshipRows []mentorshipRow
	if err := h.DB.Raw(`
		SELECT ms.mentor_id, ms.mentee_id
		FROM mentorships ms
		WHERE ms.mentee_id IN ?
	`, menteeIDs).Scan(&mentorshipRows).Error; err != nil {
		return respondError(c, fiber.StatusInternalServerError, err.Error())
	}

	// Fetch all relevant mentors in one query.
	mentorIDSet := make(map[uuid.UUID]bool)
	for _, row := range mentorshipRows {
		mentorIDSet[row.MentorID] = true
	}
	mentorUUIDs := make([]uuid.UUID, 0, len(mentorIDSet))
	for id := range mentorIDSet {
		mentorUUIDs = append(mentorUUIDs, id)
	}
	mentorUsers := make(map[uuid.UUID]models.User)
	if len(mentorUUIDs) > 0 {
		var mentorList []models.User
		if err := h.DB.Where("id IN ?", mentorUUIDs).Find(&mentorList).Error; err != nil {
			return respondError(c, fiber.StatusInternalServerError, err.Error())
		}
		for _, u := range mentorList {
			mentorUsers[u.ID] = u
		}
	}
	for _, row := range mentorshipRows {
		idx, ok := menteeIndex[row.MenteeID]
		if !ok {
			continue
		}
		if mentor, ok := mentorUsers[row.MentorID]; ok {
			reports[idx].Mentors = append(reports[idx].Mentors, mentor)
		}
	}

	// 3. Fetch all evaluations (with metrics) for these mentees, scoped to the date range.
	var evaluations []models.JiraEvaluation
	evalQuery := h.DB.Preload("Metrics").Where("mentee_id IN ?", menteeIDs)
	if startDate != "" {
		evalQuery = evalQuery.Where("created_at >= ?", startDate)
	}
	if endDate != "" {
		evalQuery = evalQuery.Where("created_at <= ?", endDate+" 23:59:59")
	}
	if err := evalQuery.Order("created_at asc").Find(&evaluations).Error; err != nil {
		return respondError(c, fiber.StatusInternalServerError, err.Error())
	}

	// Aggregate per-mentee: overall pass rate and per-evaluation trend data.
	type evalStats struct {
		total  int
		passed int
	}
	menteeEvalStats := make(map[uuid.UUID]*evalStats, len(mentees))
	// evalsByMentee stores pass-rate per evaluation (ordered asc) for sparkline.
	evalsByMentee := make(map[uuid.UUID][]float64, len(mentees))

	for _, ev := range evaluations {
		if menteeEvalStats[ev.MenteeID] == nil {
			menteeEvalStats[ev.MenteeID] = &evalStats{}
		}
		passCount, totalCount := 0, 0
		for _, m := range ev.Metrics {
			if !m.IsEnabled || (m.ValueString != "Pass" && m.ValueString != "Fail") {
				continue
			}
			totalCount++
			if m.ValueString == "Pass" {
				passCount++
				menteeEvalStats[ev.MenteeID].passed++
			}
		}
		menteeEvalStats[ev.MenteeID].total += totalCount
		// Per-evaluation pass rate for sparkline (0 if no metrics recorded).
		var evalRate float64
		if totalCount > 0 {
			evalRate = float64(passCount) / float64(totalCount) * 100
		}
		evalsByMentee[ev.MenteeID] = append(evalsByMentee[ev.MenteeID], evalRate)
	}

	// 4. Fetch badges for these mentees.
	type badgeCount struct {
		MenteeID uuid.UUID
		Count    int64
	}
	var badgeCounts []badgeCount
	badgeQuery := h.DB.Model(&models.EarnedBadge{}).
		Select("mentee_id, COUNT(*) as count").
		Where("mentee_id IN ?", menteeIDs).
		Group("mentee_id")
	if startDate != "" {
		badgeQuery = badgeQuery.Where("created_at >= ?", startDate)
	}
	if endDate != "" {
		badgeQuery = badgeQuery.Where("created_at <= ?", endDate+" 23:59:59")
	}
	if err := badgeQuery.Scan(&badgeCounts).Error; err != nil {
		return respondError(c, fiber.StatusInternalServerError, err.Error())
	}
	badgeMap := make(map[uuid.UUID]int, len(badgeCounts))
	for _, bc := range badgeCounts {
		badgeMap[bc.MenteeID] = int(bc.Count)
	}

	// 5. Fetch notes for these mentees.
	var notes []models.GeneralNote
	noteQuery := h.DB.Where("mentee_id IN ?", menteeIDs)
	if startDate != "" {
		noteQuery = noteQuery.Where("created_at >= ?", startDate)
	}
	if endDate != "" {
		noteQuery = noteQuery.Where("created_at <= ?", endDate+" 23:59:59")
	}
	if err := noteQuery.Find(&notes).Error; err != nil {
		return respondError(c, fiber.StatusInternalServerError, err.Error())
	}

	notePos := make(map[uuid.UUID]int)
	noteNeu := make(map[uuid.UUID]int)
	noteCon := make(map[uuid.UUID]int)
	for _, n := range notes {
		switch n.NoteType {
		case models.NoteTypePositive:
			notePos[n.MenteeID]++
		case models.NoteTypeNeutral:
			noteNeu[n.MenteeID]++
		case models.NoteTypeConstructive:
			noteCon[n.MenteeID]++
		}
	}

	// 6. Assemble final reports.
	const onTrackThreshold = 80.0
	const atRiskThreshold = 50.0

	for i, m := range mentees {
		stats := menteeEvalStats[m.ID]
		var passRate float64
		if stats != nil && stats.total > 0 {
			passRate = float64(stats.passed) / float64(stats.total) * 100
		}

		// Keep only last 6 evaluations for the sparkline trend.
		trend := evalsByMentee[m.ID]
		if len(trend) > 6 {
			trend = trend[len(trend)-6:]
		}

		status := "off_track"
		if passRate >= onTrackThreshold {
			status = "on_track"
		} else if passRate >= atRiskThreshold {
			status = "at_risk"
		}

		evalCount := 0
		if stats != nil {
			evalCount = stats.total
		}

		reports[i].TotalEvaluations = evalCount
		reports[i].PassRatePercent = passRate
		reports[i].PassRateTrend = trend
		reports[i].TotalBadges = badgeMap[m.ID]
		reports[i].PositiveNotes = notePos[m.ID]
		reports[i].NeutralNotes = noteNeu[m.ID]
		reports[i].ConstructiveNotes = noteCon[m.ID]
		reports[i].Status = status
	}

	return c.JSON(MenteeReportsResponse{Mentees: reports})
}
