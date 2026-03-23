/**
 * Shape tracing task data model.
 * Structured for ML: spatial and temporal features (path smoothness,
 * deviation from template, speed) for motor control / tremor assessment.
 */

/** Single point in a stroke. Coordinates in same space as bounds. */
export interface TracingPoint {
  x: number;
  y: number;
  /** Unix time in milliseconds. Enables velocity/smoothness features. */
  timestamp: number;
  /** Optional: normalized 0–1 if provided by client. */
  pressure?: number;
}

/** One continuous stroke (finger down → move → finger up). */
export interface TracingStroke {
  points: TracingPoint[];
  strokeIndex: number;
}

/**
 * Full shape tracing payload for storage and ML API.
 * bounds + templateId allow backend to normalize coordinates and compare to reference.
 */
export interface ShapeTracingPayload {
  strokes: TracingStroke[];
  /** Which template was shown (e.g. "circle", "spiral_left"). */
  templateId?: string;
  durationMs: number;
  /** Canvas size so backend can normalize x,y to 0–1 or same scale across devices. */
  bounds?: { width: number; height: number };
  /** Optional: reference path for deviation metrics. Leave to backend if needed. */
  templateBounds?: { width: number; height: number };
}

/** Session-shaped tracing data ready for ML API. */
export interface ShapeTracingData {
  id: string;
  userId?: string;
  taskType: 'tracing';
  startedAt: string;
  endedAt?: string;
  deviceInfo?: import('./session').DeviceInfo;
  payload: ShapeTracingPayload;
}

// Legacy aliases for in-app code.
export type TracingSessionPayload = ShapeTracingPayload;
