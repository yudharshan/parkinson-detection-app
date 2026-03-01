/**
 * Export session data (JSON/CSV) for offline ML or future API upload.
 */

import type { Session } from '@/models';

export function sessionsToJson(sessions: Session<unknown>[]): string {
  return JSON.stringify(sessions, null, 2);
}

export function sessionsToCsv(sessions: Session<unknown>[]): string {
  // Simple CSV header + one row per session summary; extend as needed
  const header = 'id,taskType,startedAt,endedAt\n';
  const rows = sessions.map(
    (s) => `${s.id},${s.taskType},${s.startedAt},${s.endedAt ?? ''}`
  );
  return header + rows.join('\n');
}
