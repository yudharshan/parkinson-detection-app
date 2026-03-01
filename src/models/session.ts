/**
 * Shared session metadata for all task types.
 * Used for storage, export, and ML API submission.
 * Keep a single envelope so the backend can validate and route by taskType.
 */

export type TaskType = 'accelerometer' | 'reaction' | 'tracing';

/** Device and app context for ML pipeline (e.g. normalization, quality checks). */
export interface DeviceInfo {
  model?: string;
  osVersion?: string;
  platform?: 'ios' | 'android';
  appVersion?: string;
}

export interface SessionMeta {
  id: string;
  userId?: string;
  taskType: TaskType;
  startedAt: string; // ISO 8601
  endedAt?: string;
  deviceInfo?: DeviceInfo;
}

export interface Session<T> extends SessionMeta {
  payload: T;
}
