import { SLARule } from "./sla";
import { User } from "./user";

export interface EvaluationMetric {
  id?: string;
  sla_rule_id: string;
  sla_rule?: SLARule;
  value_numeric: number | null;
  estimate_numeric: number | null;
  value_string: string;
  comment: string;
  is_enabled: boolean;
}

export interface Evaluation {
  id: string;
  mentee_id: string;
  evaluator_id: string;
  evaluation_type: string;
  reference_id: string;
  mentee?: User;
  evaluator?: User;
  metrics?: EvaluationMetric[];
  created_at: string;
}
