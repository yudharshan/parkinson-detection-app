import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { submitSession } from '../../src/services/api/client';
import { generateId } from '../../src/utils';
import { useAuth } from '../../src/context/AuthContext';

interface TapEvent {
  TapTimeStamp: number; // seconds since test start
  TappedButtonId: 'TappedButtonLeft' | 'TappedButtonRight' | 'TappedButtonNone';
  TapCoordinate: string; // "{x, y}"
}

export default function AlternatingFingerTappingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  // --- States ---
  const [phase, setPhase] = useState<'instructions' | 'active' | 'uploading'>('instructions');
  const [medTimepoint, setMedTimepoint] = useState<string>('Immediately before Parkinson medication');
  const [countdown, setCountdown] = useState<number>(20);
  const [leftCount, setLeftCount] = useState<number>(0);
  const [rightCount, setRightCount] = useState<number>(0);
  const [missCount, setMissCount] = useState<number>(0);

  // --- Refs ---
  const startTimeRef = useRef<number>(0);
  const tapsRef = useRef<TapEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTest = () => {
    tapsRef.current = [];
    setLeftCount(0);
    setRightCount(0);
    setMissCount(0);
    setCountdown(20);
    startTimeRef.current = Date.now();
    setPhase('active');

    // 20 Second timer
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, 20 - Math.floor(elapsed));
      setCountdown(remaining);

      if (elapsed >= 20) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        uploadResults();
      }
    }, 100);
  };

  const recordTap = (buttonId: 'TappedButtonLeft' | 'TappedButtonRight' | 'TappedButtonNone', pageX: number, pageY: number) => {
    if (phase !== 'active') return;
    
    const timeStamp = parseFloat(((Date.now() - startTimeRef.current) / 1000).toFixed(4));
    const coordString = `{${pageX.toFixed(1)}, ${pageY.toFixed(1)}}`;

    const tapEvent: TapEvent = {
      TapTimeStamp: timeStamp,
      TappedButtonId: buttonId,
      TapCoordinate: coordString,
    };

    tapsRef.current.push(tapEvent);

    if (buttonId === 'TappedButtonLeft') {
      setLeftCount(prev => prev + 1);
    } else if (buttonId === 'TappedButtonRight') {
      setRightCount(prev => prev + 1);
    } else {
      setMissCount(prev => prev + 1);
    }
  };

  const uploadResults = async () => {
    setPhase('uploading');
    const finalTaps = [...tapsRef.current];

    try {
      const response = await submitSession('/test/tapping', {
        userId: user?.userId,
        rawTaps: finalTaps,
        medTimepoint,
      });

      if (response.ok && response.data) {
        console.log('✅ Tapping AI Score Received:', response.data);
        router.push({
          pathname: '/results',
          params: {
            testType: 'tapping',
            severityScore: response.data.data.severityScore,
            interpretation: response.data.data.interpretation,
            features: JSON.stringify(response.data.data.rawFeatures || {}),
          }
        });
      } else {
        Alert.alert('Analysis Failed', response.error?.message || 'Server failed to analyze tapping test.', [
          { text: 'OK', onPress: () => setPhase('instructions') }
        ]);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Connection Error', 'Could not reach analysis gateway.', [
        { text: 'OK', onPress: () => setPhase('instructions') }
      ]);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (phase === 'instructions') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.title}>Finger Tapping Test</Text>
          <Text style={styles.desc}>
            Place your phone on a flat surface. Using your index and middle fingers of your testing hand, tap the left and right buttons alternately as fast as possible for 20 seconds.
          </Text>

          <View style={styles.section}>
            <Text style={styles.label}>Select Medication State *</Text>
            
            <Pressable
              style={[
                styles.optionBtn,
                medTimepoint === 'Immediately before Parkinson medication' && styles.optionBtnSelected,
              ]}
              onPress={() => setMedTimepoint('Immediately before Parkinson medication')}
            >
              <Text style={[
                styles.optionText,
                medTimepoint === 'Immediately before Parkinson medication' && styles.optionTextSelected,
              ]}>
                Immediately before Medication (OFF)
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.optionBtn,
                medTimepoint === 'Just after Parkinson medication (at your best)' && styles.optionBtnSelected,
              ]}
              onPress={() => setMedTimepoint('Just after Parkinson medication (at your best)')}
            >
              <Text style={[
                styles.optionText,
                medTimepoint === 'Just after Parkinson medication (at your best)' && styles.optionTextSelected,
              ]}>
                Just after Medication (ON)
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.optionBtn,
                medTimepoint === 'Other / Regular State' && styles.optionBtnSelected,
              ]}
              onPress={() => setMedTimepoint('Other / Regular State')}
            >
              <Text style={[
                styles.optionText,
                medTimepoint === 'Other / Regular State' && styles.optionTextSelected,
              ]}>
                Other / Regular State
              </Text>
            </Pressable>
          </View>

          <Pressable style={styles.primaryBtn} onPress={startTest}>
            <Text style={styles.primaryBtnText}>Start 20s Assessment</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'uploading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, styles.center]}>
          <ActivityIndicator size="large" color="#B26A43" />
          <Text style={styles.loadingText}>Uploading raw taps to clinical gateway...</Text>
          <Text style={styles.loadingSubtext}>Extracting features and running ML ensemble models...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Pressable 
        style={styles.activeContainer} 
        onPress={(e) => recordTap('TappedButtonNone', e.nativeEvent.pageX, e.nativeEvent.pageY)}
      >
        <View style={styles.activeHeader}>
          <Text style={styles.countdownText}>{countdown}s</Text>
          <Text style={styles.activeSub}>Tap alternately L and R as fast as possible</Text>
        </View>

        <View style={styles.buttonRow}>
          <Pressable
            style={({ pressed }) => [styles.tapBtn, pressed && styles.tapBtnPressed]}
            onPressIn={(e) => {
              e.stopPropagation();
              recordTap('TappedButtonLeft', e.nativeEvent.pageX, e.nativeEvent.pageY);
            }}
          >
            <Text style={styles.tapBtnText}>L</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.tapBtn, pressed && styles.tapBtnPressed]}
            onPressIn={(e) => {
              e.stopPropagation();
              recordTap('TappedButtonRight', e.nativeEvent.pageX, e.nativeEvent.pageY);
            }}
          >
            <Text style={styles.tapBtnText}>R</Text>
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <Text style={styles.statsText}>Left: {leftCount}</Text>
          <Text style={styles.statsText}>Right: {rightCount}</Text>
          <Text style={styles.statsText}>Misses: {missCount}</Text>
        </View>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F1E6' },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: '#3A2E25', marginBottom: 12, textAlign: 'center' },
  desc: { fontSize: 16, color: '#8A7765', lineHeight: 24, textAlign: 'center', marginBottom: 32 },
  section: { marginBottom: 32 },
  label: { fontSize: 15, fontWeight: '700', color: '#5C4A3A', marginBottom: 12, textAlign: 'center' },
  optionBtn: { backgroundColor: '#FFFFFF', borderColor: '#D9CBB8', borderWidth: 1, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, marginBottom: 12, alignItems: 'center' },
  optionBtnSelected: { backgroundColor: '#B26A43', borderColor: '#B26A43' },
  optionText: { fontSize: 15, color: '#6B5848', fontWeight: '600' },
  optionTextSelected: { color: '#FFFFFF' },
  primaryBtn: { backgroundColor: '#B26A43', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  loadingText: { fontSize: 18, color: '#3A2E25', fontWeight: '700', marginTop: 20, textAlign: 'center' },
  loadingSubtext: { fontSize: 14, color: '#8A7765', marginTop: 8, textAlign: 'center' },
  activeContainer: { flex: 1, padding: 24, justifyContent: 'space-between', backgroundColor: '#3A2E25' },
  activeHeader: { alignItems: 'center', marginTop: 20 },
  countdownText: { fontSize: 64, fontWeight: '900', color: '#B26A43' },
  activeSub: { fontSize: 16, color: '#A99A88', marginTop: 8, textAlign: 'center' },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', flex: 1 },
  tapBtn: { width: 130, height: 130, borderRadius: 65, backgroundColor: '#4A3B2E', borderWidth: 2, borderColor: '#5C4A3A', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 10 },
  tapBtnPressed: { backgroundColor: '#5C4A3A', transform: [{ scale: 0.95 }] },
  tapBtnText: { fontSize: 40, fontWeight: '800', color: '#FFFFFF' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 20, borderTopWidth: 1, borderTopColor: '#4A3B2E' },
  statsText: { fontSize: 16, color: '#A99A88', fontWeight: '600' }
});
