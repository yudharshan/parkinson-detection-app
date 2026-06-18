import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Dimensions, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import client from '../../src/services/api/client';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';

const screenWidth = Dimensions.get('window').width;

interface PatientRosterItem {
  patientId: string;
  name: string;
  status: 'Stable' | 'Needs Monitoring' | 'Worsening' | 'Insufficient Data';
  reason: string;
  lastTestDate: string | null;
}

export default function HomeDashboardScreen() {
  const router = useRouter();
  const { user, token, logout } = useAuth();
  const isClinician = user?.role === 'clinician';

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- Clinician States ---
  const [roster, setRoster] = useState<PatientRosterItem[]>([]);
  const [linkCode, setLinkCode] = useState('');
  const [linking, setLinking] = useState(false);

  // --- Patient States ---
  const [history, setHistory] = useState<any[]>([]);
  const [dailyPattern, setDailyPattern] = useState<any>(null);
  const [offPeriods, setOffPeriods] = useState<any[]>([]);
  const [trendRange, setTrendRange] = useState<'week' | 'month'>('week');
  const [selectedOffPeriodDay, setSelectedOffPeriodDay] = useState<any | null>(null);

  const fetchData = async () => {
    if (!user || !token) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);

      if (isClinician) {
        // Fetch Clinician Roster
        const response = await client.get(`/clinician/roster/${user?.userId}`);
        if (response.data && response.data.success) {
          setRoster(response.data.data);
        } else {
          setErrorMsg('Failed to load roster data.');
        }
      } else {
        // Fetch Patient Data
        const histRes = await client.get(`/tests/history/${user?.userId}`);
        if (histRes.data?.success) {
          setHistory(histRes.data.data);
        } else {
          setErrorMsg('Failed to load assessment history.');
        }
      }
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.response?.data?.message || 'Could not connect to clinical server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, token, isClinician]);

  const handleLinkPatient = async () => {
    if (!linkCode.trim()) return;
    setLinking(true);
    try {
      const res = await client.post('/clinician/link', { patientCode: linkCode.trim().toUpperCase() });
      if (res.data?.success) {
        Alert.alert('Linked', `Patient ${res.data.data.name} added to your roster.`);
        setLinkCode('');
        fetchData();
      } else {
        Alert.alert('Not found', res.data?.message || 'No patient with that ID.');
      }
    } catch (e: any) {
      Alert.alert('Not found', e.response?.data?.message || 'No patient with that ID.');
    } finally {
      setLinking(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await logout();
        router.replace('/login');
      }}
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#B26A43" />
          <Text style={styles.loadingText}>Fetching clinical logs...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMsg) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#B0503B" />
          <Text style={styles.errorTitle}>Network Connection Offline</Text>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <Pressable style={styles.retryBtn} onPress={fetchData}>
            <Text style={styles.retryBtnText}>Retry Connection</Text>
          </Pressable>
          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutBtnText}>Sign Out</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ==========================================
  // CLINICIAN HOME VIEW
  // ==========================================
  if (isClinician) {
    const getBadgeStyle = (status: PatientRosterItem['status']) => {
      switch (status) {
        case 'Worsening':
          return { bg: '#ECCCC0', text: '#9C3E2C' };
        case 'Needs Monitoring':
          return { bg: '#EBD9B4', text: '#A86A1E' };
        case 'Stable':
          return { bg: '#E3E8CD', text: '#5B7044' };
        default:
          return { bg: '#EFE7D8', text: '#8A7765' };
      }
    };

    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Clinician Workspace</Text>
            <Text style={styles.subtitle}>Welcome back, Dr. {user?.name}</Text>
          </View>
          <Pressable style={styles.iconBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#3A2E25" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Add a patient</Text>
            <Text style={styles.cardSub}>Enter the Patient ID your patient shares with you.</Text>
            <View style={styles.linkRow}>
              <TextInput
                style={styles.linkInput}
                placeholder="PT-XXXXXX"
                placeholderTextColor="#A99A88"
                value={linkCode}
                onChangeText={setLinkCode}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Pressable style={styles.linkBtn} onPress={handleLinkPatient} disabled={linking}>
                <Text style={styles.linkBtnText}>{linking ? '…' : 'Add'}</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.sectionHeader}>Patient Triage Roster</Text>
          <Text style={styles.sectionSub}>Sorted by alert status. Select a patient for historical analysis.</Text>

          {roster.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No patients assigned to your clinical dashboard.</Text>
            </View>
          ) : (
            roster.map((item) => {
              const badge = getBadgeStyle(item.status);
              return (
                <Pressable
                  key={item.patientId}
                  style={styles.rosterCard}
                  onPress={() => router.push(`/clinician/${item.patientId}`)}
                >
                  <View style={styles.rosterInfo}>
                    <Text style={styles.patientName}>{item.name}</Text>
                    {item.lastTestDate ? (
                      <Text style={styles.lastTestDate}>
                        Last tested: {new Date(item.lastTestDate).toLocaleDateString()}
                      </Text>
                    ) : (
                      <Text style={styles.lastTestDate}>No tests recorded</Text>
                    )}
                  </View>

                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                      {item.status}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ==========================================
  // PATIENT HOME VIEW (Symptom Monitoring)
  // ==========================================
  const tappingTests = history.filter(s => s.testType === 'tapping');
  const tremorTests = history.filter(s => s.testType === 'tremor');
  
  const latestTapping = tappingTests[0];
  const latestTremor = tremorTests[0];

  // Colors based on severity scores
  const getSeverityBadge = (score?: number) => {
    if (score === undefined) return { label: 'No Data', bg: '#EFE7D8', text: '#8A7765' };
    if (score < 0.4) return { label: 'Low', bg: '#E3E8CD', text: '#5B7044' };
    if (score <= 0.65) return { label: 'Inconclusive', bg: '#EBD9B4', text: '#A86A1E' };
    return { label: 'Elevated', bg: '#ECCCC0', text: '#9C3E2C' };
  };

  const tappingBadge = getSeverityBadge(latestTapping?.severityScore ?? latestTapping?.score);
  const tremorBadge = getSeverityBadge(latestTremor?.severityScore ?? latestTremor?.score);

  // --- Graph 1 (Severity Over Time) Data Prep --- up to last 20, horizontally scrollable
  const hasChart1Data = tappingTests.length > 0 || tremorTests.length > 0;
  const fmtTime = (s: any) => {
    const d = new Date(s.timestamp || s.createdAt);
    let h = d.getHours();
    const ampm = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    return `${d.getMonth() + 1}/${d.getDate()} ${h}${ampm}`;
  };
  const recentHist = [...history].slice(0, 20).reverse();
  const tapData = tappingTests.slice(0, 20).reverse().map(s => s.severityScore || s.score || 0);
  const tremData = tremorTests.slice(0, 20).reverse().map(s => s.severityScore || s.score || 0);
  const lineDatasets: any[] = [];
  if (tapData.length) lineDatasets.push({ data: tapData, color: (o = 1) => `rgba(178, 106, 67, ${o})`, strokeWidth: 2 });
  if (tremData.length) lineDatasets.push({ data: tremData, color: (o = 1) => `rgba(193, 107, 78, ${o})`, strokeWidth: 2 });
  if (!lineDatasets.length) lineDatasets.push({ data: [0] });
  const lineChartData = {
    labels: recentHist.length ? recentHist.map(fmtTime) : ['No Data'],
    datasets: lineDatasets,
    legend: tapData.length && tremData.length ? ['Tapping', 'Tremor'] : tapData.length ? ['Tapping'] : ['Tremor'],
  };
  const dashChartWidth = Math.max(screenWidth - 48, recentHist.length * 70);

  // --- Graph 2 (Daily Pattern) Data Prep ---
  const hasChart2Data = dailyPattern && (dailyPattern.morning?.count > 0 || dailyPattern.afternoon?.count > 0 || dailyPattern.evening?.count > 0 || dailyPattern.night?.count > 0);
  const barChartData = {
    labels: ['Morning', 'Afternoon', 'Evening', 'Night'],
    datasets: [{
      data: dailyPattern ? [
        dailyPattern.morning?.avgSeverity || 0,
        dailyPattern.afternoon?.avgSeverity || 0,
        dailyPattern.evening?.avgSeverity || 0,
        dailyPattern.night?.avgSeverity || 0
      ] : [0, 0, 0, 0]
    }]
  };

  // --- Graph 4 (Long-Term Trend) Data Prep ---
  const computeTrend = () => {
    if (history.length < 2) return { text: 'Insufficient Data', icon: 'help-outline', color: '#8A7765' };
    
    const limit = trendRange === 'week' ? 7 : 30;
    const windowTests = history.slice(0, limit);
    if (windowTests.length < 2) return { text: 'Insufficient Data', icon: 'help-outline', color: '#8A7765' };

    const mid = Math.floor(windowTests.length / 2);
    const older = windowTests.slice(mid);
    const newer = windowTests.slice(0, mid);

    const avgOlder = older.reduce((sum, t) => sum + (t.severityScore || t.score || 0), 0) / older.length;
    const avgNewer = newer.reduce((sum, t) => sum + (t.severityScore || t.score || 0), 0) / newer.length;

    const diff = avgNewer - avgOlder;

    if (diff >= 0.1) return { text: 'Worsening Trend', icon: 'arrow-up-circle-outline', color: '#B0503B' };
    if (diff <= -0.1) return { text: 'Improving Trend', icon: 'arrow-down-circle-outline', color: '#6E8B5A' };
    return { text: 'Stable Symptoms', icon: 'trending-flat-outline', color: '#B26A43' };
  };

  const trendResult = computeTrend();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Hello, {user?.name}</Text>
          <Text style={styles.subtitle}>Symptom Monitoring Dashboard</Text>
        </View>
        <Pressable style={styles.iconBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#3A2E25" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>

        {/* Shareable Patient ID for doctor linking */}
        <View style={styles.idCard}>
          <Text style={styles.idLabel}>Your Patient ID</Text>
          <Text style={styles.idValue}>{user?.patientCode || '—'}</Text>
          <Text style={styles.idHint}>Share this with your doctor so they can monitor your results.</Text>
        </View>

        {/* Test Cards (Patient Flow: Section 6) */}
        <View style={styles.testSectionRow}>
          <Pressable 
            style={styles.testCard} 
            onPress={() => router.push('/reaction/new')}
          >
            <View style={styles.testCardHeader}>
              <Ionicons name="finger-print-outline" size={28} color="#B26A43" />
              <View style={[styles.smallBadge, { backgroundColor: tappingBadge.bg }]}>
                <Text style={[styles.smallBadgeText, { color: tappingBadge.text }]}>{tappingBadge.label}</Text>
              </View>
            </View>
            <Text style={styles.testCardTitle}>Tapping Test</Text>
            <Text style={styles.testCardVal}>
              {latestTapping ? (latestTapping.severityScore || latestTapping.score).toFixed(2) : '—'}
            </Text>
            <Text style={styles.testCardLabel}>Last score</Text>
          </Pressable>

          <Pressable 
            style={styles.testCard} 
            onPress={() => router.push('/accelerometer/new')}
          >
            <View style={styles.testCardHeader}>
              <Ionicons name="pulse-outline" size={28} color="#C16B4E" />
              <View style={[styles.smallBadge, { backgroundColor: tremorBadge.bg }]}>
                <Text style={[styles.smallBadgeText, { color: tremorBadge.text }]}>{tremorBadge.label}</Text>
              </View>
            </View>
            <Text style={styles.testCardTitle}>Tremor Test</Text>
            <Text style={styles.testCardVal}>
              {latestTremor ? (latestTremor.severityScore || latestTremor.score).toFixed(2) : '—'}
            </Text>
            <Text style={styles.testCardLabel}>Last score</Text>
          </Pressable>
        </View>

        {/* Graph 4: Long Term Trend Block */}
        <View style={styles.card}>
          <View style={styles.trendHeader}>
            <Text style={styles.cardTitle}>Symptom Trajectory</Text>
            <View style={styles.toggleRow}>
              <Pressable
                style={[styles.toggleBtn, trendRange === 'week' && styles.toggleBtnActive]}
                onPress={() => setTrendRange('week')}
              >
                <Text style={[styles.toggleText, trendRange === 'week' && styles.toggleTextActive]}>7D</Text>
              </Pressable>
              <Pressable
                style={[styles.toggleBtn, trendRange === 'month' && styles.toggleBtnActive]}
                onPress={() => setTrendRange('month')}
              >
                <Text style={[styles.toggleText, trendRange === 'month' && styles.toggleTextActive]}>30D</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.trendRow}>
            <Ionicons name={trendResult.icon as any} size={36} color={trendResult.color} />
            <Text style={[styles.trendValue, { color: trendResult.color }]}>
              {trendResult.text}
            </Text>
          </View>
          <Text style={styles.trendDesc}>
            Calculated as a clinical slope comparison between the older and newer halves of tests in the window.
          </Text>
        </View>

        {/* Graph 1: Severity Over Time */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Severity Over Time</Text>
          <Text style={styles.cardSub}>Shows score tracking for Tapping vs Accelerometer tests.</Text>
          {hasChart1Data ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <LineChart
                data={lineChartData}
                width={dashChartWidth}
                height={200}
                chartConfig={{
                  backgroundColor: '#FFFFFF',
                  backgroundGradientFrom: '#FFFFFF',
                  backgroundGradientTo: '#FFFFFF',
                  decimalPlaces: 2,
                  color: (opacity = 1) => `rgba(58, 46, 37, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(138, 119, 101, ${opacity})`,
                  propsForBackgroundLines: { strokeWidth: 1, stroke: '#EFE7D8' },
                  propsForDots: { r: '4' }
                }}
                bezier
                style={styles.chart}
              />
            </ScrollView>
          ) : (
            <View style={styles.emptyChart}>
              <Text style={styles.emptyText}>Perform assessments to generate timecharts.</Text>
            </View>
          )}
        </View>


      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F1E6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { fontSize: 16, color: '#8A7765', marginTop: 12, fontWeight: '600' },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#B0503B', marginTop: 16 },
  errorText: { fontSize: 15, color: '#8A7765', textAlign: 'center', marginTop: 8, marginBottom: 24 },
  retryBtn: { backgroundColor: '#B26A43', paddingVertical: 12, paddingHorizontal: 28, borderRadius: 10, marginBottom: 12 },
  retryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  logoutBtn: { paddingVertical: 12 },
  logoutBtnText: { color: '#B0503B', fontSize: 15, fontWeight: '700' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16 },
  greeting: { fontSize: 24, fontWeight: '800', color: '#3A2E25', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: '#8A7765', marginTop: 2 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EFE7D8', alignItems: 'center', justifyContent: 'center' },
  scrollContainer: { padding: 24, paddingBottom: 48 },
  sectionHeader: { fontSize: 20, fontWeight: '700', color: '#3A2E25', marginBottom: 2 },
  sectionSub: { fontSize: 14, color: '#8A7765', marginBottom: 20 },
  rosterCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 18, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#3A2E25', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1, borderWidth: 1, borderColor: '#EFE7D8' },
  rosterInfo: { flex: 1 },
  patientName: { fontSize: 16, fontWeight: '700', color: '#3A2E25' },
  lastTestDate: { fontSize: 13, color: '#8A7765', marginTop: 4 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#EFE7D8' },
  emptyText: { color: '#8A7765', fontSize: 15, textAlign: 'center' },
  testSectionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  testCard: { flex: 0.48, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#EFE7D8', shadowColor: '#3A2E25', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  testCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  testCardTitle: { fontSize: 16, fontWeight: '800', color: '#3A2E25', marginBottom: 4 },
  testCardVal: { fontSize: 28, fontWeight: '800', color: '#3A2E25' },
  testCardLabel: { fontSize: 12, color: '#8A7765', marginTop: 2 },
  smallBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  smallBadgeText: { fontSize: 10, fontWeight: '700' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#3A2E25', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1, borderWidth: 1, borderColor: '#EFE7D8' },
  trendHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#3A2E25' },
  cardSub: { fontSize: 13, color: '#8A7765', marginTop: 2, marginBottom: 12 },
  toggleRow: { flexDirection: 'row', backgroundColor: '#EFE7D8', borderRadius: 8, padding: 2 },
  toggleBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  toggleBtnActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  toggleText: { fontSize: 12, color: '#8A7765', fontWeight: '600' },
  toggleTextActive: { color: '#B26A43', fontWeight: '700' },
  trendRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  trendValue: { fontSize: 22, fontWeight: '800', marginLeft: 8 },
  trendDesc: { fontSize: 13, color: '#8A7765', lineHeight: 18 },
  chart: { marginVertical: 8, borderRadius: 16 },
  emptyChart: { height: 150, alignItems: 'center', justifyContent: 'center' },
  calendarStrip: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 12 },
  calendarCell: { flex: 1, height: 44, borderRadius: 8, marginHorizontal: 2, alignItems: 'center', justifyContent: 'center' },
  calendarDateText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  offPeriodDetail: { backgroundColor: '#F7F1E6', borderRadius: 10, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#E7DBC9' },
  offDetailTitle: { fontSize: 14, fontWeight: '700', color: '#3A2E25' },
  offDetailStatus: { fontSize: 15, fontWeight: '800', color: '#B26A43', marginVertical: 4 },
  offDetailRow: { marginTop: 4 },
  offDetailText: { fontSize: 13, color: '#6B5848', marginVertical: 2 },
  offDetailReason: { fontSize: 13, color: '#8A7765', lineHeight: 18, marginTop: 4 },
  linkRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  linkInput: { flex: 1, backgroundColor: '#F7F1E6', borderWidth: 1, borderColor: '#D9CBB8', borderRadius: 10, padding: 12, fontSize: 15, color: '#3A2E25' },
  linkBtn: { backgroundColor: '#B26A43', borderRadius: 10, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  linkBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  idCard: { backgroundColor: '#B26A43', borderRadius: 16, padding: 20, marginBottom: 20 },
  idLabel: { color: '#F7E9DE', fontSize: 13, fontWeight: '600' },
  idValue: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', letterSpacing: 1, marginVertical: 4 },
  idHint: { color: '#F1DFD2', fontSize: 12 },
});
