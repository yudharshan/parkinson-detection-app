/**
 * severity.service.ts — the ONLY place this logic lives
 * 
 * Rules:
 * severity = base_ensemble_confidence + a fixed offset depending on medTimepoint
 * Clamped between 0.0 and 1.0.
 */

export interface SeverityResult {
  severityScore: number;
  baseConfidence: number;
  appliedOffset: number;
  interpretation: "Low symptoms (good)" | "Moderate symptoms" | "High symptoms (OFF)";
}

export function calculateSeverity(baseConfidence: number, medTimepoint: string): SeverityResult {
  let appliedOffset = 0.0;

  // Apply fixed expert-system offsets
  if (medTimepoint === "Immediately before Parkinson medication") {
    appliedOffset = 0.20;
  } else if (medTimepoint === "Just after Parkinson medication (at your best)") {
    appliedOffset = 0.00;
  } else {
    appliedOffset = 0.00;
  }

  const rawScore = baseConfidence + appliedOffset;
  const severityScore = Math.max(0.0, Math.min(1.0, parseFloat(rawScore.toFixed(4))));

  let interpretation: "Low symptoms (good)" | "Moderate symptoms" | "High symptoms (OFF)";
  if (severityScore <= 0.45) {
    interpretation = "Low symptoms (good)";
  } else if (severityScore <= 0.75) {
    interpretation = "Moderate symptoms";
  } else {
    interpretation = "High symptoms (OFF)";
  }

  return {
    severityScore,
    baseConfidence,
    appliedOffset,
    interpretation
  };
}
