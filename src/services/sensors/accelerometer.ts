/**
 * Accelerometer data collection via expo-sensors.
 * Returns data in models/accelerometer shape with timestamps.
 */

import { Accelerometer } from 'expo-sensors';
import type { AccelerometerSample } from '@/models';

const DEFAULT_INTERVAL_MS = 50; // ~20 Hz

export type AccelerometerSubscription = {
  unsubscribe: () => void;
};

export function subscribeAccelerometer(
  onSample: (sample: AccelerometerSample) => void,
  intervalMs: number = DEFAULT_INTERVAL_MS
): AccelerometerSubscription {
  Accelerometer.setUpdateInterval(intervalMs);
  const subscription = Accelerometer.addListener((data) => {
    onSample({
      x: data.x,
      y: data.y,
      z: data.z,
      timestamp: Date.now(),
    });
  });
  return {
    unsubscribe: () => subscription.remove(),
  };
}

/** Motion magnitude (in G) from x,y,z. */
export function magnitude(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}
