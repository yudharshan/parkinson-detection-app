/**
 * App-wide constants: API base URL, routes, task config.
 */

export const constants = {
  api: {
    baseUrl: 'http://192.168.29.82:5000',
  },
  storageKeys: {
    sessions: 'neurotrack_sessions',
  },
  taskConfig: {
    accelerometer: { defaultDurationMs: 30_000, targetSampleRateHz: 50 },
    reaction: { numTrials: 10, minDelayMs: 1000, maxDelayMs: 3000 },
    tracing: { defaultDurationMs: 60_000 },
  },
} as const;
