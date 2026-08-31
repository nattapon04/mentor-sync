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

	evalQuery := h.DB.Model(&models.JiraEvaluation{})
	badgeQuery := h.DB.Model(&models.EarnedBadge{})
	evalDataQuery := h.DB.Preload("Mentee").Preload("Metrics")
	noteDataQuery := h.DB.Preload("Mentee")

	if startDate != "" {
		evalQuery = evalQuery.Where("created_at >= ?", startDate)
		badgeQuery = badgeQuery.Where("created_at >= ?", startDate)
		evalDataQuery = evalDataQuery.Where("created_at >= ?", startDate)
		noteDataQuery = noteDataQuery.Where("created_at >= ?", startDate)
	}
	if endDate != "" {
		evalQuery = evalQuery.Where("created_at <= ?", endDate+" 23:59:59")
		badgeQuery = badgeQuery.Where("created_at <= ?", endDate+" 23:59:59")
		evalDataQuery = evalDataQuery.Where("created_at <= ?", endDate+" 23:59:59")
		noteDataQuery = noteDataQuery.Where("created_at <= ?", endDate+" 23:59:59")
	}

	var evalCount int64
	evalQuery.Count(&evalCount)
	response.TotalEvaluations = int(evalCount)

	var badgeCount int64
	badgeQuery.Count(&badgeCount)
	response.TotalBadges = int(badgeCount)

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
