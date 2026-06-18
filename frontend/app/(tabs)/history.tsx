import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, ActivityIndicator, Pressable } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useAuth } from '../../src/context/AuthContext';
import client from '../../src/services/api/client';
import { Ionicons } from '@expo/vector-icons';

const medLabel = (m?: string) => {
  if (!m) return 'Not specified';
  if (m.includes("don't take")) return 'No medications';
  if (m.includes('Immediately before')) return 'Before meds (OFF)';
  if (m.includes('Just after')) return 'After meds (ON)';
  if (m.includes('Another time')) return 'Other time';
  return m;
};

export default function HistoryMapScreen() {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [visibleCount, setVisibleCount] = useState(7);

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

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#B26A43" />;

  if (errorMsg) {
    return (
      <View style={styles.center}>
        <Ionicons name="warning-outline" size={48} color="#B0503B" />
        <Text style={styles.errorText}>{errorMsg}</Text>
        <Pressable style={styles.retryBtn} onPress={fetchHistory}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  // Up to the last 20 sessions, oldest -> newest. Chart is horizontally scrollable.
  const recent = [...sessions].slice(0, 20).reverse();
  const chartLabels = recent.map(s => {
    const d = new Date(s.timestamp || s.createdAt);
    let h = d.getHours();
    const ampm = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    return `${d.getMonth() + 1}/${d.getDate()} ${h}${ampm}`;
  });

  const chartData = {
    labels: chartLabels.length > 0 ? chartLabels : ["No Data"],
    datasets: [
      {
        data: recent.length > 0 ? recent.map(s => s.severityScore || s.score || 0) : [0],
        color: (opacity = 1) => `rgba(178, 106, 67, ${opacity})`,
        strokeWidth: 3
      }
    ]
  };
  const chartWidth = Math.max(Dimensions.get('window').width - 48, recent.length * 70);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Symptom History</Text>
        <Text style={styles.subtitle}>Your scores over time — swipe the chart to see more</Text>
      </View>

      {sessions.length > 0 ? (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Severity Progression (Recent Runs)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <LineChart
              data={chartData}
              width={chartWidth}
              height={220}
              chartConfig={{
                backgroundColor: '#ffffff',
                backgroundGradientFrom: '#ffffff',
                backgroundGradientTo: '#ffffff',
                decimalPlaces: 2,
                color: (opacity = 1) => `rgba(178, 106, 67, ${opacity})`,
                labelColor: (opacity = 1) => `#8A7765`,
                propsForDots: { r: "5" }
              }}
              bezier
              style={styles.chart}
            />
          </ScrollView>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No test sessions completed yet.</Text>
        </View>
      )}

      <View style={styles.historySection}>
        <Text style={styles.sectionTitle}>Completed Assessments Log</Text>
        {sessions.slice(0, visibleCount).map((test, index) => (
          <View key={test._id || index} style={styles.historyRow}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowType}>
                {test.testType === 'tapping' ? 'Finger Tapping' : 'Resting Tremor'}
              </Text>
              <Text style={styles.rowDate}>
                {new Date(test.timestamp || test.createdAt).toLocaleString()}
              </Text>
              <Text style={styles.rowMed} numberOfLines={1}>State: {medLabel(test.medTimepoint)}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowScore}>{(test.severityScore ?? test.score ?? 0).toFixed(2)}</Text>
              <Text style={styles.rowInterpret}>{test.interpretation ?? test.risk_level}</Text>
            </View>
          </View>
        ))}
        {sessions.length > visibleCount && (
          <Pressable style={styles.loadMoreBtn} onPress={() => setVisibleCount(c => c + 7)}>
            <Text style={styles.loadMoreText}>Load 7 more ({sessions.length - visibleCount} older)</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F1E6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 16, color: '#B0503B', textAlign: 'center', marginVertical: 16 },
  retryBtn: { backgroundColor: '#B26A43', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 8 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700' },
  header: { padding: 24, paddingTop: 60, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EFE7D8' },
  title: { fontSize: 28, fontWeight: '800', color: '#4A3B2E' },
  subtitle: { fontSize: 16, color: '#8A7765', marginTop: 2 },
  chartCard: { margin: 24, backgroundColor: '#fff', borderRadius: 20, padding: 15, shadowColor: '#3A2E25', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2, borderWidth: 1, borderColor: '#EFE7D8' },
  chartTitle: { fontSize: 16, fontWeight: '700', marginBottom: 15, color: '#5C4A3A' },
  chart: { borderRadius: 16 },
  emptyCard: { margin: 24, backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#EFE7D8' },
  emptyText: { color: '#8A7765', fontSize: 15 },
  historySection: { paddingHorizontal: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#4A3B2E', marginBottom: 16 },
  historyRow: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#3A2E25', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1, borderWidth: 1, borderColor: '#EFE7D8' },
  rowLeft: { flex: 1 },
  rowType: { fontSize: 15, fontWeight: '700', color: '#4A3B2E' },
  rowDate: { fontSize: 12, color: '#8A7765', marginTop: 4 },
  rowMed: { fontSize: 12, color: '#6B5848', marginTop: 2 },
  rowRight: { alignItems: 'flex-end', marginLeft: 16 },
  rowScore: { fontSize: 22, fontWeight: '800', color: '#3A2E25' },
  rowInterpret: { fontSize: 12, fontWeight: '600', color: '#8A7765', marginTop: 2 },
  loadMoreBtn: { backgroundColor: '#EFE7D8', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  loadMoreText: { color: '#6B5848', fontWeight: '700', fontSize: 14 },
});