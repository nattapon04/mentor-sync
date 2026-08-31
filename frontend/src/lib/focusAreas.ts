import { Evaluation } from "@/types";

export interface FocusArea {
  slaRuleId: string;
  name: string;
  metricType: string;
  targetValue: string;
  passCount: number;
  failCount: number;
  failRate: number;
  lastValueString: string;
  lastComment: string;
  lastDate: string;
  // Numeric gap-to-target, only populated when the SLA rule has a structured target
  // (target_operator + target_numeric, or target_relative_to_estimate) and at least one
  // recorded evaluation has the numeric value(s) needed. Positive = short of target by this
  // much; negative = beyond target.
  targetOperator: string;
  targetNumeric: number | null;
  targetRelativeToEstimate: boolean;
  avgActual: number | null;
  gap: number | null;
}

// Ranks SLA criteria by how often a mentee has failed them, so the ones needing the most
// improvement surface first. Only includes criteria with at least one Fail — a rule the
// mentee has always passed isn't a "focus area". Evaluations are expected newest-first
// (as returned by GET /evaluations), so the first Fail/Pass seen per rule is the most recent.
export function computeFocusAreas(evaluations: Evaluation[]): FocusArea[] {
  const byRule = new Map<string, FocusArea>();
  const numericSums = new Map<string, { sum: number; count: number }>();
  // Paired (actual - estimate) differences, only for target_relative_to_estimate rules — kept
  // separate from numericSums because averaging actual and estimate independently before
  // subtracting would be wrong if some evaluations logged only one of the two.
  const estimateGapSums = new Map<string, { sum: number; count: number }>();

  for (const ev of evaluations) {
    for (const m of ev.metrics ?? []) {
      if (!m.is_enabled || (m.value_string !== "Pass" && m.value_string !== "Fail")) continue;

      let area = byRule.get(m.sla_rule_id);
      if (!area) {
        area = {
          slaRuleId: m.sla_rule_id,
          name: m.sla_rule?.name ?? "",
          metricType: m.sla_rule?.metric_type ?? "",
          targetValue: m.sla_rule?.target_value ?? "",
          passCount: 0,
          failCount: 0,
          failRate: 0,
          lastValueString: m.value_string,
          lastComment: m.comment,
          lastDate: ev.created_at,
          targetOperator: m.sla_rule?.target_operator ?? "",
          targetNumeric: m.sla_rule?.target_numeric ?? null,
          targetRelativeToEstimate: m.sla_rule?.target_relative_to_estimate ?? false,
          avgActual: null,
          gap: null,
        };
        byRule.set(m.sla_rule_id, area);
      }

      if (m.value_string === "Pass") area.passCount++;
      else area.failCount++;

      if (m.value_numeric != null) {
        const agg = numericSums.get(m.sla_rule_id) ?? { sum: 0, count: 0 };
        agg.sum += m.value_numeric;
        agg.count += 1;
        numericSums.set(m.sla_rule_id, agg);
      }

      if (area.targetRelativeToEstimate && m.value_numeric != null && m.estimate_numeric != null) {
        const diff = area.targetOperator === "<="
          ? m.value_numeric - m.estimate_numeric // over its own estimate by this much
          : m.estimate_numeric - m.value_numeric; // ">="/"=": short of its own estimate by this much
        const agg = estimateGapSums.get(m.sla_rule_id) ?? { sum: 0, count: 0 };
        agg.sum += diff;
        agg.count += 1;
        estimateGapSums.set(m.sla_rule_id, agg);
      }
    }
  }

  const areas = Array.from(byRule.values()).filter(a => a.failCount > 0);
  for (const a of areas) {
    a.failRate = a.failCount / (a.passCount + a.failCount);

    const agg = numericSums.get(a.slaRuleId);
    if (agg && agg.count > 0) {
      a.avgActual = agg.sum / agg.count;
    }

    if (a.targetRelativeToEstimate) {
      const gapAgg = estimateGapSums.get(a.slaRuleId);
      if (gapAgg && gapAgg.count > 0) {
        a.gap = gapAgg.sum / gapAgg.count;
      }
    } else if (a.avgActual != null && a.targetNumeric != null && a.targetOperator) {
      a.gap = a.targetOperator === "<="
        ? a.avgActual - a.targetNumeric // positive = over the ceiling by this much
        : a.targetNumeric - a.avgActual; // ">=" or "=": positive = short of target by this much
    }
  }

  return areas.sort((a, b) => b.failRate - a.failRate || b.failCount - a.failCount);
}
