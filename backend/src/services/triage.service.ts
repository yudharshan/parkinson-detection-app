/**
 * triage.service.ts — the ONLY place this logic lives
 * 
 * Rules:
 * - Evaluates the last 10 tests (or all available tests up to 10).
 * - slope = average severity of the most recent half - average severity of the older half.
 * - slope >= 0.25 -> Worsening (red)
 * - slope >= 0.10 -> Needs Monitoring (yellow)
 * - Otherwise -> Stable (green)
 * - Fewer than 2 tests -> Insufficient Data (gray)
 */

export interface TriageResult {
  status: "Stable" | "Needs Monitoring" | "Worsening" | "Insufficient Data";
  reason: string;
  slope?: number;
}

export function classifyGrowthTrend(recentTests: { severityScore: number; date: string | Date }[]): TriageResult {
  if (!recentTests || recentTests.length < 2) {
    return {
      status: "Insufficient Data",
      reason: "Fewer than 2 tests completed. More data is required to establish a trend baseline."
    };
  }

  // Sort tests by date ascending to ensure proper time alignment
  const sortedTests = [...recentTests].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  // Take the last 10 tests if there are more
  const testWindow = sortedTests.slice(-10);
  const len = testWindow.length;
  const mid = Math.floor(len / 2);

  const olderHalf = testWindow.slice(0, mid);
  const recentHalf = testWindow.slice(mid);

  const avgOlder = olderHalf.reduce((sum, t) => sum + t.severityScore, 0) / olderHalf.length;
  const avgRecent = recentHalf.reduce((sum, t) => sum + t.severityScore, 0) / recentHalf.length;

  const slope = parseFloat((avgRecent - avgOlder).toFixed(4));

  let status: "Stable" | "Needs Monitoring" | "Worsening";
  let reason = "";

  if (slope >= 0.25) {
    status = "Worsening";
    reason = `Severity rose by ${(slope * 100).toFixed(1)}% over the last ${len} tests.`;
  } else if (slope >= 0.10) {
    status = "Needs Monitoring";
    reason = `Severity increased slightly by ${(slope * 100).toFixed(1)}% over the last ${len} tests.`;
  } else {
    status = "Stable";
    reason = `Severity trend is stable (change of ${(slope * 100).toFixed(1)}%) over the last ${len} tests.`;
  }

  return {
    status,
    reason,
    slope
  };
}
