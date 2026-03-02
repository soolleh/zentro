import type { Result, UUID, ISODateString } from '@/shared/types/common.types';
import type { RecurringRule } from '@/shared/types/transaction.types';
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

export const recurringRuleStorage = {
  async createRule(
    rule: Omit<RecurringRule, 'id'>,
    key: CryptoKey
  ): Promise<Result<RecurringRule>> {
    try {
      const full: RecurringRule = {
        ...rule,
        id: generateUUID(),
      };
      const encrypted = await encryptData(key, full);
      if (!encrypted.success) return encrypted;
      const db = await getDB();
      await db.put('recurring_rules', {
        id: full.id,
        userId: full.userId,
        data: encrypted.data.data,
      });
      return { success: true, data: full };
    } catch (err) {
      return makeError('RECURRING_RULE_CREATE_FAILED', 'Failed to create recurring rule.', err);
    }
  },

  async getRuleById(id: UUID, key: CryptoKey): Promise<Result<RecurringRule | null>> {
    try {
      const db = await getDB();
      const record = await db.get('recurring_rules', id);
      if (!record) return { success: true, data: null };
      return await decryptData<RecurringRule>(key, { data: record.data });
    } catch (err) {
      return makeError('RECURRING_RULE_READ_FAILED', 'Failed to read recurring rule.', err);
    }
  },

  async listRulesByUser(userId: UUID, key: CryptoKey): Promise<Result<RecurringRule[]>> {
    try {
      const db = await getDB();
      const records = await db.getAllFromIndex('recurring_rules', 'userId', userId);
      const rules: RecurringRule[] = [];
      for (const record of records) {
        const result = await decryptData<RecurringRule>(key, { data: record.data });
        if (!result.success) return result;
        rules.push(result.data);
      }
      return { success: true, data: rules };
    } catch (err) {
      return makeError('RECURRING_RULE_LIST_FAILED', 'Failed to list recurring rules.', err);
    }
  },

  async updateRule(
    id: UUID,
    updates: Partial<RecurringRule>,
    key: CryptoKey
  ): Promise<Result<RecurringRule>> {
    try {
      const db = await getDB();
      const record = await db.get('recurring_rules', id);
      if (!record) {
        return makeError('RECURRING_RULE_NOT_FOUND', `No recurring rule found with id: ${id}`);
      }
      const existing = await decryptData<RecurringRule>(key, { data: record.data });
      if (!existing.success) return existing;
      const updated: RecurringRule = { ...existing.data, ...updates, id: existing.data.id };
      const encrypted = await encryptData(key, updated);
      if (!encrypted.success) return encrypted;
      await db.put('recurring_rules', {
        id: updated.id,
        userId: updated.userId,
        data: encrypted.data.data,
      });
      return { success: true, data: updated };
    } catch (err) {
      return makeError('RECURRING_RULE_UPDATE_FAILED', 'Failed to update recurring rule.', err);
    }
  },

  async deleteRule(id: UUID): Promise<Result<void>> {
    try {
      const db = await getDB();
      await db.delete('recurring_rules', id);
      return { success: true, data: undefined };
    } catch (err) {
      return makeError('RECURRING_RULE_DELETE_FAILED', 'Failed to delete recurring rule.', err);
    }
  },

  async updateLastGeneratedDate(
    id: UUID,
    date: ISODateString,
    key: CryptoKey
  ): Promise<Result<RecurringRule>> {
    return recurringRuleStorage.updateRule(id, { lastGeneratedDate: date }, key);
  },
};
