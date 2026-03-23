/**
 * ML API submission types.
 * Discriminated union by taskType for tremor classification (and future) endpoints.
 * Use these when building the request body to send to the ML API.
 */

import type { Session } from './session';
import type { TremorTestPayload } from './accelerometer';
import type { ReactionTestPayload } from './reaction';
import type { ShapeTracingPayload } from './tracing';

/** Payload union: one of tremor, reaction, or tracing. */
export type MLPayload = TremorTestPayload | ReactionTestPayload | ShapeTracingPayload;

/** Session envelope with discriminated payload for ML API. */
export type MLSession =
  | Session<TremorTestPayload>
  | Session<ReactionTestPayload>
  | Session<ShapeTracingPayload>;

/** Type guard: tremor test session. */
export function isTremorSession(s: MLSession): s is Session<TremorTestPayload> {
  return s.taskType === 'accelerometer';
}

/** Type guard: reaction test session. */
export function isReactionSession(s: MLSession): s is Session<ReactionTestPayload> {
  return s.taskType === 'reaction';
}

/** Type guard: tracing session. */
export function isTracingSession(s: MLSession): s is Session<ShapeTracingPayload> {
  return s.taskType === 'tracing';
}
