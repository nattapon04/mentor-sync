package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/nattapon/mentorsync/models"
)

type TeamReportResponse struct {
	TotalEvaluations int                  `json:"total_evaluations"`
	TotalBadges      int                  `json:"total_badges"`
	DepartmentStats  []DepartmentStat     `json:"department_stats"`
}

type DepartmentStat struct {
	Department      string  `json:"department"`
	MenteeCount     int     `json:"mentee_count"`
	TotalTickets    int     `json:"total_tickets"`
	PassRatePercent float64 `json:"pass_rate_percent"`
}

func (h *Handlers) GetTeamReports(c *fiber.Ctx) error {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	var response TeamReportResponse

	evalQuery := h.DB.Model(&models.JiraEvaluation{})
	badgeQuery := h.DB.Model(&models.EarnedBadge{})
	evalDataQuery := h.DB.Preload("Mentee").Preload("Metrics")

	if startDate != "" {
		evalQuery = evalQuery.Where("created_at >= ?", startDate)
		badgeQuery = badgeQuery.Where("created_at >= ?", startDate)
		evalDataQuery = evalDataQuery.Where("created_at >= ?", startDate)
	}
	if endDate != "" {
		evalQuery = evalQuery.Where("created_at <= ?", endDate+" 23:59:59")
		badgeQuery = badgeQuery.Where("created_at <= ?", endDate+" 23:59:59")
		evalDataQuery = evalDataQuery.Where("created_at <= ?", endDate+" 23:59:59")
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
	h.DB.Where("roles::jsonb ? 'mentee'").Find(&mentees)

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

	// Fetch all evaluations with their metrics
	var evaluations []models.JiraEvaluation
	evalDataQuery.Find(&evaluations)

	deptTotalMetrics := make(map[string]int)
	deptPassedMetrics := make(map[string]int)

	for _, ev := range evaluations {
		if ev.Mentee.ID.String() == "00000000-0000-0000-0000-000000000000" {
			continue // safety check
		}
		dept := ev.Mentee.Department
		if dept == "" {
			dept = "Unassigned"
		}
		if _, ok := deptMap[dept]; ok {
			for _, m := range ev.Metrics {
				if m.ValueString == "Pass" || m.ValueString == "Fail" {
					deptTotalMetrics[dept]++
					if m.ValueString == "Pass" {
						deptPassedMetrics[dept]++
					}
				}
			}
		}
	}

	for dept, stat := range deptMap {
		if deptTotalMetrics[dept] > 0 {
			stat.PassRatePercent = float64(deptPassedMetrics[dept]) / float64(deptTotalMetrics[dept]) * 100
		}
		
		// Count distinct tickets for this dept
		var deptEvals int64
		h.DB.Model(&models.JiraEvaluation{}).
			Joins("JOIN users ON users.id = jira_evaluations.mentee_id").
			Where("users.department = ?", dept).
			Count(&deptEvals)
		stat.TotalTickets = int(deptEvals)

		response.DepartmentStats = append(response.DepartmentStats, *stat)
	}

	return c.JSON(response)
}
