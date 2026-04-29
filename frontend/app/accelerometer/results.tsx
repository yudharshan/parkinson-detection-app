import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

export default function ResultsScreen() {
  const { score, taskType } = useLocalSearchParams();
  const router = useRouter();

  // Convert score to a number and calculate confidence
  const aiConfidence = parseFloat(score as string) || 0;
  
  // Binary Logic: If score >= 0.6, we classify as "Detected" (Red)
  const isDetected = aiConfidence >= 0.6;
  const statusColor = isDetected ? '#EF4444' : '#10B981';
  const statusLabel = isDetected ? 'TREMOR DETECTED' : 'NORMAL RANGE';

  // Mock data for the trend (You can later pass actual historical points here)
  const chartData = {
    labels: ["1s", "3s", "5s", "7s", "9s"],
    datasets: [{
      data: [
        Math.random() * 0.4, 
        Math.random() * (isDetected ? 1.2 : 0.5), 
        Math.random() * 0.6, 
        Math.random() * (isDetected ? 1.5 : 0.4), 
        Math.random() * 0.5
      ],
      color: (opacity = 1) => statusColor, 
      strokeWidth: 3 
    }]
  };

  return (
    <ScrollView style={styles.container}>
      {/* Binary Status Banner */}
      <View style={[styles.statusBanner, { backgroundColor: statusColor }]}>
        <Text style={styles.statusBannerText}>{statusLabel}</Text>
      </View>

      <View style={styles.content}>
        {/* Confidence Gauge Card */}
        <View style={styles.card}>
          <Text style={styles.label}>AI CONFIDENCE SCORE</Text>
          <Text style={[styles.confidenceValue, { color: statusColor }]}>
            {(aiConfidence * 100).toFixed(1)}%
          </Text>
          <Text style={styles.subtext}>
            {isDetected 
              ? "Patterns strongly match tremor signatures." 
              : "Movement falls within healthy parameters."}
          </Text>
        </View>

        {/* Live Signal Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Signal Amplitude (G-Force)</Text>
          <LineChart
            data={chartData}
            width={Dimensions.get('window').width - 60}
            height={200}
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 2,
              color: (opacity = 1) => statusColor,
              labelColor: (opacity = 1) => `#64748B`,
              style: { borderRadius: 16 },
              propsForDots: { r: "5", strokeWidth: "2", stroke: statusColor }
            }}
            bezier
            style={styles.chart}
          />
        </View>

        {/* Action Buttons */}
        <Pressable 
          style={styles.historyBtn} 
          onPress={() => router.replace('/(tabs)/history')}
        >
          <Text style={styles.historyBtnText}>View Long-term OFF Map</Text>
        </Pressable>

        <Pressable 
          style={styles.doneBtn} 
          onPress={() => router.replace('/(tabs)/tasks')}
        >
          <Text style={styles.doneBtnText}>Done</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  statusBanner: { 
    paddingTop: 60, 
    paddingBottom: 30, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  statusBannerText: { 
    color: '#fff', 
    fontSize: 24, 
    fontWeight: '900', 
    letterSpacing: 1 
  },
  content: { padding: 20, marginTop: -20 },
  card: { 
    backgroundColor: '#fff', 
    borderRadius: 20, 
    padding: 25, 
    alignItems: 'center', 
    elevation: 4, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    marginBottom: 20
  },
  label: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: '#94A3B8', 
    letterSpacing: 1.5 
  },
  confidenceValue: { 
    fontSize: 54, 
    fontWeight: '900', 
    marginVertical: 10 
  },
  subtext: { 
    fontSize: 14, 
    color: '#64748B', 
    textAlign: 'center' 
  },
  chartCard: { 
    backgroundColor: '#fff', 
    borderRadius: 20, 
    padding: 15, 
    marginBottom: 25, 
    elevation: 2 
  },
  chartTitle: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#475569', 
    marginBottom: 10, 
    marginLeft: 10 
  },
  chart: { borderRadius: 16 },
  historyBtn: { 
    backgroundColor: '#1E293B', 
    paddingVertical: 18, 
    borderRadius: 15, 
    alignItems: 'center' 
  },
  historyBtnText: { 
    color: '#fff', 
    fontWeight: '700', 
    fontSize: 16 
  },
  doneBtn: { 
    marginTop: 15, 
    paddingVertical: 10, 
    alignItems: 'center' 
  },
  doneBtnText: { 
    color: '#64748B', 
    fontWeight: '600' 
  }
});