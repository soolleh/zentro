/**
 * sw-state.storage.ts
 *
 * Read/write non-sensitive state to the sw_state IDB store.
 * Written by the main thread. Read by the service worker during periodic sync.
 * NEVER stores encrypted data or financial data — only userId + preference flags.
 */
import { getDB } from '@/services/storage/storage.db';

export async function writeSWState(key: string, value: unknown): Promise<void> {
  try {
    const db = await getDB();
    await db.put('sw_state', { key, value });
  } catch {
    // Non-critical — if SW state can't be written, degrade gracefully
  }
}

export async function readSWState<T>(key: string): Promise<T | null> {
  try {
    const db = await getDB();
    const record = await db.get('sw_state', key);
    if (!record) return null;
    return record.value as T;
  } catch {
    return null;
  }
}
