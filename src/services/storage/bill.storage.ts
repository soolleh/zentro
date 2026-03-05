import type { Result, UUID, ISODateString } from '@/shared/types/common.types';
import type { Bill, CreateBillInput, UpdateBillInput } from '@/shared/types/bill.types';
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

export const billStorage = {
  async createBill(input: CreateBillInput, key: CryptoKey): Promise<Result<Bill>> {
    try {
      const now = new Date().toISOString() as ISODateString;
      const bill: Bill = {
        ...input,
        id: generateUUID(),
        recurringRuleId: input.recurringRuleId ?? null,
        createdAt: now,
        updatedAt: now,
      };
      const encrypted = await encryptData(key, bill);
      if (!encrypted.success) return encrypted;
      const db = await getDB();
      await db.put('bills', {
        id: bill.id,
        userId: bill.userId,
        data: encrypted.data.data,
      });
      return { success: true, data: bill };
    } catch (err) {
      return makeError('BILL_CREATE_FAILED', 'Failed to create bill.', err);
    }
  },

  async getBillById(id: UUID, key: CryptoKey): Promise<Result<Bill | null>> {
    try {
      const db = await getDB();
      const record = await db.get('bills', id);
      if (!record) return { success: true, data: null };
      return await decryptData<Bill>(key, { data: record.data });
    } catch (err) {
      return makeError('BILL_READ_FAILED', 'Failed to read bill.', err);
    }
  },

  async listBillsByUser(userId: UUID, key: CryptoKey): Promise<Result<Bill[]>> {
    try {
      const db = await getDB();
      const records = await db.getAllFromIndex('bills', 'userId', userId);
      const bills: Bill[] = [];
      for (const record of records) {
        const result = await decryptData<Bill>(key, { data: record.data });
        if (!result.success) return result;
        bills.push(result.data);
      }
      bills.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return { success: true, data: bills };
    } catch (err) {
      return makeError('BILL_LIST_FAILED', 'Failed to list bills.', err);
    }
  },

  async updateBill(id: UUID, updates: UpdateBillInput, key: CryptoKey): Promise<Result<Bill>> {
    try {
      const db = await getDB();
      const record = await db.get('bills', id);
      if (!record) {
        return makeError('BILL_NOT_FOUND', `No bill found with id: ${id}`);
      }
      const decrypted = await decryptData<Bill>(key, { data: record.data });
      if (!decrypted.success) return decrypted;
      const updated: Bill = {
        ...decrypted.data,
        ...updates,
        id: decrypted.data.id,
        userId: decrypted.data.userId,
        createdAt: decrypted.data.createdAt,
        updatedAt: new Date().toISOString() as ISODateString,
      };
      const encrypted = await encryptData(key, updated);
      if (!encrypted.success) return encrypted;
      await db.put('bills', {
        id: updated.id,
        userId: updated.userId,
        data: encrypted.data.data,
      });
      return { success: true, data: updated };
    } catch (err) {
      return makeError('BILL_UPDATE_FAILED', 'Failed to update bill.', err);
    }
  },

  async deleteBill(id: UUID): Promise<Result<void>> {
    try {
      const db = await getDB();
      await db.delete('bills', id);
      return { success: true, data: undefined };
    } catch (err) {
      return makeError('BILL_DELETE_FAILED', 'Failed to delete bill.', err);
    }
  },
};
