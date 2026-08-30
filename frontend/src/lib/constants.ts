export const ROLES = ["admin", "mentor", "mentee"] as const;
export type Role = (typeof ROLES)[number];

export const TIME_RANGE_OPTIONS = [
  { value: "30", labelKey: "last30Days" },
  { value: "90", labelKey: "last90Days" },
  { value: "365", labelKey: "thisYear" },
  { value: "all", labelKey: "allTime" },
] as const;
export type TimeRange = (typeof TIME_RANGE_OPTIONS)[number]["value"];

// Mentee pass-rate thresholds used to bucket dashboard status (onTrack / atRisk / offTrack).
export const PASS_RATE_THRESHOLDS = {
  onTrack: 0.8,
  atRisk: 0.5,
} as const;
