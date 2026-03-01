import { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { saveSession } from '@/services/storage/sessions';
import { generateId } from '@/utils';
import type {
  TracingPoint,
  TracingStroke,
  TracingSessionPayload,
  Session,
} from '@/models';

const CANVAS_SIZE = 280;
const TEMPLATE_RADIUS = 100;
const TEMPLATE_CX = CANVAS_SIZE / 2;
const TEMPLATE_CY = CANVAS_SIZE / 2;
const TEMPLATE_ID = 'circle';

type Phase = 'idle' | 'tracing' | 'done';

export default function TracingScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [strokes, setStrokes] = useState<TracingStroke[]>([]);
  const [currentPoints, setCurrentPoints] = useState<TracingPoint[]>([]);
  const [durationMs, setDurationMs] = useState(0);
  const [accuracyPlaceholder, setAccuracyPlaceholder] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const startTimeRef = useRef<number>(0);
  const strokeIndexRef = useRef(0);

  const allPoints = phase === 'done'
    ? strokes.flatMap((s) => s.points)
    : [...strokes.flatMap((s) => s.points), ...currentPoints];

  const handleTouch = (evt: GestureResponderEvent, type: 'start' | 'move' | 'end') => {
    const { locationX, locationY } = evt.nativeEvent;
    const timestamp = Date.now();

    if (type === 'start') {
      startTimeRef.current = startTimeRef.current || timestamp;
      setCurrentPoints([{ x: locationX, y: locationY, timestamp }]);
    } else if (type === 'move') {
      setCurrentPoints((prev) => [...prev, { x: locationX, y: locationY, timestamp }]);
    } else {
      // end
      setCurrentPoints((prev) => {
        const stroke: TracingStroke = {
          points: prev.length ? [...prev, { x: locationX, y: locationY, timestamp }] : [],
          strokeIndex: strokeIndexRef.current++,
        };
        if (stroke.points.length > 0) {
          setStrokes((s) => [...s, stroke]);
        }
        return [];
      });
    }
  };

  const finishTracing = () => {
    const endTime = Date.now();
    const elapsed = endTime - startTimeRef.current;
    setDurationMs(elapsed);

    const finalStrokes =
      currentPoints.length > 0
        ? [
            ...strokes,
            {
              points: currentPoints,
              strokeIndex: strokeIndexRef.current,
            } as TracingStroke,
          ]
        : strokes;

    const totalPoints = finalStrokes.reduce((n, s) => n + s.points.length, 0);
    const placeholder =
      totalPoints < 10
        ? Math.round(50 + Math.random() * 20)
        : Math.round(70 + Math.random() * 28);
    setAccuracyPlaceholder(placeholder);

    const payload: TracingSessionPayload = {
      strokes: finalStrokes,
      templateId: TEMPLATE_ID,
      durationMs: elapsed,
      bounds: { width: CANVAS_SIZE, height: CANVAS_SIZE },
    };

    const session: Session<TracingSessionPayload> = {
      id: generateId(),
      taskType: 'tracing',
      startedAt: new Date(startTimeRef.current).toISOString(),
      endedAt: new Date(endTime).toISOString(),
      payload,
    };

    saveSession(session).then(() => {
      setSessionId(session.id);
      setPhase('done');
    });
  };

  const startOver = () => {
    setPhase('idle');
    setStrokes([]);
    setCurrentPoints([]);
    setDurationMs(0);
    setAccuracyPlaceholder(null);
    setSessionId(null);
    startTimeRef.current = 0;
    strokeIndexRef.current = 0;
  };

  const polylinePoints = allPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.title}>Trace the circle</Text>
        <Text style={styles.subtitle}>
          {phase === 'idle'
            ? 'Follow the circle outline with your finger.'
            : phase === 'tracing'
              ? 'Trace then tap Done.'
              : 'Trace saved.'}
        </Text>

        <View
          style={styles.canvasWrap}
          onTouchStart={(e) => phase === 'tracing' && handleTouch(e, 'start')}
          onTouchMove={(e) => phase === 'tracing' && handleTouch(e, 'move')}
          onTouchEnd={(e) => phase === 'tracing' && handleTouch(e, 'end')}
          onTouchCancel={(e) => phase === 'tracing' && handleTouch(e, 'end')}
        >
          <Svg width={CANVAS_SIZE} height={CANVAS_SIZE}>
            <Circle
              cx={TEMPLATE_CX}
              cy={TEMPLATE_CY}
              r={TEMPLATE_RADIUS}
              fill="none"
              stroke="#E5E7EB"
              strokeWidth={3}
            />
            {polylinePoints.length > 0 && (
              <Polyline
                points={polylinePoints}
                fill="none"
                stroke="#0A84FF"
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </Svg>
        </View>

        {phase === 'idle' && (
          <Pressable
            style={styles.primaryButton}
            onPress={() => setPhase('tracing')}
            accessibilityRole="button"
            accessibilityLabel="Start tracing"
          >
            <Text style={styles.primaryButtonText}>Start tracing</Text>
          </Pressable>
        )}

        {phase === 'tracing' && (
          <Pressable
            style={styles.primaryButton}
            onPress={finishTracing}
            accessibilityRole="button"
            accessibilityLabel="Done tracing"
          >
            <Text style={styles.primaryButtonText}>Done</Text>
          </Pressable>
        )}

        {phase === 'done' && (
          <>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>Accuracy (placeholder)</Text>
              <Text style={styles.scoreValue}>
                {accuracyPlaceholder != null ? `${accuracyPlaceholder}%` : '—'}
              </Text>
            </View>
            {sessionId && (
              <Text style={styles.meta}>Saved · ID: {sessionId.slice(0, 12)}…</Text>
            )}
            <Pressable
              style={styles.primaryButton}
              onPress={startOver}
              accessibilityRole="button"
              accessibilityLabel="Trace again"
            >
              <Text style={styles.primaryButtonText}>Trace again</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back to tasks"
            >
              <Text style={styles.secondaryButtonText}>Back to tasks</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7FA' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 },
  title: { fontSize: 26, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  subtitle: { fontSize: 17, color: '#64748B', marginBottom: 24 },
  canvasWrap: {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    alignSelf: 'center',
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    overflow: 'hidden',
  },
  primaryButton: {
    backgroundColor: '#0A84FF',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryButtonText: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E8ECF0',
  },
  scoreLabel: { fontSize: 18, fontWeight: '600', color: '#1A1A1A' },
  scoreValue: { fontSize: 24, fontWeight: '700', color: '#1A1A1A' },
  meta: { fontSize: 14, color: '#64748B', marginBottom: 16 },
  secondaryButton: { paddingVertical: 16, alignItems: 'center' },
  secondaryButtonText: { fontSize: 18, fontWeight: '600', color: '#0A84FF' },
});
