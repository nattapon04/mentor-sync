export const ROLES = ["admin", "mentor", "mentee"] as const;
export type Role = (typeof ROLES)[number];

export const TIME_RANGE_OPTIONS = [
  { value: "30", labelKey: "last30Days" },
  { value: "90", labelKey: "last90Days" },
  { value: "365", labelKey: "thisYear" },
  { value: "all", labelKey: "allTime" },
] as const;
export type TimeRange = (typeof TIME_RANGE_OPTIONS)[number]["value"];

// Returns the "YYYY-MM-DD" start-of-range date for a time range, or undefined for "all".
// Built from local date parts (not toISOString(), which converts to UTC first) so the
// boundary matches "today minus N days" in the viewer's own calendar rather than UTC's.
export function getStartDateParam(timeRange: TimeRange): string | undefined {
  if (timeRange === "all") return undefined;
  const start = new Date();
  start.setDate(start.getDate() - parseInt(timeRange));
  const year = start.getFullYear();
  const month = String(start.getMonth() + 1).padStart(2, "0");
  const day = String(start.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Mentee pass-rate thresholds used to bucket dashboard status (onTrack / atRisk / offTrack).
export const PASS_RATE_THRESHOLDS = {
  onTrack: 0.8,
  atRisk: 0.5,
} as const;
