import type { Result, UUID, ISODateString } from '@/shared/types/common.types';
import type { Budget } from '@/shared/types/budget.types';
import { getDB } from './storage.db';
import { encryptData } from '@/services/crypto/crypto.service';
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

const NOT_IMPLEMENTED: Result<never> = {
  success: false,
  error: { code: 'NOT_IMPLEMENTED', message: 'Not yet implemented' },
};

export const budgetStorage = {
  async createBudget(
    budget: Omit<Budget, 'id' | 'createdAt'>,
    key: CryptoKey
  ): Promise<Result<Budget>> {
    try {
      const now = new Date().toISOString() as ISODateString;
      const full: Budget = { ...budget, id: generateUUID(), createdAt: now };
      const encrypted = await encryptData(key, full);
      if (!encrypted.success) return encrypted;
      const db = await getDB();
      await db.put('budgets', {
        id: full.id,
        userId: full.userId,
        categoryId: full.categoryId,
        cycleStart: full.cycleStart,
        data: encrypted.data.data,
      });
      return { success: true, data: full };
    } catch (err) {
      return makeError('BUDGET_CREATE_FAILED', 'Failed to create budget.', err);
    }
  },

  async getBudgetById(_id: UUID): Promise<Result<Budget>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async listBudgetsByUser(_userId: UUID): Promise<Result<Budget[]>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async listBudgetsByCycle(_userId: UUID, _cycleStart: ISODateString): Promise<Result<Budget[]>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async updateBudget(_budget: Budget): Promise<Result<Budget>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async deleteBudget(_id: UUID): Promise<Result<void>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },
};
