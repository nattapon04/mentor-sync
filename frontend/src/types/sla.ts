export interface SLARule {
  id: string;
  name: string;
  metric_type: string;
  eval_type: string;
  target_value: string;
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
