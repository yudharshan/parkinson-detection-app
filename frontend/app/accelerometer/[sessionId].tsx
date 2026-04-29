import { submitSession } from '@/services/api/client';
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Switch } from 'react-native';
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
const SAMPLE_INTERVAL_MS = 50; 

export default function TremorTestScreen() {
  const router = useRouter();
  
  // --- States ---
  const [status, setStatus] = useState<'idle' | 'recording' | 'saving' | 'done'>('idle');
  const [samples, setSamples] = useState<AccelerometerSample[]>([]);
  const [liveMagnitude, setLiveMagnitude] = useState<number>(0);
  const [countdownSec, setCountdownSec] = useState(10);
  const [isMedsOn, setIsMedsOn] = useState(false); 
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);

  // --- Refs ---
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

    // Start Sensor
    const sub = subscribeAccelerometer((sample) => {
      samplesRef.current.push(sample);
      setLiveMagnitude(magnitude(sample.x, sample.y, sample.z));
    }, SAMPLE_INTERVAL_MS);
    subscriptionRef.current = sub;

    const endTime = startTimeRef.current + RECORD_DURATION_MS;
    
    // Start Timer
    const countdown = setInterval(() => {
      const left = Math.ceil((endTime - Date.now()) / 1000);
      setCountdownSec(Math.max(0, left));

      if (Date.now() >= endTime) {
        stopAndUpload(sub, startTimeRef.current);
      }
    }, 100);
    timerRef.current = countdown;
  };

  const stopAndUpload = async (sub: any, startTime: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    sub.unsubscribe();
    subscriptionRef.current = null;

    const captured = [...samplesRef.current];
    setSamples(captured);
    setStatus('saving');

    const durationMs = Date.now() - startTime;
    const payload: AccelerometerSessionPayload = {
      samples: captured,
      durationMs,
    };

    const session: Session<AccelerometerSessionPayload> = {
      id: generateId(),
      taskType: 'accelerometer',
      startedAt: new Date(startTime).toISOString(),
      endedAt: new Date().toISOString(),
      payload,
    };

    try {
      await saveSession(session);

      console.log("📤 Forwarding to Node.js Backend...");
      const response = await submitSession('/sessions/analyze', {
        taskType: 'accelerometer',
        medicationStatus: isMedsOn ? 'ON' : 'OFF',
        payload: { samples: captured }
      });

      if (response.ok) {
        console.log("✅ AI Score Received:", response.data);
        
        // 🔥 FIXED NAVIGATION PATH & PARAMS
        router.push({
          pathname: '/accelerometer/results', 
          params: { 
            score: response.data.data.score, 
            severity: response.data.data.risk_level 
          }
        });
      }
      
      setSavedSessionId(session.id);
      setStatus('done');
    } catch (error) {
      console.error("Upload failed:", error);
      setStatus('done');
    }
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
        <Text style={styles.title}>Tremor Assessment</Text>
        
        <View style={styles.medsRow}>
          <Text style={styles.medsText}>Took Medication?</Text>
          <Switch 
            value={isMedsOn} 
            onValueChange={setIsMedsOn} 
            trackColor={{ false: "#ccc", true: "#0A84FF" }}
          />
          <Text style={{fontWeight: 'bold'}}>{isMedsOn ? "ON" : "OFF"}</Text>
        </View>

        <View style={styles.magnitudeCard}>
          <Text style={styles.magnitudeLabel}>Live motion magnitude</Text>
          <Text style={styles.magnitudeValue}>
            {isRecording || isSaving ? liveMagnitude.toFixed(3) : '0.000'}
          </Text>
          <Text style={styles.magnitudeUnit}>G</Text>
        </View>

        {isRecording && (
          <View style={styles.countdownWrap}>
            <Text style={styles.countdownValue}>{countdownSec}s</Text>
          </View>
        )}

        {isSaving && (
          <View style={styles.savingWrap}>
            <ActivityIndicator size="large" color="#0A84FF" />
            <Text style={styles.savingText}>Analyzing with AI…</Text>
          </View>
        )}

        <Pressable
          style={[styles.primaryButton, (isRecording || isSaving) && styles.primaryButtonDisabled]}
          onPress={startRecording}
          disabled={isRecording || isSaving}
        >
          <Text style={styles.primaryButtonText}>
            {isRecording ? 'Recording…' : isSaving ? 'Analyzing…' : 'Start 10s Test'}
          </Text>
        </Pressable>

        {isDone && (
          <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryButtonText}>Back to Dashboard</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7FA' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 },
  title: { fontSize: 26, fontWeight: '700', color: '#1A1A1A', marginBottom: 20 },
  medsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, backgroundColor: '#fff', padding: 15, borderRadius: 12 },
  medsText: { fontSize: 16, color: '#1A1A1A' },
  magnitudeCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 24, marginBottom: 24, alignItems: 'center', elevation: 2 },
  magnitudeLabel: { fontSize: 16, color: '#64748B', marginBottom: 8 },
  magnitudeValue: { fontSize: 42, fontWeight: '700', color: '#1A1A1A' },
  magnitudeUnit: { fontSize: 20, color: '#64748B' },
  countdownWrap: { alignItems: 'center', marginBottom: 24 },
  countdownValue: { fontSize: 48, fontWeight: '700', color: '#0A84FF' },
  savingWrap: { alignItems: 'center', marginBottom: 24 },
  savingText: { fontSize: 18, color: '#64748B', marginTop: 12 },
  primaryButton: { backgroundColor: '#0A84FF', paddingVertical: 18, borderRadius: 12, alignItems: 'center' },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  secondaryButton: { marginTop: 20, alignItems: 'center' },
  secondaryButtonText: { fontSize: 16, color: '#0A84FF', fontWeight: '600' },
});