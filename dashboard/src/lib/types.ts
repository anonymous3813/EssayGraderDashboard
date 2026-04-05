export interface CriteriaDiff {
  name: string;
  real: number;
  ai: number | null;
  possible: number;
  diff: number | null;
  reasoning: string;
}

export interface EssayResult {
  essay_id: string;
  essay_name: string;
  prompt: string;
  error: boolean;
  real_total: number;
  ai_total: number;
  total_possible: number;
  total_diff: number;
  criteria_diffs: Record<string, CriteriaDiff>;
  strengths: string;
  areas_for_improvement: string;
  final_feedback: string;
}

export interface CriteriaMetric {
  name: string;
  n: number;
  mae: number;
  mean_bias: number;
  exact_pct: number;
}

export interface RunMetrics {
  n: number;
  failed: number;
  mae: number;
  rmse: number;
  exact_pct: number;
  close_pct: number;
  mean_bias: number;
  problematic: EssayResult[];
  criteria: Record<string, CriteriaMetric>;
}

export interface MultishotExample {
  score_level: 'high' | 'medium' | 'low';
  essay_prompt: string;
}

export interface RunMetadata {
  timestamp: string;
  system_instructions: string;
  rubric: string;
  multishot_examples: MultishotExample[];
}

export interface Run {
  id: string;         
  metadata: RunMetadata;
  metrics: RunMetrics;
  essays: Record<string, EssayResult>;
}