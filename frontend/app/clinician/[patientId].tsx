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
          <ActivityIndicator size="large" color="#0A84FF" />
          <Text style={styles.loadingText}>Decrypting clinical files...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMsg) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={48} color="#EF4444" />
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
        color: (opacity = 1) => `rgba(10, 132, 255, ${opacity})`,
        strokeWidth: 2
      },
      {
        data: tremorTests.slice(0, 7).reverse().map(s => s.severityScore || s.score || 0),
        color: (opacity = 1) => `rgba(235, 87, 87, ${opacity})`,
        strokeWidth: 2
      }
    ],
    legend: ['Tapping', 'Tremor']
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#0A84FF" />
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
                trend.status === 'Worsening' && { backgroundColor: '#FFCDD2' },
                trend.status === 'Needs Monitoring' && { backgroundColor: '#FFE0B2' },
                trend.status === 'Stable' && { backgroundColor: '#DCEDC8' },
                trend.status === 'Insufficient Data' && { backgroundColor: '#F1F5F9' },
              ]}>
                <Text style={[
                  styles.badgeText,
                  trend.status === 'Worsening' && { color: '#C62828' },
                  trend.status === 'Needs Monitoring' && { color: '#E65100' },
                  trend.status === 'Stable' && { color: '#2E7D32' },
                  trend.status === 'Insufficient Data' && { color: '#64748B' },
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
              <Text style={styles.emptyText}>No test sessions registered for this patient.</Text>
            </View>
          )}
        </View>

        {/* Export CSV Button */}
        <Pressable style={styles.exportBtn} onPress={handleExportCSV}>
          <Ionicons name="download-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.exportBtnText}>Export CSV Dataset</Text>
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
              color="#0A84FF" 
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
                      <Text style={styles.metricLabel}>Medication Timepoint:</Text>
                      <Text style={styles.metricValue}>{test.medTimepoint || 'Not Specified'}</Text>
                    </View>

                    <View style={styles.metricGrid}>
                      <View style={styles.gridCell}>
                        <Text style={styles.gridLabel}>Base Confidence</Text>
                        <Text style={styles.gridValue}>{test.baseConfidence?.toFixed(2) ?? '0.00'}</Text>
                      </View>
                      <View style={styles.gridCell}>
                        <Text style={styles.gridLabel}>Applied Offset</Text>
                        <Text style={styles.gridValue}>+{test.appliedOffset?.toFixed(2) ?? '0.00'}</Text>
                      </View>
                      <View style={styles.gridCell}>
                        <Text style={styles.gridLabel}>Final Score</Text>
                        <Text style={[styles.gridValue, { fontWeight: '800' }]}>
                          {test.severityScore?.toFixed(2) ?? '0.00'}
                        </Text>
                      </View>
                    </View>

                    {test.rawFeatures && test.rawFeatures.length > 0 && (
                      <View style={styles.featuresBox}>
                        <Text style={styles.featuresTitle}>Extracted Features Array:</Text>
                        <Text style={styles.featuresText}>
                          [{test.rawFeatures.map((f: number) => f.toFixed(3)).join(', ')}]
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
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { fontSize: 16, color: '#64748B', marginTop: 12, fontWeight: '600' },
  errorText: { fontSize: 16, color: '#EF4444', textAlign: 'center', marginBottom: 20 },
  backBtn: { backgroundColor: '#0A84FF', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
  backBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  backLink: { flexDirection: 'row', alignItems: 'center' },
  backLinkText: { fontSize: 16, color: '#0A84FF', marginLeft: 4, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  scrollContainer: { padding: 24, paddingBottom: 48 },
  trendCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  trendHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  trendLabel: { fontSize: 14, color: '#64748B', fontWeight: '600' },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  trendReason: { fontSize: 16, fontWeight: '700', color: '#0F172A', lineHeight: 22 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1, borderWidth: 1, borderColor: '#F1F5F9' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  cardSub: { fontSize: 13, color: '#64748B', marginTop: 2, marginBottom: 12 },
  chart: { marginVertical: 8, borderRadius: 16 },
  emptyChart: { height: 180, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#64748B', fontSize: 15 },
  exportBtn: { backgroundColor: '#0A84FF', borderRadius: 12, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginBottom: 20 },
  exportBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  collapseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  collapseTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  collapseContent: { marginTop: 16 },
  testRecordRow: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  recordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  recordType: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  recordDate: { fontSize: 13, color: '#64748B' },
  metricItem: { flexDirection: 'row', marginVertical: 4 },
  metricLabel: { fontSize: 14, color: '#475569', fontWeight: '500', marginRight: 6 },
  metricValue: { fontSize: 14, color: '#0F172A', fontWeight: '600' },
  metricGrid: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, marginTop: 8 },
  gridCell: { alignItems: 'center', flex: 1 },
  gridLabel: { fontSize: 11, color: '#64748B', marginBottom: 4 },
  gridValue: { fontSize: 14, color: '#0F172A', fontWeight: '700' },
  featuresBox: { backgroundColor: '#F1F5F9', borderRadius: 8, padding: 10, marginTop: 12 },
  featuresTitle: { fontSize: 12, color: '#475569', fontWeight: '600', marginBottom: 4 },
  featuresText: { fontSize: 11, color: '#0F172A', fontFamily: 'monospace' }
});
