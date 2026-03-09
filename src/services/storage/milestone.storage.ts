/**
 * milestone.storage.ts
 *
 * CRUD for the net_worth_milestones IndexedDB store.
 * NOT encrypted — milestone data contains only public threshold constants,
 * approximate achievedAt timestamps, and rounded net worth values.
 * No account names, transaction details, or sensitive user data.
 *
 * All methods return Result<T>. No throws.
 */
import { getDB } from '@/services/storage/storage.db';
import type { Result, UUID, ISODateString } from '@/shared/types/common.types';
import type { NetWorthMilestone, MilestoneType } from '@/shared/types/milestone.types';
import type { MilestoneRecord } from '@/services/storage/storage.schema';
import { generateUUID } from '@/services/crypto/crypto.utils';

// ---------------------------------------------------------------------------
// helpers
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

function recordToMilestone(r: MilestoneRecord): NetWorthMilestone {
  return {
    id: r.id as UUID,
    userId: r.userId as UUID,
    type: r.type as MilestoneType,
    threshold: r.threshold,
    label: r.label,
    emoji: r.emoji,
    tier: r.tier as NetWorthMilestone['tier'],
    achievedAt: r.achievedAt as ISODateString,
    netWorthAtAchievement: r.netWorthAtAchievement,
    acknowledged: r.acknowledged === 1,
  };
}

function milestoneToRecord(m: NetWorthMilestone): MilestoneRecord {
  return {
    id: m.id,
    userId: m.userId,
    type: m.type,
    threshold: m.threshold,
    label: m.label,
    emoji: m.emoji,
    tier: m.tier,
    achievedAt: m.achievedAt,
    netWorthAtAchievement: m.netWorthAtAchievement,
    acknowledged: m.acknowledged ? 1 : 0,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const milestoneStorage = {
  /**
   * Record a new milestone (idempotent).
   * If the same userId + type + threshold already exists, returns the existing record.
   */
  async recordMilestone(
    milestone: Omit<NetWorthMilestone, 'id'>
  ): Promise<Result<NetWorthMilestone>> {
    try {
      const db = await getDB();

      // Idempotency check
      const existing = await this.getMilestoneByThreshold(
        milestone.userId,
        milestone.type,
        milestone.threshold
      );
      if (existing.success && existing.data !== null) {
        return { success: true, data: existing.data };
      }

      const id = generateUUID() as UUID;
      const record = milestoneToRecord({ ...milestone, id });
      await db.put('net_worth_milestones', record);
      return { success: true, data: recordToMilestone(record) };
    } catch (err) {
      return makeError('MILESTONE_CREATE_FAILED', 'Failed to record milestone.', err);
    }
  },

  /**
   * List all milestones for a user, sorted by achievedAt descending.
   */
  async listMilestonesByUser(userId: UUID): Promise<Result<NetWorthMilestone[]>> {
    try {
      const db = await getDB();
      const records = await db.getAllFromIndex('net_worth_milestones', 'userId', userId);
      const sorted = records.sort((a, b) => b.achievedAt.localeCompare(a.achievedAt));
      return { success: true, data: sorted.map(recordToMilestone) };
    } catch (err) {
      return makeError('MILESTONE_LIST_FAILED', 'Failed to list milestones.', err);
    }
  },

  /**
   * List unacknowledged milestones, sorted by achievedAt ascending (oldest first).
   */
  async listUnacknowledgedMilestones(userId: UUID): Promise<Result<NetWorthMilestone[]>> {
    try {
      const db = await getDB();
      const all = await db.getAllFromIndex('net_worth_milestones', 'userId', userId);
      const unacked = all
        .filter((r) => r.acknowledged === 0)
        .sort((a, b) => a.achievedAt.localeCompare(b.achievedAt));
      return { success: true, data: unacked.map(recordToMilestone) };
    } catch (err) {
      return makeError(
        'MILESTONE_LIST_UNACKED_FAILED',
        'Failed to list unacknowledged milestones.',
        err
      );
    }
  },

  /**
   * Mark a single milestone as acknowledged.
   */
  async acknowledgeMilestone(id: UUID): Promise<Result<void>> {
    try {
      const db = await getDB();
      const record = await db.get('net_worth_milestones', id);
      if (!record) return { success: true, data: undefined };
      record.acknowledged = 1;
      await db.put('net_worth_milestones', record);
      return { success: true, data: undefined };
    } catch (err) {
      return makeError('MILESTONE_ACK_FAILED', 'Failed to acknowledge milestone.', err);
    }
  },

  /**
   * Mark ALL unacknowledged milestones for a user as acknowledged.
   */
  async acknowledgeAllMilestones(userId: UUID): Promise<Result<void>> {
    try {
      const db = await getDB();
      const all = await db.getAllFromIndex('net_worth_milestones', 'userId', userId);
      const unacked = all.filter((r) => r.acknowledged === 0);
      const tx = db.transaction('net_worth_milestones', 'readwrite');
      await Promise.all(
        unacked.map((r) => {
          r.acknowledged = 1;
          return tx.store.put(r);
        })
      );
      await tx.done;
      return { success: true, data: undefined };
    } catch (err) {
      return makeError('MILESTONE_ACK_ALL_FAILED', 'Failed to acknowledge all milestones.', err);
    }
  },

  /**
   * Look up a milestone by userId + type + threshold (for idempotency check).
   * Returns null if not found.
   */
  async getMilestoneByThreshold(
    userId: UUID,
    type: MilestoneType,
    threshold: number
  ): Promise<Result<NetWorthMilestone | null>> {
    try {
      const db = await getDB();
      const all = await db.getAllFromIndex('net_worth_milestones', 'userId', userId);
      const match = all.find((r) => r.type === type && r.threshold === threshold);
      return { success: true, data: match ? recordToMilestone(match) : null };
    } catch (err) {
      return makeError('MILESTONE_GET_FAILED', 'Failed to get milestone.', err);
    }
  },
};
