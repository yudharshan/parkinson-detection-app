import { submitSession } from '@/services/api'; 
import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { saveSession } from '@/services/storage/sessions';
import { generateId } from '@/utils';
import type {
  ReactionTrial,
  ReactionSessionPayload,
  Session,
} from '@/models';
import { constants } from '@/constants';

const NUM_TRIALS = 5;
const MIN_DELAY_MS = 1000;
const MAX_DELAY_MS = 3000;

const WAIT_BG = '#374151';
const STIMULUS_COLORS = ['#22C55E', '#3B82F6', '#EAB308', '#EC4899', '#8B5CF6'];

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickStimulusColor(): string {
  return STIMULUS_COLORS[Math.floor(Math.random() * STIMULUS_COLORS.length)];
}

export default function ReactionTimeScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<'idle' | 'waiting' | 'stimulus' | 'done'>(
    'idle'
  );
  const [trialIndex, setTrialIndex] = useState(0);
  const [trials, setTrials] = useState<ReactionTrial[]>([]);
  const [avgReactionMs, setAvgReactionMs] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const stimulusShownAtRef = useRef<number>(0);
  const sessionStartRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [stimulusColor, setStimulusColor] = useState(WAIT_BG);

  const startTest = () => {
    setTrials([]);
    setTrialIndex(0);
    setAvgReactionMs(null);
    setSessionId(null);
    sessionStartRef.current = Date.now();
    scheduleStimulus();
  };

  const scheduleStimulus = () => {
    setPhase('waiting');
    setStimulusColor(WAIT_BG);
    const delayMs = randomInRange(MIN_DELAY_MS, MAX_DELAY_MS);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setStimulusColor(pickStimulusColor());
      stimulusShownAtRef.current = Date.now();
      setPhase('stimulus');
    }, delayMs);
  };

  const onTap = () => {
    if (phase !== 'stimulus') return;
    const responseAt = Date.now();
    const reactionTimeMs = responseAt - stimulusShownAtRef.current;
    const newTrial: ReactionTrial = {
      trialIndex,
      stimulusShownAt: stimulusShownAtRef.current,
      responseAt,
      reactionTimeMs,
    };
    const nextTrials = [...trials, newTrial];
    setTrials(nextTrials);

    if (nextTrials.length >= NUM_TRIALS) {
      const durationMs = Date.now() - sessionStartRef.current;
      const mean =
        nextTrials.reduce((s, t) => s + t.reactionTimeMs, 0) / nextTrials.length;
      const sorted = [...nextTrials].sort((a, b) => a.reactionTimeMs - b.reactionTimeMs);
      const median =
        sorted.length % 2 === 1
          ? sorted[Math.floor(sorted.length / 2)].reactionTimeMs
          : (sorted[sorted.length / 2 - 1].reactionTimeMs +
              sorted[sorted.length / 2].reactionTimeMs) /
            2;

      const payload: ReactionSessionPayload = {
        trials: nextTrials,
        totalTrials: NUM_TRIALS,
        durationMs,
        meanReactionTimeMs: Math.round(mean * 10) / 10,
        medianReactionTimeMs: Math.round(median * 10) / 10,
      };
      const session: Session<ReactionSessionPayload> = {
        id: generateId(),
        taskType: 'reaction_time',
        startedAt: new Date(sessionStartRef.current).toISOString(),
        endedAt: new Date().toISOString(),
        payload,
      };
      saveSession(session).then(async () => {
       setSessionId(session.id);
       setAvgReactionMs(mean);
        setPhase('done');

        await submitSession('/api/analyze', session); 
      });
    } else {
      setTrialIndex(trialIndex + 1);
      scheduleStimulus();
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const isWaiting = phase === 'waiting';
  const isStimulus = phase === 'stimulus';
  const isDone = phase === 'done';
  const isTapTarget = isStimulus;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View
        style={[
          styles.container,
          { backgroundColor: phase === 'done' ? '#F5F7FA' : stimulusColor },
        ]}
      >
        {phase === 'idle' && (
          <View style={styles.idleContent}>
            <Text style={styles.title}>Reaction Time Test</Text>
            <Text style={styles.instructions}>
              Tap the screen as soon as the background changes color.{'\n\n'}
              {NUM_TRIALS} trials. Stay focused.
            </Text>
            <Pressable
              style={styles.primaryButton}
              onPress={startTest}
              accessibilityRole="button"
              accessibilityLabel="Start reaction time test"
            >
              <Text style={styles.primaryButtonText}>Start test</Text>
            </Pressable>
          </View>
        )}

        {(isWaiting || isStimulus) && (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onTap}
            disabled={!isTapTarget}
            accessibilityRole="button"
            accessibilityLabel={isStimulus ? 'Tap now' : 'Wait for color change'}
          >
            <View style={styles.tapArea}>
              <Text style={styles.tapPrompt}>
                {isWaiting && 'Wait…'}
                {isStimulus && 'TAP!'}
              </Text>
              <Text style={styles.trialCount}>
                Trial {trialIndex + 1} of {NUM_TRIALS}
              </Text>
            </View>
          </Pressable>
        )}

        {isDone && (
          <View style={styles.doneContent}>
            <Text style={styles.doneTitle}>Done</Text>
            <Text style={styles.doneLabel}>Average reaction time</Text>
            <Text style={styles.doneValue}>
              {avgReactionMs != null ? `${Math.round(avgReactionMs)} ms` : '—'}
            </Text>
            {sessionId && (
              <Text style={styles.doneId}>Saved · ID: {sessionId.slice(0, 12)}…</Text>
            )}
            <Pressable
              style={styles.primaryButton}
              onPress={startTest}
              accessibilityRole="button"
              accessibilityLabel="Run test again"
            >
              <Text style={styles.primaryButtonText}>Run again</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back to tasks"
            >
              <Text style={styles.secondaryButtonText}>Back to tasks</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#374151' },
  container: { flex: 1 },
  idleContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  instructions: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 26,
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: '#22C55E',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  tapArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tapPrompt: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  trialCount: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 16,
  },
  doneContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    backgroundColor: '#F5F7FA',
  },
  doneTitle: { fontSize: 26, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  doneLabel: { fontSize: 18, color: '#64748B', marginBottom: 4 },
  doneValue: { fontSize: 40, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  doneId: { fontSize: 14, color: '#64748B', marginBottom: 32 },
  secondaryButton: { marginTop: 12, paddingVertical: 16, alignItems: 'center' },
  secondaryButtonText: { fontSize: 18, fontWeight: '600', color: '#0A84FF' },
});
