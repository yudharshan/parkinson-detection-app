/**
 * App-wide constants: API base URL, routes, task config.
 */

export const constants = {
  api: {
   baseUrl: 'http://10.122.91.75:5000/api'
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
