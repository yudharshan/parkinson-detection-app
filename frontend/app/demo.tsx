import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { submitSession } from '../src/services/api/client';
import { useAuth } from '../src/context/AuthContext';

/**
 * Demo / replay screen — generates realistic synthetic samples for a chosen profile
 * and runs them through the real pipeline (Node gateway -> FastAPI ML). Lets the app
 * demonstrably produce a result + populate the History graph WITHOUT needing phone
 * sensors, so it can be recorded on any device/emulator/web.
 */

type Profile = 'healthy' | 'impaired';

function generateTapping(profile: Profile) {
  const taps: any[] = [];
  const dur = 20;
  const meanInterval = profile === 'healthy' ? 0.12 : 0.45;
  const jitter = profile === 'healthy' ? 0.02 : 0.18;
  const missP = profile === 'healthy' ? 0.03 : 0.12;
  let t = profile === 'healthy' ? 0.15 : 0.4;
  let side = 0;
  while (t < dur) {
    if (Math.random() < missP) {
      taps.push({ TapTimeStamp: +t.toFixed(4), TappedButtonId: 'TappedButtonNone', TapCoordinate: '{190, 400}' });
    }
    const btn = side === 0 ? 'TappedButtonLeft' : 'TappedButtonRight';
    taps.push({ TapTimeStamp: +t.toFixed(4), TappedButtonId: btn, TapCoordinate: side === 0 ? '{80, 420}' : '{300, 420}' });
    if (!(profile === 'impaired' && Math.random() < 0.25)) side = 1 - side; // impaired sometimes fails to alternate
    let step = meanInterval + (Math.random() * 2 - 1) * jitter;
    if (profile === 'impaired' && Math.random() < 0.05) step += 1.2; // occasional motor freeze
    t += Math.max(0.05, step);
  }
  return taps;
}

function generateTremor(profile: Profile) {
  const samples: any[] = [];
  const fs = 100, dur = 20, n = fs * dur;
  const noise = () => (Math.random() * 2 - 1) * 0.002; // very still hand for the healthy baseline
  for (let i = 0; i < n; i++) {
    const t = i / fs;
    let x = noise(), y = noise(), z = -0.98 + noise();
    if (profile === 'impaired') {
      const a = 0.15; // ~5 Hz resting tremor
      x += a * Math.sin(2 * Math.PI * 5 * t);
      y += a * Math.cos(2 * Math.PI * 5 * t);
    }
    samples.push({ x: +x.toFixed(4), y: +y.toFixed(4), z: +z.toFixed(4), timestamp: +t.toFixed(3) });
  }
  return samples;
}

export default function DemoScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (profile: Profile) => {
    setStatus('running');
    setError(null);
    const medTimepoint = profile === 'healthy'
      ? "I don't take Parkinson medications"
      : 'Immediately before Parkinson medication';
    try {
      const tap = await submitSession('/test/tapping', { userId: user?.userId, rawTaps: generateTapping(profile), medTimepoint });
      const trem = await submitSession('/test/tremor', { userId: user?.userId, rawSamples: generateTremor(profile), medTimepoint });
      if (!tap.ok || !trem.ok) {
        setError('Server/ML unavailable. Ensure FastAPI (:8000) and the backend (:5000) are running.');
        setStatus('idle');
        return;
      }
      const tapScore = tap.data.data.severityScore;
      const tremScore = trem.data.data.severityScore;
      setResult({
        profile, tapScore, tremScore, combined: (tapScore + tremScore) / 2,
        tapFeatures: tap.data.data.rawFeatures || {},
        tremFeatures: trem.data.data.rawFeatures || {},
      });
      setStatus('done');
    } catch (e: any) {
      setError(e?.message || 'Demo failed');
      setStatus('idle');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Demo Mode</Text>
        <Text style={styles.desc}>
          Runs simulated tapping + tremor samples through the real ML pipeline — no
          sensors needed. Great for a quick walkthrough.
        </Text>

        {status === 'running' && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#B26A43" />
            <Text style={styles.loading}>Generating samples and running ML models…</Text>
          </View>
        )}

        {status !== 'running' && (
          <>
            <Pressable style={[styles.btn, styles.healthy]} onPress={() => run('healthy')}>
              <Text style={styles.btnText}>Simulate Healthy Profile</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.impaired]} onPress={() => run('impaired')}>
              <Text style={styles.btnText}>Simulate Parkinsonian Profile</Text>
            </Pressable>
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        {status === 'done' && result && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {result.profile === 'healthy' ? 'Healthy' : 'Parkinsonian'} profile result
            </Text>
            <Row label="Tapping symptom score" value={result.tapScore} />
            <Row label="Tremor symptom score" value={result.tremScore} />
            <Row label="Combined session score" value={result.combined} bold />

            <FeatureBlock title="Tapping features (extracted live)" feats={result.tapFeatures} />
            <FeatureBlock title="Tremor features (extracted live)" feats={result.tremFeatures} />

            <Pressable style={styles.linkBtn} onPress={() => router.push('/(tabs)/history')}>
              <Text style={styles.linkText}>View History Graph →</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  const color = value > 0.66 ? '#9C3E2C' : value > 0.4 ? '#A86A1E' : '#5B7044';
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && { fontWeight: '800', color: '#3A2E25' }]}>{label}</Text>
      <Text style={[styles.rowVal, { color }]}>{value.toFixed(2)}</Text>
    </View>
  );
}

function FeatureBlock({ title, feats }: { title: string; feats: Record<string, number> }) {
  const entries = Object.entries(feats || {});
  if (entries.length === 0) return null;
  return (
    <View style={styles.featBlock}>
      <Text style={styles.featTitle}>{title}</Text>
      {entries.map(([k, v]) => (
        <View key={k} style={styles.featRow}>
          <Text style={styles.featKey}>{k}</Text>
          <Text style={styles.featVal}>{typeof v === 'number' ? Number(v).toFixed(4) : String(v)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F1E6' },
  container: { padding: 24 },
  title: { fontSize: 28, fontWeight: '800', color: '#3A2E25', marginBottom: 8 },
  desc: { fontSize: 15, color: '#8A7765', lineHeight: 22, marginBottom: 28 },
  center: { alignItems: 'center', paddingVertical: 40 },
  loading: { marginTop: 16, color: '#5C4A3A', fontWeight: '600' },
  btn: { borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginBottom: 16 },
  healthy: { backgroundColor: '#5B7044' },
  impaired: { backgroundColor: '#B0503B' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  error: { color: '#B0503B', marginTop: 16, fontWeight: '600', textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginTop: 24, borderWidth: 1, borderColor: '#EFE7D8' },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#3A2E25', marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EFE7D8' },
  rowLabel: { fontSize: 15, color: '#6B5848' },
  rowVal: { fontSize: 18, fontWeight: '800' },
  linkBtn: { marginTop: 18, alignItems: 'center' },
  linkText: { color: '#B26A43', fontWeight: '700', fontSize: 15 },
  featBlock: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#EFE7D8', paddingTop: 12 },
  featTitle: { fontSize: 13, fontWeight: '800', color: '#6B5848', marginBottom: 6 },
  featRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  featKey: { fontSize: 12, color: '#8A7765' },
  featVal: { fontSize: 12, color: '#3A2E25', fontWeight: '600' },
});
