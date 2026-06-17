import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function ResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const testType = params.testType as string;
  const severityScore = parseFloat(params.severityScore as string || '0');
  const baseConfidence = parseFloat(params.baseConfidence as string || '0');
  const appliedOffset = parseFloat(params.appliedOffset as string || '0');
  const interpretation = params.interpretation as string || 'Unknown status';

  const getInterpretationStyles = () => {
    if (severityScore <= 0.45) {
      return { color: '#2E7D32', bg: '#DCEDC8', label: 'Low symptoms (good)' };
    } else if (severityScore <= 0.75) {
      return { color: '#E65100', bg: '#FFE0B2', label: 'Moderate symptoms' };
    } else {
      return { color: '#C62828', bg: '#FFCDD2', label: 'High symptoms (OFF)' };
    }
  };

  const statusStyles = getInterpretationStyles();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Assessment Result</Text>
        <Text style={styles.subtitle}>Test Type: {testType === 'tapping' ? 'Alternating Finger Tapping' : 'Resting Tremor'}</Text>

        <View style={styles.gaugeCard}>
          <Text style={styles.gaugeLabel}>Severity Score</Text>
          <Text style={[styles.gaugeValue, { color: statusStyles.color }]}>
            {severityScore.toFixed(2)}
          </Text>
          <View style={[styles.badge, { backgroundColor: statusStyles.bg }]}>
            <Text style={[styles.badgeText, { color: statusStyles.color }]}>{statusStyles.label}</Text>
          </View>
        </View>

        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Model Metrics Breakdown</Text>
          <Text style={styles.detailsDesc}>
            Our clinical software displays underlying metrics transparently for clinician reviews.
          </Text>

          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Base AI Model Confidence</Text>
            <Text style={styles.metricValue}>{baseConfidence.toFixed(2)}</Text>
          </View>

          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Clinical Medication Correction</Text>
            <Text style={styles.metricValue}>+{appliedOffset.toFixed(2)}</Text>
          </View>

          <View style={[styles.metricRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Final Clinical Severity</Text>
            <Text style={styles.totalValue}>{severityScore.toFixed(2)}</Text>
          </View>
          
          <View style={styles.infoAlert}>
            <Text style={styles.infoAlertText}>
              💡 Note: The gap between the AI model confidence and the final severity score is a fixed clinical-rule correction adjusted for medication timepoint.
            </Text>
          </View>
        </View>

        <Pressable style={styles.primaryBtn} onPress={() => router.replace('/(tabs)/tasks')}>
          <Text style={styles.primaryBtnText}>Back to Tasks</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#64748B', textAlign: 'center', marginTop: 4, marginBottom: 28 },
  gaugeCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 28, alignItems: 'center', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 24 },
  gaugeLabel: { fontSize: 16, color: '#64748B', fontWeight: '600' },
  gaugeValue: { fontSize: 64, fontWeight: '900', marginVertical: 8 },
  badge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  badgeText: { fontSize: 15, fontWeight: '700' },
  detailsCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 32 },
  detailsTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  detailsDesc: { fontSize: 13, color: '#64748B', lineHeight: 18, marginBottom: 16 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  metricLabel: { fontSize: 15, color: '#334155', fontWeight: '500' },
  metricValue: { fontSize: 15, color: '#0F172A', fontWeight: '600' },
  totalRow: { borderBottomWidth: 0, paddingTop: 16 },
  totalLabel: { fontSize: 16, color: '#0F172A', fontWeight: '700' },
  totalValue: { fontSize: 18, color: '#0F172A', fontWeight: '800' },
  infoAlert: { backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12, marginTop: 16, borderWidth: 1, borderColor: '#BFDBFE' },
  infoAlertText: { fontSize: 13, color: '#1E40AF', lineHeight: 18, fontWeight: '500' },
  primaryBtn: { backgroundColor: '#0A84FF', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' }
});
