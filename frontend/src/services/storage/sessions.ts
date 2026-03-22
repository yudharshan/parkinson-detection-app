/**
 * Local persistence for sessions (AsyncStorage).
 * Data stored as structured JSON for export and future ML API sync.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@/models';

const SESSIONS_KEY = 'neurotrack_sessions';

export async function saveSession(session: Session<unknown>): Promise<void> {
  const existing = await getSessions();
  existing.push(session as Session<unknown>);
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(existing));
}

export async function getSessions(): Promise<Session<unknown>[]> {
  const raw = await AsyncStorage.getItem(SESSIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getSessionById(id: string): Promise<Session<unknown> | null> {
  const sessions = await getSessions();
  return sessions.find((s) => s.id === id) ?? null;
}
