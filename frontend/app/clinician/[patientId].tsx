import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import client from '../../src/services/api/client';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';

const screenWidth = Dimensions.get('window').width;

const medLabel = (m?: string) => {
  if (!m) return 'Not specified';
  if (m.includes("don't take")) return 'No medications';
  if (m.includes('Immediately before')) return 'Before meds (OFF)';
  if (m.includes('Just after')) return 'After meds (ON)';
  if (m.includes('Another time')) return 'Other time';
  return m;
};

export default function PatientDetailScreen() {
  const router = useRouter();
  const { patientId } = useLocalSearchParams();
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [patientName, setPatientName] = useState<string>('Patient Logs');
  const [history, setHistory] = useState<any[]>([]);
  const [trend, setTrend] = useState<any>(null);
  const [detailsExpanded, setDetailsExpanded] = useState<boolean>(false);

  const fetchPatientData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      // Get history
      const histRes = await client.get(`/tests/history/${patientId}`);
      if (histRes.data?.success) {
        setHistory(histRes.data.data);
        
        // Compute trend slope locally using clinician logic
        const testsForTrend = histRes.data.data.map((t: any) => ({
          severityScore: t.severityScore || t.score || 0,
          date: t.timestamp || t.createdAt
        })).reverse(); // Sort old to new

        if (testsForTrend.length >= 2) {
          const testWindow = testsForTrend.slice(-10);
          const len = testWindow.length;
          const mid = Math.floor(len / 2);
          const older = testWindow.slice(0, mid);
          const recent = testWindow.slice(mid);
          const avgOlder = older.reduce((sum: number, t: any) => sum + t.severityScore, 0) / older.length;
          const avgRecent = recent.reduce((sum: number, t: any) => sum + t.severityScore, 0) / recent.length;
          const slope = avgRecent - avgOlder;
          
          let status = 'Stable';
          if (slope >= 0.25) status = 'Worsening';
          else if (slope >= 0.10) status = 'Needs Monitoring';

          setTrend({
            status,
            reason: `Severity shifted by ${(slope * 100).toFixed(1)}% over latest ${len} tests.`
          });
        } else {
          setTrend({
            status: 'Insufficient Data',
            reason: 'At least 2 tests are required to establish growth slope.'
          });
        }
      } else {
        setErrorMsg('Failed to fetch patient history logs.');
      }
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.response?.data?.message || 'Could not load clinical patient files.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (patientId) {
      fetchPatientData();
    }
  }, [patientId]);

  const handleExportCSV = async () => {
    try {
      const BASE_URL = client.defaults.baseURL;
      const exportUrl = `${BASE_URL}/clinician/export/${patientId}?token=${token}`;
      await Linking.openURL(exportUrl);
    } catch (error) {
      Alert.alert('Export Error', 'Unable to download patient CSV sheet.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#B26A43" />
          <Text style={styles.loadingText}>Decrypting clinical files...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMsg) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={48} color="#B0503B" />
          <Text style={styles.errorText}>{errorMsg}</Text>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Return to Roster</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const tappingTests = history.filter(s => s.testType === 'tapping');
  const tremorTests = history.filter(s => s.testType === 'tremor');
  const hasChartData = tappingTests.length > 0 || tremorTests.length > 0;

  const lineChartData = {
    labels: history.slice(0, 7).reverse().map(s => {
      const d = new Date(s.timestamp || s.createdAt);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    }),
    datasets: [
      {
        data: tappingTests.slice(0, 7).reverse().map(s => s.severityScore || s.score || 0),
        color: (opacity = 1) => `rgba(178, 106, 67, ${opacity})`,
        strokeWidth: 2
      },
      {
        data: tremorTests.slice(0, 7).reverse().map(s => s.severityScore || s.score || 0),
        color: (opacity = 1) => `rgba(193, 107, 78, ${opacity})`,
        strokeWidth: 2
      }
    ],
    legend: ['Tapping', 'Tremor']
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#B26A43" />
          <Text style={styles.backLinkText}>Roster</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Patient Detail</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Trend Analysis Section */}
        {trend && (
          <View style={styles.trendCard}>
            <View style={styles.trendHeader}>
              <Text style={styles.trendLabel}>Growth Status Indicator</Text>
              <View style={[
                styles.badge,
                trend.status === 'Worsening' && { backgroundColor: '#ECCCC0' },
                trend.status === 'Needs Monitoring' && { backgroundColor: '#EBD9B4' },
                trend.status === 'Stable' && { backgroundColor: '#E3E8CD' },
                trend.status === 'Insufficient Data' && { backgroundColor: '#EFE7D8' },
              ]}>
                <Text style={[
                  styles.badgeText,
                  trend.status === 'Worsening' && { color: '#9C3E2C' },
                  trend.status === 'Needs Monitoring' && { color: '#A86A1E' },
                  trend.status === 'Stable' && { color: '#5B7044' },
                  trend.status === 'Insufficient Data' && { color: '#8A7765' },
                ]}>
                  {trend.status}
                </Text>
              </View>
            </View>
            <Text style={styles.trendReason}>{trend.reason}</Text>
          </View>
        )}

        {/* Growth Line Graph */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Symptom Growth Graph</Text>
          <Text style={styles.cardSub}>Severity score trajectory mapped across latest tests.</Text>
          
          {hasChartData ? (
            <LineChart
              data={lineChartData}
              width={screenWidth - 48}
              height={220}
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
          ) : (
            <View style={styles.emptyChart}>
              <Text style={styles.emptyText}>No test sessions registered for this patient.</Text>
            </View>
          )}
        </View>

        {/* Export CSV Button */}
        <Pressable style={styles.exportBtn} onPress={handleExportCSV}>
          <Ionicons name="download-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.exportBtnText}>Download Patient CSV</Text>
        </Pressable>

        {/* Collapsible raw numbers breakdown */}
        <View style={styles.card}>
          <Pressable 
            style={styles.collapseHeader}
            onPress={() => setDetailsExpanded(!detailsExpanded)}
          >
            <Text style={styles.collapseTitle}>Full Numeric Breakdown</Text>
            <Ionicons 
              name={detailsExpanded ? "chevron-up" : "chevron-down"} 
              size={22} 
              color="#B26A43" 
            />
          </Pressable>

          {detailsExpanded && (
            <View style={styles.collapseContent}>
              {history.length === 0 ? (
                <Text style={styles.emptyText}>No logs to display.</Text>
              ) : (
                history.map((test, index) => (
                  <View key={test._id || index} style={styles.testRecordRow}>
                    <View style={styles.recordHeader}>
                      <Text style={styles.recordType}>
                        {test.testType === 'tapping' ? 'Finger Tapping' : 'Resting Tremor'}
                      </Text>
                      <Text style={styles.recordDate}>
                        {new Date(test.timestamp || test.createdAt).toLocaleDateString()}
                      </Text>
                    </View>

                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Medication:</Text>
                      <Text style={styles.metricValue}>{medLabel(test.medTimepoint)}</Text>
                    </View>

                    <View style={styles.metricGrid}>
                      <View style={styles.gridCell}>
                        <Text style={styles.gridLabel}>Model Conf.</Text>
                        <Text style={styles.gridValue}>{test.baseConfidence?.toFixed(2) ?? '0.00'}</Text>
                      </View>
                      <View style={styles.gridCell}>
                        <Text style={styles.gridLabel}>Symptom Score</Text>
                        <Text style={[styles.gridValue, { fontWeight: '800' }]}>
                          {test.severityScore?.toFixed(2) ?? '0.00'}
                        </Text>
                      </View>
                      <View style={styles.gridCell}>
                        <Text style={styles.gridLabel}>Result</Text>
                        <Text style={styles.gridValue}>{test.prediction === 'unhealthy' ? 'Symptoms' : 'Clear'}</Text>
                      </View>
                    </View>

                    {test.rawFeatures && Object.keys(test.rawFeatures).length > 0 && (
                      <View style={styles.featuresBox}>
                        <Text style={styles.featuresTitle}>Extracted features:</Text>
                        <Text style={styles.featuresText}>
                          {Object.entries(test.rawFeatures)
                            .map(([k, v]) => `${k}=${typeof v === 'number' ? (v as number).toFixed(3) : v}`)
                            .join(',  ')}
                        </Text>
                      </View>
                    )}
                  </View>
                ))
              )}
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
  errorText: { fontSize: 16, color: '#B0503B', textAlign: 'center', marginBottom: 20 },
  backBtn: { backgroundColor: '#B26A43', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
  backBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E7DBC9', backgroundColor: '#FFFFFF' },
  backLink: { flexDirection: 'row', alignItems: 'center' },
  backLinkText: { fontSize: 16, color: '#B26A43', marginLeft: 4, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#3A2E25' },
  scrollContainer: { padding: 24, paddingBottom: 48 },
  trendCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: '#EFE7D8', shadowColor: '#3A2E25', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  trendHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  trendLabel: { fontSize: 14, color: '#8A7765', fontWeight: '600' },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  trendReason: { fontSize: 16, fontWeight: '700', color: '#3A2E25', lineHeight: 22 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#3A2E25', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1, borderWidth: 1, borderColor: '#EFE7D8' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#3A2E25' },
  cardSub: { fontSize: 13, color: '#8A7765', marginTop: 2, marginBottom: 12 },
  chart: { marginVertical: 8, borderRadius: 16 },
  emptyChart: { height: 180, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#8A7765', fontSize: 15 },
  exportBtn: { backgroundColor: '#B26A43', borderRadius: 12, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginBottom: 20 },
  exportBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  collapseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  collapseTitle: { fontSize: 17, fontWeight: '700', color: '#3A2E25' },
  collapseContent: { marginTop: 16 },
  testRecordRow: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#EFE7D8' },
  recordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  recordType: { fontSize: 15, fontWeight: '700', color: '#3A2E25' },
  recordDate: { fontSize: 13, color: '#8A7765' },
  metricItem: { flexDirection: 'row', marginVertical: 4, alignItems: 'flex-start' },
  metricLabel: { fontSize: 14, color: '#6B5848', fontWeight: '500', marginRight: 6 },
  metricValue: { fontSize: 14, color: '#3A2E25', fontWeight: '600', flex: 1, flexShrink: 1 },
  metricGrid: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F7F1E6', borderRadius: 10, padding: 12, marginTop: 8 },
  gridCell: { alignItems: 'center', flex: 1 },
  gridLabel: { fontSize: 11, color: '#8A7765', marginBottom: 4 },
  gridValue: { fontSize: 14, color: '#3A2E25', fontWeight: '700' },
  featuresBox: { backgroundColor: '#EFE7D8', borderRadius: 8, padding: 10, marginTop: 12 },
  featuresTitle: { fontSize: 12, color: '#6B5848', fontWeight: '600', marginBottom: 4 },
  featuresText: { fontSize: 11, color: '#3A2E25', fontFamily: 'monospace' }
});
