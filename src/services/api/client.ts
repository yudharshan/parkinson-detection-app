/**
 * ML API client (placeholder for future backend integration).
 * Use models/ types for request/response shapes.
 */

import { constants } from '@/constants';

const BASE_URL = constants.api?.baseUrl ?? '';

export async function submitSession<T>(path: string, payload: T): Promise<{ ok: boolean; id?: string }> {
  if (!BASE_URL) {
    return { ok: false };
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const ok = res.ok;
  const data = ok ? await res.json().catch(() => ({})) : {};
  return { ok, id: data?.id };
}
