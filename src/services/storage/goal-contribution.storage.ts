import type { Result, UUID } from '@/shared/types/common.types';
import type { GoalContribution } from '@/shared/types/goal.types';
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

export const goalContributionStorage = {
  async createContribution(
    contribution: Omit<GoalContribution, 'id'>,
    key: CryptoKey
  ): Promise<Result<GoalContribution>> {
    try {
      const full: GoalContribution = {
        ...contribution,
        id: generateUUID(),
      };
      const encrypted = await encryptData(key, full);
      if (!encrypted.success) return encrypted;
      const db = await getDB();
      await db.put('goal_contributions', {
        id: full.id,
        goalId: full.goalId,
        fromAccountId: full.fromAccountId,
        data: encrypted.data.data,
      });
      return { success: true, data: full };
    } catch (err) {
      return makeError('CONTRIBUTION_CREATE_FAILED', 'Failed to create contribution.', err);
    }
  },

  async getContributionById(id: UUID, key: CryptoKey): Promise<Result<GoalContribution | null>> {
    try {
      const db = await getDB();
      const record = await db.get('goal_contributions', id);
      if (!record) return { success: true, data: null };
      return await decryptData<GoalContribution>(key, { data: record.data });
    } catch (err) {
      return makeError('CONTRIBUTION_READ_FAILED', 'Failed to read contribution.', err);
    }
  },

  async listContributionsByGoal(goalId: UUID, key: CryptoKey): Promise<Result<GoalContribution[]>> {
    try {
      const db = await getDB();
      const records = await db.getAllFromIndex('goal_contributions', 'goalId', goalId);
      const contributions: GoalContribution[] = [];
      for (const record of records) {
        const result = await decryptData<GoalContribution>(key, { data: record.data });
        if (!result.success) return result;
        contributions.push(result.data);
      }
      contributions.sort((a, b) => b.date.localeCompare(a.date));
      return { success: true, data: contributions };
    } catch (err) {
      return makeError('CONTRIBUTION_LIST_FAILED', 'Failed to list contributions.', err);
    }
  },

  async deleteContribution(id: UUID): Promise<Result<void>> {
    try {
      const db = await getDB();
      await db.delete('goal_contributions', id);
      return { success: true, data: undefined };
    } catch (err) {
      return makeError('CONTRIBUTION_DELETE_FAILED', 'Failed to delete contribution.', err);
    }
  },

  async deleteAllContributionsForGoal(goalId: UUID, key: CryptoKey): Promise<Result<void>> {
    try {
      const listResult = await goalContributionStorage.listContributionsByGoal(goalId, key);
      if (!listResult.success) return listResult;
      const db = await getDB();
      for (const contribution of listResult.data) {
        await db.delete('goal_contributions', contribution.id);
      }
      return { success: true, data: undefined };
    } catch (err) {
      return makeError(
        'CONTRIBUTION_DELETE_ALL_FAILED',
        'Failed to delete all contributions for goal.',
        err
      );
    }
  },
};
