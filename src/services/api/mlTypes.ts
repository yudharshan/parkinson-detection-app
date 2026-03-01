/**
 * ML API response types for tremor (and future) classification.
 */

export type RiskLevel = 'low' | 'moderate' | 'high';

export interface MLAssessmentResult {
  risk_level: RiskLevel;
  confidence_score: number; // 0–1
}
