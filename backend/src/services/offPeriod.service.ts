/**
 * offPeriod.service.ts — the ONLY place this logic lives
 * 
 * Rules:
 * - Compares "before medication" to "after medication" severity scores on the same day.
 * - If both exist: delta = before - after.
 *   - delta >= 0.40 -> ABNORMAL OFF-PERIOD
 *   - delta >= 0.25 -> Normal Wear-Off
 *   - delta < 0.25 -> Good ON State
 * - If only one exists: INSUFFICIENT_DATA.
 * - If multiple exist: earliest for before, latest for after.
 */

export interface OffPeriodAnalysisResult {
  status: "ABNORMAL OFF-PERIOD" | "Normal Wear-Off" | "Good ON State" | "INSUFFICIENT_DATA";
  message: string;
  delta?: number;
  beforeScore?: number;
  afterScore?: number;
  date: string; // YYYY-MM-DD
}

export function analyzeOffPeriodForDay(tests: { severityScore: number; medTimepoint: string; timestamp: Date | string }[], dateStr: string): OffPeriodAnalysisResult {
  const beforeTests = tests.filter(t => t.medTimepoint === "Immediately before Parkinson medication");
  const afterTests = tests.filter(t => t.medTimepoint === "Just after Parkinson medication (at your best)");

  if (beforeTests.length === 0 && afterTests.length === 0) {
    return {
      status: "INSUFFICIENT_DATA",
      message: "No tests were recorded for this day.",
      date: dateStr
    };
  }

  if (beforeTests.length === 0) {
    return {
      status: "INSUFFICIENT_DATA",
      message: "Off-period analysis requires both a before-medication and after-medication test on the same day. You're missing the before-medication test for today.",
      date: dateStr
    };
  }

  if (afterTests.length === 0) {
    return {
      status: "INSUFFICIENT_DATA",
      message: "Off-period analysis requires both a before-medication and after-medication test on the same day. You're missing the after-medication test for today.",
      date: dateStr
    };
  }

  // Find earliest before-medication test
  const earliestBefore = beforeTests.reduce((earliest, current) => {
    return new Date(current.timestamp).getTime() < new Date(earliest.timestamp).getTime() ? current : earliest;
  });

  // Find latest after-medication test
  const latestAfter = afterTests.reduce((latest, current) => {
    return new Date(current.timestamp).getTime() > new Date(latest.timestamp).getTime() ? current : latest;
  });

  const beforeScore = earliestBefore.severityScore;
  const afterScore = latestAfter.severityScore;
  const delta = parseFloat((beforeScore - afterScore).toFixed(4));

  let status: "ABNORMAL OFF-PERIOD" | "Normal Wear-Off" | "Good ON State";
  let message = "";

  if (delta >= 0.40) {
    status = "ABNORMAL OFF-PERIOD";
    message = "Abnormal Off-period detected. Symptoms remain high despite medication. Please consult your physician.";
  } else if (delta >= 0.25) {
    status = "Normal Wear-Off";
    message = "Normal Wear-off. Mild symptom response visible between timepoints.";
  } else {
    status = "Good ON State";
    message = "Excellent ON state response. Symptoms are well controlled.";
  }

  return {
    status,
    message,
    delta,
    beforeScore,
    afterScore,
    date: dateStr
  };
}
