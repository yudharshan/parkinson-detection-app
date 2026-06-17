import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Dimensions, Alert } from 'react-native';
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
        const [histRes, dailyRes] = await Promise.all([
          client.get(`/tests/history/${user?.userId}`),
          client.get(`/tests/daily-pattern/${user?.userId}`)
        ]);

        if (histRes.data?.success && dailyRes.data?.success) {
          setHistory(histRes.data.data);
          setDailyPattern(dailyRes.data.data);
        } else {
          setErrorMsg('Failed to load assessment history.');
        }

        // Fetch Off Periods for last 7 days
        const endDay = new Date();
        const startDay = new Date();
        startDay.setDate(endDay.getDate() - 6);
        const startStr = startDay.toISOString().split('T')[0];
        const endStr = endDay.toISOString().split('T')[0];

        const offRes = await client.get(`/analysis/off-period/${user?.userId}/range?start=${startStr}&end=${endStr}`);
        if (offRes.data?.success) {
          setOffPeriods(offRes.data.data);
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
          <ActivityIndicator size="large" color="#0A84FF" />
          <Text style={styles.loadingText}>Fetching clinical logs...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMsg) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
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
          return { bg: '#FFCDD2', text: '#C62828' };
        case 'Needs Monitoring':
          return { bg: '#FFE0B2', text: '#E65100' };
        case 'Stable':
          return { bg: '#DCEDC8', text: '#2E7D32' };
        default:
          return { bg: '#F1F5F9', text: '#64748B' };
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
            <Ionicons name="log-out-outline" size={24} color="#0F172A" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
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
    if (score === undefined) return { label: 'No Data', bg: '#F1F5F9', text: '#64748B' };
    if (score <= 0.45) return { label: 'Low', bg: '#DCEDC8', text: '#2E7D32' };
    if (score <= 0.75) return { label: 'Moderate', bg: '#FFE0B2', text: '#E65100' };
    return { label: 'High (OFF)', bg: '#FFCDD2', text: '#C62828' };
  };

  const tappingBadge = getSeverityBadge(latestTapping?.severityScore ?? latestTapping?.score);
  const tremorBadge = getSeverityBadge(latestTremor?.severityScore ?? latestTremor?.score);

  // --- Graph 1 (Severity Over Time) Data Prep ---
  const hasChart1Data = tappingTests.length > 0 || tremorTests.length > 0;
  const lineChartData = {
    labels: history.slice(0, 5).reverse().map(s => {
      const d = new Date(s.timestamp || s.createdAt);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    }),
    datasets: [
      {
        data: tappingTests.slice(0, 5).reverse().map(s => s.severityScore || s.score || 0),
        color: (opacity = 1) => `rgba(10, 132, 255, ${opacity})`,
        strokeWidth: 2
      },
      {
        data: tremorTests.slice(0, 5).reverse().map(s => s.severityScore || s.score || 0),
        color: (opacity = 1) => `rgba(235, 87, 87, ${opacity})`,
        strokeWidth: 2
      }
    ],
    legend: ['Tapping', 'Tremor']
  };

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
    if (history.length < 2) return { text: 'Insufficient Data', icon: 'help-outline', color: '#64748B' };
    
    const limit = trendRange === 'week' ? 7 : 30;
    const windowTests = history.slice(0, limit);
    if (windowTests.length < 2) return { text: 'Insufficient Data', icon: 'help-outline', color: '#64748B' };

    const mid = Math.floor(windowTests.length / 2);
    const older = windowTests.slice(mid);
    const newer = windowTests.slice(0, mid);

    const avgOlder = older.reduce((sum, t) => sum + (t.severityScore || t.score || 0), 0) / older.length;
    const avgNewer = newer.reduce((sum, t) => sum + (t.severityScore || t.score || 0), 0) / newer.length;

    const diff = avgNewer - avgOlder;

    if (diff >= 0.1) return { text: 'Worsening Trend', icon: 'arrow-up-circle-outline', color: '#EF4444' };
    if (diff <= -0.1) return { text: 'Improving Trend', icon: 'arrow-down-circle-outline', color: '#10B981' };
    return { text: 'Stable Symptoms', icon: 'trending-flat-outline', color: '#3B82F6' };
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
          <Ionicons name="log-out-outline" size={24} color="#0F172A" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Test Cards (Patient Flow: Section 6) */}
        <View style={styles.testSectionRow}>
          <Pressable 
            style={styles.testCard} 
            onPress={() => router.push('/reaction/new')}
          >
            <View style={styles.testCardHeader}>
              <Ionicons name="finger-print-outline" size={28} color="#0A84FF" />
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
              <Ionicons name="pulse-outline" size={28} color="#EB5757" />
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
            <LineChart
              data={lineChartData}
              width={screenWidth - 48}
              height={200}
              chartConfig={{
                backgroundColor: '#FFFFFF',
                backgroundGradientFrom: '#FFFFFF',
                backgroundGradientTo: '#FFFFFF',
                decimalPlaces: 2,
                color: (opacity = 1) => `rgba(15, 23, 42, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
                propsForBackgroundLines: { strokeWidth: 1, stroke: '#F1F5F9' },
                propsForDots: { r: '4' }
              }}
              bezier
              style={styles.chart}
            />
          ) : (
            <View style={styles.emptyChart}>
              <Text style={styles.emptyText}>Perform assessments to generate timecharts.</Text>
            </View>
          )}
        </View>

        {/* Graph 2: Daily Pattern */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Daily Medication Pattern</Text>
          <Text style={styles.cardSub}>Averages severity across time-of-day buckets to monitor wear-off cycles.</Text>
          {hasChart2Data ? (
            <BarChart
              data={barChartData}
              width={screenWidth - 48}
              height={200}
              yAxisLabel=""
              yAxisSuffix=""
              chartConfig={{
                backgroundColor: '#FFFFFF',
                backgroundGradientFrom: '#FFFFFF',
                backgroundGradientTo: '#FFFFFF',
                decimalPlaces: 2,
                color: (opacity = 1) => `rgba(10, 132, 255, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
                propsForBackgroundLines: { strokeWidth: 0 }
              }}
              style={styles.chart}
            />
          ) : (
            <View style={styles.emptyChart}>
              <Text style={styles.emptyText}>Not enough data to map daily fluctuations.</Text>
            </View>
          )}
        </View>

        {/* Graph 3: Off-Period Calendar strip */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Medication Off-Period Strip</Text>
          <Text style={styles.cardSub}>Requires both a Before and After test on the same calendar day.</Text>
          
          <View style={styles.calendarStrip}>
            {offPeriods.length === 0 ? (
              <Text style={styles.emptyText}>No historical off-periods registered this week.</Text>
            ) : (
              offPeriods.map((day, idx) => {
                const getStripColor = (status: string) => {
                  if (status === 'Good ON State') return '#10B981';
                  if (status === 'Normal Wear-Off') return '#F59E0B';
                  if (status === 'ABNORMAL OFF-PERIOD') return '#EF4444';
                  return '#CBD5E1';
                };

                return (
                  <Pressable
                    key={day.date}
                    style={[styles.calendarCell, { backgroundColor: getStripColor(day.status) }]}
                    onPress={() => setSelectedOffPeriodDay(day)}
                  >
                    <Text style={styles.calendarDateText}>{new Date(day.date).getDate()}</Text>
                  </Pressable>
                );
              })
            )}
          </View>

          {selectedOffPeriodDay && (
            <View style={styles.offPeriodDetail}>
              <Text style={styles.offDetailTitle}>Off-Period Analysis ({new Date(selectedOffPeriodDay.date).toLocaleDateString()})</Text>
              <Text style={styles.offDetailStatus}>{selectedOffPeriodDay.status}</Text>
              
              {selectedOffPeriodDay.status !== 'INSUFFICIENT_DATA' ? (
                <View style={styles.offDetailRow}>
                  <Text style={styles.offDetailText}>Before Med Severity: {selectedOffPeriodDay.beforeScore?.toFixed(2)}</Text>
                  <Text style={styles.offDetailText}>After Med Severity: {selectedOffPeriodDay.afterScore?.toFixed(2)}</Text>
                  <Text style={styles.offDetailText}>Delta Shift: {selectedOffPeriodDay.delta?.toFixed(2)}</Text>
                </View>
              ) : (
                <Text style={styles.offDetailReason}>{selectedOffPeriodDay.message}</Text>
              )}
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { fontSize: 16, color: '#64748B', marginTop: 12, fontWeight: '600' },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#EF4444', marginTop: 16 },
  errorText: { fontSize: 15, color: '#64748B', textAlign: 'center', marginTop: 8, marginBottom: 24 },
  retryBtn: { backgroundColor: '#0A84FF', paddingVertical: 12, paddingHorizontal: 28, borderRadius: 10, marginBottom: 12 },
  retryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  logoutBtn: { paddingVertical: 12 },
  logoutBtnText: { color: '#EF4444', fontSize: 15, fontWeight: '700' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16 },
  greeting: { fontSize: 24, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: '#64748B', marginTop: 2 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  scrollContainer: { padding: 24, paddingBottom: 48 },
  sectionHeader: { fontSize: 20, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  sectionSub: { fontSize: 14, color: '#64748B', marginBottom: 20 },
  rosterCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 18, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1, borderWidth: 1, borderColor: '#F1F5F9' },
  rosterInfo: { flex: 1 },
  patientName: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  lastTestDate: { fontSize: 13, color: '#64748B', marginTop: 4 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
  emptyText: { color: '#64748B', fontSize: 15, textAlign: 'center' },
  testSectionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  testCard: { flex: 0.48, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  testCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  testCardTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  testCardVal: { fontSize: 28, fontWeight: '800', color: '#0F172A' },
  testCardLabel: { fontSize: 12, color: '#64748B', marginTop: 2 },
  smallBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  smallBadgeText: { fontSize: 10, fontWeight: '700' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1, borderWidth: 1, borderColor: '#F1F5F9' },
  trendHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  cardSub: { fontSize: 13, color: '#64748B', marginTop: 2, marginBottom: 12 },
  toggleRow: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 8, padding: 2 },
  toggleBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  toggleBtnActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  toggleText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  toggleTextActive: { color: '#0A84FF', fontWeight: '700' },
  trendRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  trendValue: { fontSize: 22, fontWeight: '800', marginLeft: 8 },
  trendDesc: { fontSize: 13, color: '#64748B', lineHeight: 18 },
  chart: { marginVertical: 8, borderRadius: 16 },
  emptyChart: { height: 150, alignItems: 'center', justifyContent: 'center' },
  calendarStrip: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 12 },
  calendarCell: { flex: 1, height: 44, borderRadius: 8, marginHorizontal: 2, alignItems: 'center', justifyContent: 'center' },
  calendarDateText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  offPeriodDetail: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  offDetailTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  offDetailStatus: { fontSize: 15, fontWeight: '800', color: '#0A84FF', marginVertical: 4 },
  offDetailRow: { marginTop: 4 },
  offDetailText: { fontSize: 13, color: '#475569', marginVertical: 2 },
  offDetailReason: { fontSize: 13, color: '#64748B', lineHeight: 18, marginTop: 4 }
});
