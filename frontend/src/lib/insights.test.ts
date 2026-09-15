import { describe, it, expect } from "vitest";
import { computeInsights } from "./insights";
import { Evaluation, EvaluationMetric, EarnedBadge, GeneralNote } from "@/types";

function metric(overrides: Partial<EvaluationMetric>): EvaluationMetric {
  return {
    sla_rule_id: "rule-1",
    sla_rule: { id: "rule-1", name: "Rule", metric_type: "quality", eval_type: "ticket", target_value: "" },
    value_numeric: null,
    estimate_numeric: null,
    value_string: "Pass",
    comment: "",
    is_enabled: true,
    ...overrides,
  };
}

function evaluation(id: string, createdAt: string, metrics: EvaluationMetric[]): Evaluation {
  return {
    id,
    mentee_id: "mentee-1",
    evaluator_id: "mentor-1",
    evaluation_type: "ticket",
    reference_id: id,
    created_at: createdAt,
    metrics,
  };
}

function note(type: string, message: string, createdAt: string): GeneralNote {
  return { id: message, note_type: type, message, created_at: createdAt };
}

function badge(type: string, createdAt: string): EarnedBadge {
  return { id: type, badge_type: type, created_at: createdAt };
}

describe("computeInsights", () => {
  it("reports not enough data below the minimum evaluation count", () => {
    const evals = [evaluation("e1", "2026-09-01", [metric({ value_string: "Pass" })])];
    const insights = computeInsights(evals, [], []);
    expect(insights.hasEnoughData).toBe(false);
    expect(insights.bestRule).toBeNull();
    expect(insights.growth).toBeNull();
  });

  it("picks the rule with the highest pass rate among rules with at least two samples", () => {
    const evals = [
      evaluation("e1", "2026-09-03", [
        metric({ sla_rule_id: "r-good", sla_rule: { id: "r-good", name: "Good Rule", metric_type: "quality", eval_type: "ticket", target_value: "" }, value_string: "Pass" }),
        metric({ sla_rule_id: "r-once", sla_rule: { id: "r-once", name: "Once Rule", metric_type: "quality", eval_type: "ticket", target_value: "" }, value_string: "Pass" }),
      ]),
      evaluation("e2", "2026-09-02", [
        metric({ sla_rule_id: "r-good", sla_rule: { id: "r-good", name: "Good Rule", metric_type: "quality", eval_type: "ticket", target_value: "" }, value_string: "Pass" }),
      ]),
    ];
    const insights = computeInsights(evals, [], []);
    // r-once only has one sample — shouldn't win even though it's 100% pass, only ever seen once.
    expect(insights.bestRule?.ruleName).toBe("Good Rule");
    expect(insights.bestRule?.passRate).toBe(100);
    expect(insights.bestRule?.totalCount).toBe(2);
  });

  it("detects an improving trend when the recent half passes more than the older half", () => {
    // Newest-first, as GET /evaluations returns them.
    const evals = [
      evaluation("e4", "2026-09-04", [metric({ value_string: "Pass" })]),
      evaluation("e3", "2026-09-03", [metric({ value_string: "Pass" })]),
      evaluation("e2", "2026-09-02", [metric({ value_string: "Fail" })]),
      evaluation("e1", "2026-09-01", [metric({ value_string: "Fail" })]),
    ];
    const insights = computeInsights(evals, [], []);
    expect(insights.growth?.direction).toBe("up");
    expect(insights.growth?.afterRate).toBe(100);
    expect(insights.growth?.beforeRate).toBe(0);
  });

  it("detects a declining trend when the recent half passes less than the older half", () => {
    const evals = [
      evaluation("e4", "2026-09-04", [metric({ value_string: "Fail" })]),
      evaluation("e3", "2026-09-03", [metric({ value_string: "Fail" })]),
      evaluation("e2", "2026-09-02", [metric({ value_string: "Pass" })]),
      evaluation("e1", "2026-09-01", [metric({ value_string: "Pass" })]),
    ];
    const insights = computeInsights(evals, [], []);
    expect(insights.growth?.direction).toBe("down");
  });

  it("calls a small swing flat rather than up or down", () => {
    const evals = [
      evaluation("e4", "2026-09-04", [metric({ value_string: "Pass" }), metric({ sla_rule_id: "r2", value_string: "Pass" })]),
      evaluation("e3", "2026-09-03", [metric({ value_string: "Pass" }), metric({ sla_rule_id: "r2", value_string: "Fail" })]),
      evaluation("e2", "2026-09-02", [metric({ value_string: "Pass" }), metric({ sla_rule_id: "r2", value_string: "Fail" })]),
      evaluation("e1", "2026-09-01", [metric({ value_string: "Pass" }), metric({ sla_rule_id: "r2", value_string: "Pass" })]),
    ];
    const insights = computeInsights(evals, [], []);
    expect(insights.growth?.direction).toBe("flat");
  });

  it("picks the latest positive note for goingWellQuote and latest constructive note for needsImprovementQuote", () => {
    const evals = [
      evaluation("e2", "2026-09-02", [metric({ value_string: "Fail" })]),
      evaluation("e1", "2026-09-01", [metric({ value_string: "Fail" })]),
    ];
    // Newest-first, as GET /notes returns them.
    const notes = [
      note("constructive", "Newer constructive note", "2026-09-05"),
      note("positive", "Newer positive note", "2026-09-04"),
      note("constructive", "Older constructive note", "2026-09-02"),
      note("positive", "Older positive note", "2026-09-01"),
    ];
    const insights = computeInsights(evals, [], notes);
    expect(insights.goingWellQuote?.message).toBe("Newer positive note");
    expect(insights.needsImprovementQuote?.message).toBe("Newer constructive note");
  });

  it("picks the most recently created badge regardless of array order", () => {
    const evals = [
      evaluation("e2", "2026-09-02", [metric({ value_string: "Pass" })]),
      evaluation("e1", "2026-09-01", [metric({ value_string: "Pass" })]),
    ];
    const badges = [badge("zero_defect", "2026-08-01"), badge("mvp", "2026-09-10"), badge("one_shot", "2026-08-15")];
    const insights = computeInsights(evals, badges, []);
    expect(insights.latestBadge?.badgeType).toBe("mvp");
  });

  it("surfaces the worst-failing SLA rule as the top focus area", () => {
    const evals = [
      evaluation("e2", "2026-09-02", [metric({ sla_rule_id: "r-bad", sla_rule: { id: "r-bad", name: "Bad Rule", metric_type: "quality", eval_type: "ticket", target_value: "" }, value_string: "Fail" })]),
      evaluation("e1", "2026-09-01", [metric({ sla_rule_id: "r-bad", sla_rule: { id: "r-bad", name: "Bad Rule", metric_type: "quality", eval_type: "ticket", target_value: "" }, value_string: "Fail" })]),
    ];
    const insights = computeInsights(evals, [], []);
    expect(insights.topFocusArea?.name).toBe("Bad Rule");
    expect(insights.topFocusArea?.failCount).toBe(2);
  });
});
