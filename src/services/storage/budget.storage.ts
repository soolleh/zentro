import type { Result, UUID, ISODateString } from '@/shared/types/common.types';
import type { Budget, CycleDates } from '@/shared/types/budget.types';
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

  async getBudgetById(id: UUID, key: CryptoKey): Promise<Result<Budget | null>> {
    try {
      const db = await getDB();
      const record = await db.get('budgets', id);
      if (!record) return { success: true, data: null };
      return await decryptData<Budget>(key, { data: record.data });
    } catch (err) {
      return makeError('BUDGET_READ_FAILED', 'Failed to read budget.', err);
    }
  },

  async listBudgetsByUser(userId: UUID, key: CryptoKey): Promise<Result<Budget[]>> {
    try {
      const db = await getDB();
      const records = await db.getAllFromIndex('budgets', 'userId', userId);
      const budgets: Budget[] = [];
      for (const record of records) {
        const result = await decryptData<Budget>(key, { data: record.data });
        if (!result.success) return result;
        budgets.push(result.data);
      }
      budgets.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return { success: true, data: budgets };
    } catch (err) {
      return makeError('BUDGET_LIST_FAILED', 'Failed to list budgets.', err);
    }
  },

  async listBudgetsByCycle(
    userId: UUID,
    cycleStart: ISODateString,
    key: CryptoKey
  ): Promise<Result<Budget[]>> {
    try {
      const db = await getDB();
      const records = await db.getAllFromIndex('budgets', 'userId', userId);
      const filtered = records.filter((r) => r.cycleStart === cycleStart);
      const budgets: Budget[] = [];
      for (const record of filtered) {
        const result = await decryptData<Budget>(key, { data: record.data });
        if (!result.success) return result;
        budgets.push(result.data);
      }
      return { success: true, data: budgets };
    } catch (err) {
      return makeError('BUDGET_LIST_FAILED', 'Failed to list budgets by cycle.', err);
    }
  },

  async updateBudget(
    id: UUID,
    updates: Partial<Omit<Budget, 'id' | 'createdAt'>>,
    key: CryptoKey
  ): Promise<Result<Budget>> {
    try {
      const db = await getDB();
      const record = await db.get('budgets', id);
      if (!record) return makeError('BUDGET_NOT_FOUND', `No budget found with id: ${id}`);
      const existing = await decryptData<Budget>(key, { data: record.data });
      if (!existing.success) return existing;
      const updated: Budget = {
        ...existing.data,
        ...updates,
        id: existing.data.id,
        createdAt: existing.data.createdAt,
      };
      const encrypted = await encryptData(key, updated);
      if (!encrypted.success) return encrypted;
      await db.put('budgets', {
        id: updated.id,
        userId: updated.userId,
        categoryId: updated.categoryId,
        cycleStart: updated.cycleStart,
        data: encrypted.data.data,
      });
      return { success: true, data: updated };
    } catch (err) {
      return makeError('BUDGET_UPDATE_FAILED', 'Failed to update budget.', err);
    }
  },

  async deleteBudget(id: UUID): Promise<Result<void>> {
    try {
      const db = await getDB();
      await db.delete('budgets', id);
      return { success: true, data: undefined };
    } catch (err) {
      return makeError('BUDGET_DELETE_FAILED', 'Failed to delete budget.', err);
    }
  },

  async copyBudgetsToNextCycle(
    userId: UUID,
    fromCycleStart: ISODateString,
    toCycleDates: CycleDates,
    key: CryptoKey
  ): Promise<Result<Budget[]>> {
    try {
      const [fromResult, toResult] = await Promise.all([
        budgetStorage.listBudgetsByCycle(userId, fromCycleStart, key),
        budgetStorage.listBudgetsByCycle(userId, toCycleDates.cycleStart, key),
      ]);
      if (!fromResult.success) return fromResult;
      if (!toResult.success) return toResult;

      const existingCategoryIds = new Set(toResult.data.map((b) => b.categoryId));
      const created: Budget[] = [];

      for (const source of fromResult.data) {
        if (existingCategoryIds.has(source.categoryId)) continue;
        const newBudget: Omit<Budget, 'id' | 'createdAt'> = {
          userId: source.userId,
          categoryId: source.categoryId,
          amount: source.amount,
          currency: source.currency,
          cycleStart: toCycleDates.cycleStart,
          cycleEnd: toCycleDates.cycleEnd,
          carryForward: source.carryForward,
          alertThreshold: source.alertThreshold,
        };
        const result = await budgetStorage.createBudget(newBudget, key);
        if (!result.success) return result;
        created.push(result.data);
      }

      return { success: true, data: created };
    } catch (err) {
      return makeError('BUDGET_COPY_FAILED', 'Failed to copy budgets to next cycle.', err);
    }
  },
};
