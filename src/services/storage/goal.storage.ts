import type { Result, UUID, ISODateString } from '@/shared/types/common.types';
import type { Goal } from '@/shared/types/goal.types';
import { getDB } from './storage.db';
import { encryptData, decryptData } from '@/services/crypto/crypto.service';
import { generateUUID } from '@/services/crypto/crypto.utils';

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

export const goalStorage = {
  async createGoal(goal: Omit<Goal, 'id' | 'createdAt'>, key: CryptoKey): Promise<Result<Goal>> {
    try {
      const now = new Date().toISOString() as ISODateString;
      const full: Goal = {
        ...goal,
        id: generateUUID(),
        createdAt: now,
      };
      const encrypted = await encryptData(key, full);
      if (!encrypted.success) return encrypted;
      const db = await getDB();
      await db.put('goals', {
        id: full.id,
        userId: full.userId,
        data: encrypted.data.data,
      });
      return { success: true, data: full };
    } catch (err) {
      return makeError('GOAL_CREATE_FAILED', 'Failed to create goal.', err);
    }
  },

  async getGoalById(id: UUID, key: CryptoKey): Promise<Result<Goal | null>> {
    try {
      const db = await getDB();
      const record = await db.get('goals', id);
      if (!record) return { success: true, data: null };
      return await decryptData<Goal>(key, { data: record.data });
    } catch (err) {
      return makeError('GOAL_READ_FAILED', 'Failed to read goal.', err);
    }
  },

  async listGoalsByUser(userId: UUID, key: CryptoKey): Promise<Result<Goal[]>> {
    try {
      const db = await getDB();
      const records = await db.getAllFromIndex('goals', 'userId', userId);
      const goals: Goal[] = [];
      for (const record of records) {
        const result = await decryptData<Goal>(key, { data: record.data });
        if (!result.success) return result;
        goals.push(result.data);
      }
      return { success: true, data: goals };
    } catch (err) {
      return makeError('GOAL_LIST_FAILED', 'Failed to list goals.', err);
    }
  },

  async updateGoal(
    id: UUID,
    updates: Partial<Omit<Goal, 'id' | 'createdAt'>>,
    key: CryptoKey
  ): Promise<Result<Goal>> {
    try {
      const db = await getDB();
      const existing = await db.get('goals', id);
      if (!existing) {
        return makeError('GOAL_NOT_FOUND', `No goal found with id: ${id}`);
      }
      const decrypted = await decryptData<Goal>(key, { data: existing.data });
      if (!decrypted.success) return decrypted;
      const updated: Goal = {
        ...decrypted.data,
        ...updates,
        id: decrypted.data.id,
        createdAt: decrypted.data.createdAt,
      };
      const encrypted = await encryptData(key, updated);
      if (!encrypted.success) return encrypted;
      await db.put('goals', {
        id: updated.id,
        userId: updated.userId,
        data: encrypted.data.data,
      });
      return { success: true, data: updated };
    } catch (err) {
      return makeError('GOAL_UPDATE_FAILED', 'Failed to update goal.', err);
    }
  },

  async deleteGoal(id: UUID): Promise<Result<void>> {
    try {
      const db = await getDB();
      await db.delete('goals', id);
      return { success: true, data: undefined };
    } catch (err) {
      return makeError('GOAL_DELETE_FAILED', 'Failed to delete goal.', err);
    }
  },
};
