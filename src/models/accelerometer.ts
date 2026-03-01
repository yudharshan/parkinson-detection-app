/**
 * Tremor test (accelerometer) data model.
 * Structured for ML tremor classification: time-series of 3-axis acceleration
 * with consistent units and sampling metadata.
 */

/** Single accelerometer sample. Units: G (1 G ≈ 9.81 m/s²). */
export interface AccelerometerSample {
  x: number;
  y: number;
  z: number;
  /** Unix time in milliseconds. Prefer this for ML to align with other tasks. */
  timestamp: number;
}

/**
 * Full tremor test payload for storage and ML API.
 * Use sampleRateHz and durationMs for feature extraction (e.g. spectral analysis).
 */
export interface TremorTestPayload {
  /** Time-ordered samples. Required for tremor classification. */
  samples: AccelerometerSample[];
  /** Total recording length in milliseconds. */
  durationMs: number;
  /** Achieved sampling rate (Hz). Enables resampling/validation on backend. */
  sampleRateHz?: number;
  /** Optional: e.g. "rest", "postural", "kinetic" for future tremor subtypes. */
  recordingContext?: 'rest' | 'postural' | 'kinetic' | string;
  /** Optional: device orientation during recording for axis alignment. */
  deviceOrientation?: 'portrait' | 'landscape' | 'unknown';
}

/** Session-shaped tremor data ready for ML API. */
export interface TremorTestData {
  id: string;
  userId?: string;
  taskType: 'accelerometer';
  startedAt: string;
  endedAt?: string;
  deviceInfo?: import('./session').DeviceInfo;
  payload: TremorTestPayload;
}

// Legacy alias for in-app code that still uses this name.
export type AccelerometerSessionPayload = TremorTestPayload;
