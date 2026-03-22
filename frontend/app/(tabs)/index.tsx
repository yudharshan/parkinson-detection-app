import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';

// Placeholder values — no ML logic
const PLACEHOLDER = {
  weeklyTremorScore: 2.4,
  tremorScaleMax: 10,
  reactionTimeMs: 342,
  riskLevel: 'Low' as const,
};

const RISK_COLORS = {
  Low: { bg: '#DCEDC8', text: '#2E7D32' },
  Moderate: { bg: '#FFE0B2', text: '#E65100' },
  High: { bg: '#FFCDD2', text: '#C62828' },
} as const;

export default function DashboardScreen() {
  const riskColors = RISK_COLORS[PLACEHOLDER.riskLevel];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.greeting}>Your health at a glance</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Weekly tremor score</Text>
          <Text style={styles.cardValue}>
            {PLACEHOLDER.weeklyTremorScore}
            <Text style={styles.cardUnit}> / {PLACEHOLDER.tremorScaleMax}</Text>
          </Text>
          <Text style={styles.cardHint}>Lower is better</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Reaction time</Text>
          <Text style={styles.cardValue}>{PLACEHOLDER.reactionTimeMs}</Text>
          <Text style={styles.cardUnit}> ms</Text>
          <Text style={styles.cardHint}>Average of last 7 days</Text>
        </View>

        <View style={styles.riskRow}>
          <Text style={styles.riskLabel}>Risk level</Text>
          <View style={[styles.badge, { backgroundColor: riskColors.bg }]}>
            <Text style={[styles.badgeText, { color: riskColors.text }]}>
              {PLACEHOLDER.riskLevel}
            </Text>
          </View>
        </View>

        <Link href="/(tabs)/tasks" asChild>
          <Pressable style={styles.primaryButton} accessibilityRole="button" accessibilityLabel="Start new assessment">
            <Text style={styles.primaryButtonText}>Start new assessment</Text>
          </Pressable>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8ECF0',
  },
  cardLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 0.5,
  },
  cardUnit: {
    fontSize: 24,
    fontWeight: '600',
    color: '#4A5568',
  },
  cardHint: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 6,
  },
  riskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#E8ECF0',
  },
  riskLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  badge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 18,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: '#0A84FF',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
