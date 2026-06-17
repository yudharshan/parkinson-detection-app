import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, ActivityIndicator, Pressable } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useAuth } from '../../src/context/AuthContext';
import client from '../../src/services/api/client';
import { Ionicons } from '@expo/vector-icons';

export default function HistoryMapScreen() {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);

  const fetchHistory = async () => {
    if (!user || !token) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);
      const response = await client.get(`/tests/history/${user?.userId}`);
      if (response.data && response.data.success) {
        setSessions(response.data.data);
      } else {
        setErrorMsg('Failed to load history.');
      }
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.response?.data?.message || 'Could not fetch history data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user, token]);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#0A84FF" />;

  if (errorMsg) {
    return (
      <View style={styles.center}>
        <Ionicons name="warning-outline" size={48} color="#EF4444" />
        <Text style={styles.errorText}>{errorMsg}</Text>
        <Pressable style={styles.retryBtn} onPress={fetchHistory}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const chartLabels = sessions.slice(0, 6).reverse().map(s => {
    const d = new Date(s.timestamp || s.createdAt);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });

  const chartData = {
    labels: chartLabels.length > 0 ? chartLabels : ["No Data"],
    datasets: [
      {
        data: sessions.slice(0, 6).reverse().map(s => s.severityScore || s.score || 0),
        color: (opacity = 1) => `rgba(10, 132, 255, ${opacity})`,
        strokeWidth: 3
      }
    ]
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Text style={styles.title}>OFF-Period Map</Text>
        <Text style={styles.subtitle}>Longitudinal Disease Progression</Text>
      </View>

      {sessions.length > 0 ? (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Severity Progression (Recent Runs)</Text>
          <LineChart
            data={chartData}
            width={Dimensions.get('window').width - 48}
            height={220}
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 2,
              color: (opacity = 1) => `rgba(10, 132, 255, ${opacity})`,
              labelColor: (opacity = 1) => `#64748B`,
              propsForDots: { r: "5" }
            }}
            bezier
            style={styles.chart}
          />
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No test sessions completed yet.</Text>
        </View>
      )}

      <View style={styles.historySection}>
        <Text style={styles.sectionTitle}>Completed Assessments Log</Text>
        {sessions.map((test, index) => (
          <View key={test._id || index} style={styles.historyRow}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowType}>
                {test.testType === 'tapping' ? 'Finger Tapping' : 'Resting Tremor'}
              </Text>
              <Text style={styles.rowDate}>
                {new Date(test.timestamp || test.createdAt).toLocaleString()}
              </Text>
              <Text style={styles.rowMed}>State: {test.medTimepoint}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowScore}>{(test.severityScore ?? test.score ?? 0).toFixed(2)}</Text>
              <Text style={styles.rowInterpret}>{test.interpretation ?? test.risk_level}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 16, color: '#EF4444', textAlign: 'center', marginVertical: 16 },
  retryBtn: { backgroundColor: '#0A84FF', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 8 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700' },
  header: { padding: 24, paddingTop: 60, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  title: { fontSize: 28, fontWeight: '800', color: '#1E293B' },
  subtitle: { fontSize: 16, color: '#64748B', marginTop: 2 },
  chartCard: { margin: 24, backgroundColor: '#fff', borderRadius: 20, padding: 15, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2, borderWidth: 1, borderColor: '#F1F5F9' },
  chartTitle: { fontSize: 16, fontWeight: '700', marginBottom: 15, color: '#334155' },
  chart: { borderRadius: 16 },
  emptyCard: { margin: 24, backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
  emptyText: { color: '#64748B', fontSize: 15 },
  historySection: { paddingHorizontal: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 16 },
  historyRow: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1, borderWidth: 1, borderColor: '#F1F5F9' },
  rowLeft: { flex: 1 },
  rowType: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  rowDate: { fontSize: 12, color: '#64748B', marginTop: 4 },
  rowMed: { fontSize: 12, color: '#475569', marginTop: 2 },
  rowRight: { alignItems: 'flex-end', marginLeft: 16 },
  rowScore: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  rowInterpret: { fontSize: 12, fontWeight: '600', color: '#64748B', marginTop: 2 }
});