import { Evaluation, EarnedBadge, GeneralNote } from "@/types";
import { computeFocusAreas, FocusArea } from "./focusAreas";

export interface BestRuleInfo {
  ruleName: string;
  passCount: number;
  totalCount: number;
  passRate: number; // 0-100
}

export interface LatestBadgeInfo {
  badgeType: string;
  date: string;
}

export interface QuickNoteQuote {
  message: string;
  date: string;
}

export interface GrowthInfo {
  direction: "up" | "down" | "flat";
  beforeRate: number;
  afterRate: number;
  deltaPoints: number;
}

export interface MenteeInsights {
  hasEnoughData: boolean;
  bestRule: BestRuleInfo | null;
  latestBadge: LatestBadgeInfo | null;
  topFocusArea: FocusArea | null;
  goingWellQuote: QuickNoteQuote | null;
  needsImprovementQuote: QuickNoteQuote | null;
  growth: GrowthInfo | null;
}

// Below this many evaluations there isn't enough signal to summarize — showing a computed
// "insight" from 1 data point would look more authoritative than it is.
const MIN_EVALUATIONS = 2;
// A rule needs at least this many recorded samples before its pass rate counts as "going well" —
// a single Pass shouldn't crown a rule as the mentee's strongest metric.
const MIN_SAMPLES_PER_RULE = 2;
// Pass-rate swings within this many points of the midpoint between the two halves of the period
// read as noise rather than a real trend.
const FLAT_THRESHOLD_POINTS = 5;

function passRateOf(evaluations: Evaluation[]): number | null {
  let pass = 0;
  let total = 0;
  for (const ev of evaluations) {
    for (const m of ev.metrics ?? []) {
      if (!m.is_enabled || (m.value_string !== "Pass" && m.value_string !== "Fail")) continue;
      total++;
      if (m.value_string === "Pass") pass++;
    }
  }
  return total > 0 ? (pass / total) * 100 : null;
}

function findBestRule(evaluations: Evaluation[]): BestRuleInfo | null {
  const stats = new Map<string, { name: string; pass: number; total: number }>();
  for (const ev of evaluations) {
    for (const m of ev.metrics ?? []) {
      if (!m.is_enabled || (m.value_string !== "Pass" && m.value_string !== "Fail")) continue;
      const s = stats.get(m.sla_rule_id) ?? { name: m.sla_rule?.name ?? "", pass: 0, total: 0 };
      s.total++;
      if (m.value_string === "Pass") s.pass++;
      stats.set(m.sla_rule_id, s);
    }
  }

  let best: BestRuleInfo | null = null;
  for (const s of stats.values()) {
    if (s.total < MIN_SAMPLES_PER_RULE) continue;
    const rate = (s.pass / s.total) * 100;
    if (!best || rate > best.passRate) {
      best = { ruleName: s.name, passCount: s.pass, totalCount: s.total, passRate: rate };
    }
  }
  return best;
}

// notes is expected newest-first (as returned by GET /notes), so the first match is the latest.
function latestNoteOfType(notes: GeneralNote[], noteType: string): QuickNoteQuote | null {
  const note = notes.find(n => n.note_type === noteType);
  return note ? { message: note.message, date: note.created_at } : null;
}

function findLatestBadge(badges: EarnedBadge[]): LatestBadgeInfo | null {
  if (badges.length === 0) return null;
  const latest = badges.reduce((a, b) => (new Date(a.created_at) > new Date(b.created_at) ? a : b));
  return { badgeType: latest.badge_type, date: latest.created_at };
}

// Summarizes a mentee's recent performance into what's going well, what needs improvement, and
// how the trend is moving — purely from data already loaded on the page (evaluations, badges,
// quick notes), no AI call involved. evaluations and notes are both expected newest-first, as
// GET /evaluations and GET /notes already return them (computeFocusAreas relies on the same
// ordering). badges are intentionally NOT scoped to the caller's date range — the Wall of
// Achievements they also feed is a lifetime list by design, so "latest badge" here means latest
// ever, not latest within the period.
export function computeInsights(
  evaluations: Evaluation[],
  badges: EarnedBadge[],
  notes: GeneralNote[]
): MenteeInsights {
  const hasEnoughData = evaluations.length >= MIN_EVALUATIONS;
  if (!hasEnoughData) {
    return {
      hasEnoughData: false,
      bestRule: null,
      latestBadge: null,
      topFocusArea: null,
      goingWellQuote: null,
      needsImprovementQuote: null,
      growth: null,
    };
  }

  // evaluations is newest-first: the first half is the more recent half of the period.
  const mid = Math.ceil(evaluations.length / 2);
  const recentRate = passRateOf(evaluations.slice(0, mid));
  const olderRate = passRateOf(evaluations.slice(mid));
  let growth: GrowthInfo | null = null;
  if (recentRate != null && olderRate != null) {
    const delta = recentRate - olderRate;
    const direction = delta > FLAT_THRESHOLD_POINTS ? "up" : delta < -FLAT_THRESHOLD_POINTS ? "down" : "flat";
    growth = { direction, beforeRate: olderRate, afterRate: recentRate, deltaPoints: delta };
  }

  return {
    hasEnoughData: true,
    bestRule: findBestRule(evaluations),
    latestBadge: findLatestBadge(badges),
    topFocusArea: computeFocusAreas(evaluations)[0] ?? null,
    goingWellQuote: latestNoteOfType(notes, "positive"),
    needsImprovementQuote: latestNoteOfType(notes, "constructive"),
    growth,
  };
}
