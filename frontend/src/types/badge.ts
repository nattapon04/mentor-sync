export interface EarnedBadge {
  id: string;
  badge_type: string;
  created_at: string;
  awarded_by?: { name: string };
}
