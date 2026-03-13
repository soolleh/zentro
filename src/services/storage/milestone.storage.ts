/**
 * milestone.storage.ts
 *
 * CRUD for the achieved_milestones IndexedDB store.
 * NOT encrypted — milestone data contains only public threshold constants,
 * approximate achievedAt timestamps, and rounded net worth values.
 *
 * All methods return Result<T>. No throws.
 *
 * Idempotency: recordAchievement will not create duplicates for the same
 * userId + milestoneId pair.
 */
import { getDB } from '@/services/storage/storage.db';
import type { Result, UUID, ISODateString } from '@/shared/types/common.types';
import type { AchievedMilestone } from '@/shared/types/milestone.types';
import type { AchievedMilestoneRecord } from '@/services/storage/storage.schema';
import { generateUUID } from '@/services/crypto/crypto.utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeError(code: string, message: string, cause?: unknown): Result<never> {
  return {
    success: false,
    error: {
      code,
      message,
      context: cause instanceof Error ? { cause: cause.message } : undefined,
    },
  };
}

function recordToAchieved(r: AchievedMilestoneRecord): AchievedMilestone {
  return {
    id: r.id as UUID,
    userId: r.userId as UUID,
    milestoneId: r.milestoneId,
    achievedAt: r.achievedAt as ISODateString,
    netWorthAtAchievement: r.netWorthAtAchievement,
    acknowledged: r.acknowledged === 1,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const milestoneStorage = {
  /**
   * Record a new achieved milestone. Idempotent — same userId + milestoneId
   * is recorded at most once. Returns existing record if already present.
   */
  async recordAchievement(
    userId: UUID,
    milestoneId: number,
    netWorth: number
  ): Promise<Result<AchievedMilestone>> {
    try {
      const db = await getDB();

      // Idempotency check
      const index = (await db
        .transaction('achieved_milestones', 'readonly')
        .objectStore('achieved_milestones')
        .index('userId')
        .getAll(userId)) as AchievedMilestoneRecord[];

      const existing = index.find((r) => r.milestoneId === milestoneId);
      if (existing) {
        return { success: true, data: recordToAchieved(existing) };
      }

      const id = generateUUID() as UUID;
      const record: AchievedMilestoneRecord = {
        id,
        userId,
        milestoneId,
        achievedAt: new Date().toISOString() as ISODateString,
        netWorthAtAchievement: netWorth,
        acknowledged: 0,
      };

      await db.put('achieved_milestones', record);
      return { success: true, data: recordToAchieved(record) };
    } catch (err) {
      return makeError('MILESTONE_RECORD_FAILED', 'Failed to record achievement.', err);
    }
  },

  /**
   * List all achieved milestones for a user, sorted by milestoneId ascending.
   */
  async listAchievedByUser(userId: UUID): Promise<Result<AchievedMilestone[]>> {
    try {
      const db = await getDB();
      const records = await db.getAllFromIndex('achieved_milestones', 'userId', userId);
      const sorted = records.slice().sort((a, b) => a.milestoneId - b.milestoneId);
      return { success: true, data: sorted.map(recordToAchieved) };
    } catch (err) {
      return makeError('MILESTONE_LIST_FAILED', 'Failed to list achievements.', err);
    }
  },

  /**
   * List all unacknowledged milestones for a user, sorted by milestoneId.
   */
  async listUnacknowledged(userId: UUID): Promise<Result<AchievedMilestone[]>> {
    try {
      const db = await getDB();
      const all = await db.getAllFromIndex('achieved_milestones', 'userId', userId);
      const unacked = all.filter((r) => r.acknowledged === 0);
      const sorted = unacked.sort((a, b) => a.milestoneId - b.milestoneId);
      return { success: true, data: sorted.map(recordToAchieved) };
    } catch (err) {
      return makeError(
        'MILESTONE_LIST_UNACKED_FAILED',
        'Failed to list unacknowledged achievements.',
        err
      );
    }
  },

  /**
   * Mark a single achievement as acknowledged.
   */
  async acknowledge(id: UUID): Promise<Result<void>> {
    try {
      const db = await getDB();
      const record = await db.get('achieved_milestones', id);
      if (!record) return { success: true, data: undefined };

      const updated: AchievedMilestoneRecord = { ...record, acknowledged: 1 };
      await db.put('achieved_milestones', updated);
      return { success: true, data: undefined };
    } catch (err) {
      return makeError('MILESTONE_ACK_FAILED', 'Failed to acknowledge milestone.', err);
    }
  },

  /**
   * Acknowledge all milestones for a user at once.
   */
  async acknowledgeAll(userId: UUID): Promise<Result<void>> {
    try {
      const db = await getDB();
      const all = await db.getAllFromIndex('achieved_milestones', 'userId', userId);
      const tx = db.transaction('achieved_milestones', 'readwrite');
      const store = tx.objectStore('achieved_milestones');
      for (const record of all) {
        if (record.acknowledged !== 1) {
          await store.put({ ...record, acknowledged: 1 });
        }
      }
      await tx.done;
      return { success: true, data: undefined };
    } catch (err) {
      return makeError('MILESTONE_ACK_ALL_FAILED', 'Failed to acknowledge all milestones.', err);
    }
  },

  /**
   * Check whether a specific milestoneId has already been recorded for a user.
   * Used for idempotency in the evaluation loop.
   */
  async hasAchieved(userId: UUID, milestoneId: number): Promise<boolean> {
    try {
      const db = await getDB();
      const all = await db.getAllFromIndex('achieved_milestones', 'userId', userId);
      return all.some((r) => r.milestoneId === milestoneId);
    } catch {
      return false;
    }
  },
};
