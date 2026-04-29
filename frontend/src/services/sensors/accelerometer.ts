/**
 * Accelerometer data collection via expo-sensors.
 * Full integration for Parkinson's Tremor Analysis.
 */

import { Accelerometer } from 'expo-sensors';
import type { AccelerometerSample } from '@/models';
import { submitSession } from '../api/client';

const DEFAULT_INTERVAL_MS = 50; // ~20 Hz sampling

export type AccelerometerSubscription = {
  unsubscribe: () => void;
};

/**
 * Subscribes to the device's accelerometer.
 * This is the low-level listener used by the test runner.
 */
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

/** * Calculates magnitude for visual graphs or simple tracking. 
 */
export function magnitude(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

/**
 * THE MAIN TEST RUNNER
 * 1. Collects 10s of data
 * 2. Updates the UI countdown
 * 3. Sends data to Node.js backend -> Python AI
 */
export async function runTremorTest(
  isMedsOn: boolean,
  onCountdown: (seconds: number) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const samples: AccelerometerSample[] = [];
    let timeLeft = 10;
    
    // Start listening to the sensor
    const subscription = subscribeAccelerometer((sample) => {
      samples.push(sample);
    });

    // Start 1-second interval for the countdown
    const timer = setInterval(async () => {
      timeLeft -= 1;
      onCountdown(timeLeft);

      if (timeLeft <= 0) {
        // STOP the timer and the sensor immediately
        clearInterval(timer);
        subscription.unsubscribe();
        
        console.log(`Recording finished. Collected ${samples.length} samples.`);

        if (samples.length < 50) {
          reject(new Error("Insufficient data. Ensure phone was moving/active."));
          return;
        }

        try {
          // Send to the Backend endpoint we built
          const result = await submitSession('/sessions/analyze', {
            taskType: 'accelerometer',
            medicationStatus: isMedsOn ? 'ON' : 'OFF',
            lastMedicationTime: new Date().toISOString(),
            payload: { samples }
          });

          if (result.ok) {
            // Returns the AI analysis (score, severity, etc.)
            resolve(result.data);
          } else {
            reject(new Error("AI backend returned an error. Check server logs."));
          }
        } catch (err) {
          console.error("Pipeline Failure:", err);
          reject(err);
        }
      }
    }, 1000);
  });
}