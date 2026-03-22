import { submitSession } from '@/services/api/client';
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  subscribeAccelerometer,
  magnitude,
} from '@/services/sensors/accelerometer';
import { saveSession } from '@/services/storage/sessions';
import { generateId } from '@/utils';
import type { AccelerometerSample, AccelerometerSessionPayload, Session } from '@/models';

const RECORD_DURATION_MS = 10_000;
const SAMPLE_INTERVAL_MS = 50; // ~20 Hz target

export default function TremorTestScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'recording' | 'saving' | 'done'>('idle');
  const [samples, setSamples] = useState<AccelerometerSample[]>([]);
  const [liveMagnitude, setLiveMagnitude] = useState<number>(0);
  const [countdownSec, setCountdownSec] = useState(10);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const startTimeRef = useRef<number>(0);
  const samplesRef = useRef<AccelerometerSample[]>([]);
  const subscriptionRef = useRef<ReturnType<typeof subscribeAccelerometer> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = () => {
    setSavedSessionId(null);
    setSamples([]);
    samplesRef.current = [];
    setLiveMagnitude(0);
    setCountdownSec(10);
    startTimeRef.current = Date.now();
    setStatus('recording');

    const sub = subscribeAccelerometer((sample) => {
      samplesRef.current.push(sample);
      setSamples((prev) => [...prev, sample]);
      setLiveMagnitude(magnitude(sample.x, sample.y, sample.z));
    }, SAMPLE_INTERVAL_MS);
    subscriptionRef.current = sub;

    const endTime = startTimeRef.current + RECORD_DURATION_MS;
    const countdown = setInterval(() => {
      const left = Math.ceil((endTime - Date.now()) / 1000);
      setCountdownSec(Math.max(0, left));
      if (Date.now() >= endTime) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        sub.unsubscribe();
        subscriptionRef.current = null;
        const captured = [...samplesRef.current];
        setSamples(captured);
        setStatus('saving');

        const durationMs = Date.now() - startTimeRef.current;
        const sampleRateHz =
          durationMs > 0 ? (captured.length / durationMs) * 1000 : undefined;
        const payload: AccelerometerSessionPayload = {
          samples: captured,
          durationMs,
          sampleRateHz: sampleRateHz ? Math.round(sampleRateHz * 10) / 10 : undefined,
        };
        const session: Session<AccelerometerSessionPayload> = {
          id: generateId(),
          taskType: 'accelerometer',
          startedAt: new Date(startTimeRef.current).toISOString(),
          endedAt: new Date().toISOString(),
          payload,
        };
        saveSession(session)
          .then(async () => {
    
            console.log("📤 Sending data to  Backend...");   
            const response = await submitSession('/api/analyze', session);
    
            if (response.ok) {
              console.log("✅ TERMINAL SHOULD BARK NOW!");
            }
            setSavedSessionId(session.id);
            setStatus('done');
          })
          .catch(() => setStatus('done'));
      }
    }, 100);
    timerRef.current = countdown;
  };

  useEffect(() => {
    return () => {
      subscriptionRef.current?.unsubscribe();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const isRecording = status === 'recording';
  const isSaving = status === 'saving';
  const isDone = status === 'done';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.title}>Tremor Test</Text>
        <Text style={styles.subtitle}>
          Hold your device still. Recording runs for 10 seconds.
        </Text>

        <View style={styles.magnitudeCard}>
          <Text style={styles.magnitudeLabel}>Live motion magnitude</Text>
          <Text style={styles.magnitudeValue}>
            {isRecording || isSaving
              ? liveMagnitude.toFixed(3)
              : isDone
                ? (samples.length
                    ? magnitude(
                        samples[samples.length - 1].x,
                        samples[samples.length - 1].y,
                        samples[samples.length - 1].z
                      ).toFixed(3)
                    : '—')
                : '—'}
          </Text>
          <Text style={styles.magnitudeUnit}>G</Text>
        </View>

        {isRecording && (
          <View style={styles.countdownWrap}>
            <Text style={styles.countdownLabel}>Time remaining</Text>
            <Text style={styles.countdownValue}>{countdownSec}s</Text>
          </View>
        )}

        {isSaving && (
          <View style={styles.savingWrap}>
            <ActivityIndicator size="large" color="#0A84FF" />
            <Text style={styles.savingText}>Saving…</Text>
          </View>
        )}

        {isDone && (
          <View style={styles.doneWrap}>
            <Text style={styles.doneTitle}>Recording saved</Text>
            <Text style={styles.doneMeta}>
              {samples.length} samples ·{' '}
              {samples.length > 0
                ? (
                    (samples.length / 10) as number
                  ).toFixed(1)
                : '—'}{' '}
              Hz
            </Text>
            {savedSessionId && (
              <Text style={styles.doneId}>ID: {savedSessionId}</Text>
            )}
          </View>
        )}

        <Pressable
          style={[styles.primaryButton, (isRecording || isSaving) && styles.primaryButtonDisabled]}
          onPress={startRecording}
          disabled={isRecording || isSaving}
          accessibilityRole="button"
          accessibilityLabel={isDone ? 'Record again' : 'Start 10 second recording'}
        >
          <Text style={styles.primaryButtonText}>
            {isRecording
              ? 'Recording…'
              : isSaving
                ? 'Saving…'
                : isDone
                  ? 'Record again'
                  : 'Start recording (10 s)'}
          </Text>
        </Pressable>

        {isDone && (
          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back to tasks"
          >
            <Text style={styles.secondaryButtonText}>Back to tasks</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7FA' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 },
  title: { fontSize: 26, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  subtitle: { fontSize: 17, color: '#64748B', marginBottom: 24 },
  magnitudeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    alignItems: 'center',
  },
  magnitudeLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  magnitudeValue: { fontSize: 42, fontWeight: '700', color: '#1A1A1A' },
  magnitudeUnit: { fontSize: 20, color: '#64748B', marginTop: 4 },
  countdownWrap: { alignItems: 'center', marginBottom: 24 },
  countdownLabel: { fontSize: 16, color: '#64748B', marginBottom: 4 },
  countdownValue: { fontSize: 32, fontWeight: '700', color: '#0A84FF' },
  savingWrap: { alignItems: 'center', marginBottom: 24 },
  savingText: { fontSize: 18, color: '#64748B', marginTop: 12 },
  doneWrap: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  doneTitle: { fontSize: 20, fontWeight: '700', color: '#1B5E20', marginBottom: 4 },
  doneMeta: { fontSize: 16, color: '#2E7D32' },
  doneId: { fontSize: 14, color: '#4A5568', marginTop: 8 },
  primaryButton: {
    backgroundColor: '#0A84FF',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  secondaryButton: {
    marginTop: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButtonText: { fontSize: 18, fontWeight: '600', color: '#0A84FF' },
});
