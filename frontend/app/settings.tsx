import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import client from '../src/services/api/client';

function Row({ label, value, highlight, small }: { label: string; value: string; highlight?: boolean; small?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, highlight && styles.rowValueHi, small && styles.rowValueSm]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [conn, setConn] = useState<'checking' | 'online' | 'offline'>('checking');
  const [store, setStore] = useState('');

  const checkConn = async () => {
    setConn('checking');
    try {
      const res = await client.get('/health', { timeout: 6000 });
      setStore(res.data?.store || '');
      setConn('online');
    } catch {
      setConn('offline');
    }
  };

  useEffect(() => { checkConn(); }, []);

  const onLogout = () => {
    Alert.alert('Sign Out', 'Sign out of NeuroTrack?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await logout(); router.replace('/login'); } },
    ]);
  };

  const apiUrl = (client.defaults.baseURL as string) || '—';
  const isDoctor = user?.role === 'clinician';
  const dotColor = conn === 'online' ? '#5B7044' : conn === 'offline' ? '#B0503B' : '#C2922F';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <View>
            <Text style={styles.appName}>NeuroTrack</Text>
            <Text style={styles.version}>v1.0.0 · Research prototype</Text>
          </View>
        </View>

        <Text style={styles.section}>Account</Text>
        <View style={styles.card}>
          <Row label="Name" value={user?.name || '—'} />
          <Row label="Role" value={isDoctor ? 'Doctor (verified)' : 'Patient'} />
          {!isDoctor && <Row label="Patient ID" value={user?.patientCode || '—'} highlight />}
          {!isDoctor && (
            <Text style={styles.hint}>Share your Patient ID with your doctor so they can monitor your results.</Text>
          )}
        </View>

        <Text style={styles.section}>Server connection</Text>
        <View style={styles.card}>
          <Row label="API endpoint" value={apiUrl} small />
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: dotColor }]} />
            <Text style={styles.statusText}>
              {conn === 'checking' ? 'Checking…'
                : conn === 'online' ? `Connected (${store} store)`
                : 'Offline — is the backend running on :5000?'}
            </Text>
          </View>
          <Pressable style={styles.secondaryBtn} onPress={checkConn}>
            <Text style={styles.secondaryBtnText}>Re-check connection</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>About</Text>
        <View style={styles.card}>
          <Text style={styles.about}>
            NeuroTrack estimates Parkinsonian motor symptoms from a finger-tapping test and a
            resting-tremor test using the phone's sensors and an ML model served over FastAPI.
          </Text>
          <Text style={styles.disclaimer}>
            ⚠️ Research prototype, not a medical device. Scores come from a small, proxy-labeled
            dataset and must not be used for diagnosis. Always consult a clinician.
          </Text>
        </View>

        <Pressable style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F1E6' },
  container: { padding: 24, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 28 },
  logo: { width: 56, height: 56 },
  appName: { fontSize: 24, fontWeight: '900', color: '#3A2E25' },
  version: { fontSize: 13, color: '#8A7765', marginTop: 2 },
  section: { fontSize: 13, fontWeight: '800', color: '#8A7765', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, marginBottom: 24, borderWidth: 1, borderColor: '#EFE7D8' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  rowLabel: { fontSize: 15, color: '#6B5848' },
  rowValue: { fontSize: 15, fontWeight: '600', color: '#3A2E25', maxWidth: '60%' },
  rowValueHi: { fontSize: 20, fontWeight: '900', letterSpacing: 1, color: '#B26A43' },
  rowValueSm: { fontSize: 12, color: '#8A7765' },
  hint: { fontSize: 12, color: '#8A7765', marginTop: 6, lineHeight: 17 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 14, color: '#5C4A3A', fontWeight: '600' },
  secondaryBtn: { marginTop: 14, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#EFE7D8' },
  secondaryBtnText: { color: '#6B5848', fontWeight: '700', fontSize: 13 },
  about: { fontSize: 14, color: '#5C4A3A', lineHeight: 20 },
  disclaimer: { fontSize: 13, color: '#8C3322', lineHeight: 18, marginTop: 12, backgroundColor: '#F6EAE2', padding: 12, borderRadius: 10 },
  logoutBtn: { backgroundColor: '#B0503B', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  logoutText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
