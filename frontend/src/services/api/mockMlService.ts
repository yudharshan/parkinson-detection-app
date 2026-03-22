/**
 * Mock ML service — simulates future ML API integration.
 * Accepts test data (tremor / reaction / tracing sessions) and returns
 * risk_level and confidence_score. Replace with real API call when backend is ready.
 */

import type { MLSession, Session } from '@/models';
import type { TremorTestPayload, ReactionTestPayload, ShapeTracingPayload } from '@/models';
import { isTremorSession, isReactionSession, isTracingSession } from '@/models';
import type { MLAssessmentResult, RiskLevel } from './mlTypes';
import { magnitude } from '../sensors/accelerometer';

const MOCK_DELAY_MS = 800;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Deterministic-ish score from session id + payload for stable mock results. */
function seedFromSession(session: MLSession): number {
  let h = 0;
  const str = session.id + session.startedAt;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return (h >>> 0) / 0xffffffff;
}

function mockRiskFromSeed(seed: number): RiskLevel {
  if (seed < 0.4) return 'low';
  if (seed < 0.75) return 'moderate';
  return 'high';
}

function mockConfidenceFromSeed(seed: number): number {
  return clamp(0.6 + seed * 0.35, 0.6, 0.98);
}

/** Mock assessment from tremor payload: use variance of magnitude. */
function assessTremor(session: Session<TremorTestPayload>): MLAssessmentResult {
  const seed = seedFromSession(session);
  const { samples } = session.payload;
  let variance = 0;
  if (samples.length >= 2) {
    const mags = samples.map((s) => magnitude(s.x, s.y, s.z));
    const mean = mags.reduce((a, b) => a + b, 0) / mags.length;
    variance = mags.reduce((a, b) => a + (b - mean) ** 2, 0) / mags.length;
  }
  const extra = variance > 0.1 ? 0.15 : 0;
  const adjustedSeed = clamp(seed + extra, 0, 1);
  return {
    risk_level: mockRiskFromSeed(adjustedSeed),
    confidence_score: mockConfidenceFromSeed(adjustedSeed),
  };
}

/** Mock assessment from reaction payload: use mean reaction time. */
function assessReaction(session: Session<ReactionTestPayload>): MLAssessmentResult {
  const seed = seedFromSession(session);
  const mean = session.payload.meanReactionTimeMs ?? 300;
  const extra = mean > 500 ? 0.2 : mean > 400 ? 0.1 : 0;
  const adjustedSeed = clamp(seed + extra, 0, 1);
  return {
    risk_level: mockRiskFromSeed(adjustedSeed),
    confidence_score: mockConfidenceFromSeed(adjustedSeed),
  };
}

/** Mock assessment from tracing payload: use stroke count and point count. */
function assessTracing(session: Session<ShapeTracingPayload>): MLAssessmentResult {
  const seed = seedFromSession(session);
  const totalPoints = session.payload.strokes.reduce((n, s) => n + s.points.length, 0);
  const extra = totalPoints < 20 ? 0.15 : 0;
  const adjustedSeed = clamp(seed + extra, 0, 1);
  return {
    risk_level: mockRiskFromSeed(adjustedSeed),
    confidence_score: mockConfidenceFromSeed(adjustedSeed),
  };
}

/**
 * Simulates ML API: accepts a session and returns risk_level + confidence_score.
 * Replace the implementation with a real fetch to your ML backend when ready.
 */
export async function getMlAssessment(session: MLSession): Promise<MLAssessmentResult> {
  await new Promise((r) => setTimeout(r, MOCK_DELAY_MS));

  if (isTremorSession(session)) return assessTremor(session);
  if (isReactionSession(session)) return assessReaction(session);
  if (isTracingSession(session)) return assessTracing(session);

  const seed = seedFromSession(session);
  return {
    risk_level: mockRiskFromSeed(seed),
    confidence_score: mockConfidenceFromSeed(seed),
  };
}
