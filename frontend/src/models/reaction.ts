/**
 * Reaction time test data model.
 * Structured for ML: per-trial latencies and optional accuracy for
 * cognitive/motor speed features alongside tremor.
 */

/** One reaction trial: stimulus onset and response timing. */
export interface ReactionTrial {
  trialIndex: number;
  /** Unix ms when stimulus was shown. */
  stimulusShownAt: number;
  /** Unix ms when user responded. */
  responseAt: number;
  /** responseAt - stimulusShownAt. Redundant but convenient for ML. */
  reactionTimeMs: number;
  /** Optional: for go/no-go or correct/incorrect tasks. */
  correct?: boolean;
  /** Optional: trial type for multi-condition experiments. */
  trialType?: string;
}

/**
 * Full reaction test payload for storage and ML API.
 * Summary stats are derived but stored for quick display and validation.
 */
export interface ReactionTestPayload {
  trials: ReactionTrial[];
  totalTrials: number;
  durationMs: number;
  meanReactionTimeMs?: number;
  medianReactionTimeMs?: number;
  /** Optional: standard deviation for outlier detection. */
  stdReactionTimeMs?: number;
  /** Optional: e.g. "simple", "choice", "go_nogo". */
  taskVariant?: string;
}

/** Session-shaped reaction data ready for ML API. */
export interface ReactionTestData {
  id: string;
  userId?: string;
  taskType: 'reaction';
  startedAt: string;
  endedAt?: string;
  deviceInfo?: import('./session').DeviceInfo;
  payload: ReactionTestPayload;
}

// Legacy alias.
export type ReactionSessionPayload = ReactionTestPayload;
