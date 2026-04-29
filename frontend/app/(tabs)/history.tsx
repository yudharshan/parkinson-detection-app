import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { getSessions } from '@/services/storage/sessions'; // Or your API call to MongoDB

export default function HistoryMapScreen() {
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState<any>(null);

  useEffect(() => {
    // In a real demo, you'd fetch this from your Node backend
    // For now, we'll simulate the "Long-term Map" logic
    setTimeout(() => {
      setHistoryData({
        labels: ["Jan", "Feb", "Mar", "Apr"],
        datasets: [
          {
            data: [0.2, 0.35, 0.5, 0.7], // Tremor Confidence trending up
            color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`, // Red (Tremor)
            strokeWidth: 3
          },
          {
            data: [0.1, 0.2, 0.4, 0.6], // Tapping Dysrhythmia trending up
            color: (opacity = 1) => `rgba(10, 132, 255, ${opacity})`, // Blue (Tapping)
            strokeWidth: 3
          }
        ],
        legend: ["Tremor Index", "Tapping Score"]
      });
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#0A84FF" />;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>OFF-Period Map</Text>
        <Text style={styles.subtitle}>Longitudinal Disease Progression</Text>
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Severity Progression (2026)</Text>
        <LineChart
          data={historyData}
          width={Dimensions.get('window').width - 40}
          height={256}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 1,
            color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            labelColor: (opacity = 1) => `#64748B`,
            propsForDots: { r: "5" }
          }}
          bezier
          style={styles.chart}
        />
        <View style={styles.legendRow}>
          <Text style={{ color: '#EF4444', fontWeight: 'bold' }}>● Tremor</Text>
          <Text style={{ color: '#0A84FF', fontWeight: 'bold', marginLeft: 20 }}>● Tapping</Text>
        </View>
      </View>

      <View style={styles.insightCard}>
        <Text style={styles.insightTitle}>Clinical Summary</Text>
        <Text style={styles.insightText}>
          A 15% increase in "OFF" period severity detected over the last quarter. 
          Correlation between Tapping and Tremor scores is high (0.84).
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 24, paddingTop: 60, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '900', color: '#1E293B' },
  subtitle: { fontSize: 16, color: '#64748B' },
  chartCard: { margin: 20, backgroundColor: '#fff', borderRadius: 20, padding: 15, elevation: 5 },
  chartTitle: { fontSize: 16, fontWeight: '700', marginBottom: 15, color: '#334155' },
  chart: { borderRadius: 16 },
  legendRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 10 },
  insightCard: { marginHorizontal: 20, padding: 20, backgroundColor: '#EEF2FF', borderRadius: 16, borderLeftWidth: 5, borderLeftColor: '#4F46E5' },
  insightTitle: { fontSize: 18, fontWeight: '700', color: '#1E1B4B', marginBottom: 5 },
  insightText: { fontSize: 14, color: '#4338CA', lineHeight: 20 }
});