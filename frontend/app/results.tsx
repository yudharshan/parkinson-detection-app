import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function ResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const testType = params.testType as string;
  const severityScore = parseFloat(params.severityScore as string || '0');
  const interpretation = params.interpretation as string || 'Unknown status';
  let features: Record<string, number> = {};
  try { features = JSON.parse((params.features as string) || '{}'); } catch {}

  const getInterpretationStyles = () => {
    if (severityScore < 0.4) {
      return { color: '#5B7044', bg: '#E3E8CD', label: 'Low — looks healthy' };
    } else if (severityScore <= 0.65) {
      return { color: '#A86A1E', bg: '#EBD9B4', label: 'Inconclusive (model unsure)' };
    } else {
      return { color: '#9C3E2C', bg: '#ECCCC0', label: 'Elevated symptoms' };
    }
  };

  const statusStyles = getInterpretationStyles();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
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
          <Text style={styles.detailsTitle}>Model Output</Text>
          <Text style={styles.detailsDesc}>
            The score is the model's probability that motor symptoms are present
            (0 = clearly healthy, 1 = clear symptoms). This single number is what the
            History tab tracks over time.
          </Text>

          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Symptom probability</Text>
            <Text style={styles.metricValue}>{severityScore.toFixed(2)}</Text>
          </View>

          <View style={[styles.metricRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Classification</Text>
            <Text style={styles.totalValue}>{interpretation}</Text>
          </View>

          <View style={styles.infoAlert}>
            <Text style={styles.infoAlertText}>
              ℹ️ Research prototype: the label is a medication-timing proxy, not a clinical
              diagnosis. Use the trend over multiple tests, not a single score.
            </Text>
          </View>
        </View>

        {Object.keys(features).length > 0 && (
          <View style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Extracted features</Text>
            <Text style={styles.detailsDesc}>
              Computed from your raw test data by the feature extractor, then fed to the model.
            </Text>
            {Object.entries(features).map(([k, v]) => (
              <View key={k} style={styles.metricRow}>
                <Text style={styles.metricLabel}>{k}</Text>
                <Text style={styles.metricValue}>
                  {typeof v === 'number' ? Number(v).toFixed(4) : String(v)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Pressable style={styles.primaryBtn} onPress={() => router.replace('/(tabs)/tasks')}>
          <Text style={styles.primaryBtnText}>Back to Tasks</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F1E6' },
  container: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', color: '#3A2E25', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#8A7765', textAlign: 'center', marginTop: 4, marginBottom: 28 },
  gaugeCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 28, alignItems: 'center', shadowColor: '#3A2E25', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2, borderWidth: 1, borderColor: '#EFE7D8', marginBottom: 24 },
  gaugeLabel: { fontSize: 16, color: '#8A7765', fontWeight: '600' },
  gaugeValue: { fontSize: 64, fontWeight: '900', marginVertical: 8 },
  badge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  badgeText: { fontSize: 15, fontWeight: '700' },
  detailsCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, shadowColor: '#3A2E25', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2, borderWidth: 1, borderColor: '#EFE7D8', marginBottom: 32 },
  detailsTitle: { fontSize: 18, fontWeight: '700', color: '#3A2E25', marginBottom: 4 },
  detailsDesc: { fontSize: 13, color: '#8A7765', lineHeight: 18, marginBottom: 16 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EFE7D8' },
  metricLabel: { fontSize: 15, color: '#5C4A3A', fontWeight: '500' },
  metricValue: { fontSize: 15, color: '#3A2E25', fontWeight: '600' },
  totalRow: { borderBottomWidth: 0, paddingTop: 16 },
  totalLabel: { fontSize: 16, color: '#3A2E25', fontWeight: '700' },
  totalValue: { fontSize: 18, color: '#3A2E25', fontWeight: '800' },
  infoAlert: { backgroundColor: '#F3EDE0', borderRadius: 10, padding: 12, marginTop: 16, borderWidth: 1, borderColor: '#D8C7A6' },
  infoAlertText: { fontSize: 13, color: '#6E5A2E', lineHeight: 18, fontWeight: '500' },
  primaryBtn: { backgroundColor: '#B26A43', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' }
});
