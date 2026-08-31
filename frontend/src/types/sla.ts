export interface SLARule {
  id: string;
  name: string;
  metric_type: string;
  eval_type: string;
  target_value: string;
  // Optional structured form of target_value (e.g. "<= 2 rounds/PR" -> operator "<=", numeric
  // 2), used by Focus Areas to compute an actual numeric gap-to-target. Absent for rules that
  // haven't been given a structured target.
  target_operator?: "" | ">=" | "<=" | "=";
  target_numeric?: number | null;
  scope?: string;
  is_active?: boolean;
}

export interface MetricInput {
  sla_rule_id: string;
  value_numeric: string;
  value_string: string;
  comment: string;
  is_enabled: boolean;
}
