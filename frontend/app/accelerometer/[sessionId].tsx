import { submitSession } from '../../src/services/api/client';
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  subscribeAccelerometer,
  magnitude,
} from '../../src/services/sensors/accelerometer';
import { saveSession } from '../../src/services/storage/sessions';
import { generateId } from '../../src/utils';
import type { AccelerometerSample, AccelerometerSessionPayload, Session } from '../../src/models';
import { useAuth } from '../../src/context/AuthContext';

const RECORD_DURATION_MS = 20_000; // 20s
// ~100 Hz to match the training data. At the old 10 Hz the Nyquist limit (5 Hz)
// could not even capture the 4-6 Hz Parkinsonian tremor band -> a train/serve mismatch.
const SAMPLE_INTERVAL_MS = 10;

export default function TremorTestScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  // --- States ---
  const [phase, setPhase] = useState<'instructions' | 'recording' | 'uploading'>('instructions');
  const [medTimepoint, setMedTimepoint] = useState<string>('Immediately before Parkinson medication');
  const [samples, setSamples] = useState<AccelerometerSample[]>([]);
  const [liveMagnitude, setLiveMagnitude] = useState<number>(0);
  const [countdownSec, setCountdownSec] = useState(20);

  // --- Refs ---
  const startTimeRef = useRef<number>(0);
  const samplesRef = useRef<AccelerometerSample[]>([]);
  const subscriptionRef = useRef<ReturnType<typeof subscribeAccelerometer> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = () => {
    setSamples([]);
    samplesRef.current = [];
    setLiveMagnitude(0);
    setCountdownSec(20);
    startTimeRef.current = Date.now();
    setPhase('recording');

    // Start Sensor
    const sub = subscribeAccelerometer((sample) => {
      // Map format exactly: {"x": 0.216, "y": -0.244, "z": -0.956, "timestamp": 6522.763}
      const rawSample = {
        x: parseFloat(sample.x.toFixed(4)),
        y: parseFloat(sample.y.toFixed(4)),
        z: parseFloat(sample.z.toFixed(4)),
        timestamp: parseFloat(((Date.now() - startTimeRef.current) / 1000).toFixed(3))
      } as any;

      samplesRef.current.push(rawSample);
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
    setPhase('uploading');

    try {
      console.log("📤 Forwarding to Clinical Gateway /test/tremor...");
      const response = await submitSession('/test/tremor', {
        userId: user?.userId,
        rawSamples: captured,
        medTimepoint
      });

      if (response.ok && response.data) {
        console.log("✅ AI Score Received:", response.data);
        
        router.push({
          pathname: '/results',
          params: {
            testType: 'tremor',
            severityScore: response.data.data.severityScore,
            interpretation: response.data.data.interpretation,
            features: JSON.stringify(response.data.data.rawFeatures || {}),
          }
        });
      } else {
        Alert.alert('Analysis Failed', response.error?.message || 'Server failed to analyze tremor test.', [
          { text: 'OK', onPress: () => setPhase('instructions') }
        ]);
      }
    } catch (error) {
      console.error("Upload failed:", error);
      Alert.alert('Connection Error', 'Could not reach analysis gateway.', [
        { text: 'OK', onPress: () => setPhase('instructions') }
      ]);
    }
  };

  useEffect(() => {
    return () => {
      subscriptionRef.current?.unsubscribe();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (phase === 'instructions') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.title}>Tremor Test</Text>
          <Text style={styles.desc}>
            Hold the phone flat and still in the palm of your hand for 20 seconds. Keep your hand as steady as possible.
          </Text>

          <View style={styles.section}>
            <Text style={styles.label}>Select Medication State *</Text>
            
            <Pressable
              style={[
                styles.optionBtn,
                medTimepoint === 'Immediately before Parkinson medication' && styles.optionBtnSelected,
              ]}
              onPress={() => setMedTimepoint('Immediately before Parkinson medication')}
            >
              <Text style={[
                styles.optionText,
                medTimepoint === 'Immediately before Parkinson medication' && styles.optionTextSelected,
              ]}>
                Immediately before Medication (OFF)
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.optionBtn,
                medTimepoint === 'Just after Parkinson medication (at your best)' && styles.optionBtnSelected,
              ]}
              onPress={() => setMedTimepoint('Just after Parkinson medication (at your best)')}
            >
              <Text style={[
                styles.optionText,
                medTimepoint === 'Just after Parkinson medication (at your best)' && styles.optionTextSelected,
              ]}>
                Just after Medication (ON)
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.optionBtn,
                medTimepoint === 'Other / Regular State' && styles.optionBtnSelected,
              ]}
              onPress={() => setMedTimepoint('Other / Regular State')}
            >
              <Text style={[
                styles.optionText,
                medTimepoint === 'Other / Regular State' && styles.optionTextSelected,
              ]}>
                Other / Regular State
              </Text>
            </Pressable>
          </View>

          <Pressable style={styles.primaryButton} onPress={startRecording}>
            <Text style={styles.primaryButtonText}>Start 20s Test</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'uploading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, styles.center]}>
          <ActivityIndicator size="large" color="#B26A43" />
          <Text style={styles.loadingText}>Uploading raw sensor data to gateway...</Text>
          <Text style={styles.loadingSubtext}>Extracting features and running ML ensemble models...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Recording Tremor</Text>
        <Text style={styles.subtitle}>Hold the phone flat and still</Text>

        <View style={styles.magnitudeCard}>
          <Text style={styles.magnitudeLabel}>Live motion magnitude</Text>
          <Text style={styles.magnitudeValue}>
            {liveMagnitude.toFixed(3)}
          </Text>
          <Text style={styles.magnitudeUnit}>G</Text>
        </View>

        <View style={styles.countdownWrap}>
          <Text style={styles.countdownValue}>{countdownSec}s</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F1E6' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32, justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: '#3A2E25', marginBottom: 12, textAlign: 'center' },
  desc: { fontSize: 16, color: '#8A7765', lineHeight: 24, textAlign: 'center', marginBottom: 32 },
  section: { marginBottom: 32 },
  label: { fontSize: 15, fontWeight: '700', color: '#5C4A3A', marginBottom: 12, textAlign: 'center' },
  optionBtn: { backgroundColor: '#FFFFFF', borderColor: '#D9CBB8', borderWidth: 1, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, marginBottom: 12, alignItems: 'center' },
  optionBtnSelected: { backgroundColor: '#B26A43', borderColor: '#B26A43' },
  optionText: { fontSize: 15, color: '#6B5848', fontWeight: '600' },
  optionTextSelected: { color: '#FFFFFF' },
  subtitle: { fontSize: 16, color: '#8A7765', textAlign: 'center', marginBottom: 24 },
  magnitudeCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, marginBottom: 24, alignItems: 'center', shadowColor: '#3A2E25', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2, borderWidth: 1, borderColor: '#EFE7D8' },
  magnitudeLabel: { fontSize: 16, color: '#8A7765', marginBottom: 8 },
  magnitudeValue: { fontSize: 48, fontWeight: '700', color: '#3A2E25' },
  magnitudeUnit: { fontSize: 20, color: '#8A7765' },
  countdownWrap: { alignItems: 'center', marginBottom: 24 },
  countdownValue: { fontSize: 56, fontWeight: '900', color: '#B26A43' },
  primaryButton: { backgroundColor: '#B26A43', paddingVertical: 18, borderRadius: 12, alignItems: 'center' },
  primaryButtonText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  loadingText: { fontSize: 18, color: '#3A2E25', fontWeight: '700', marginTop: 20, textAlign: 'center' },
  loadingSubtext: { fontSize: 14, color: '#8A7765', marginTop: 8, textAlign: 'center' }
});