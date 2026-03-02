import type { Result, UUID, ISODateString } from '@/shared/types/common.types';
import type { Account } from '@/shared/types/account.types';
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

export const accountStorage = {
  async createAccount(
    account: Omit<Account, 'id' | 'createdAt'>,
    key: CryptoKey
  ): Promise<Result<Account>> {
    try {
      const now = new Date().toISOString() as ISODateString;
      const full: Account = {
        ...account,
        id: generateUUID(),
        createdAt: now,
      };
      const encrypted = await encryptData(key, full);
      if (!encrypted.success) return encrypted;
      const db = await getDB();
      await db.put('accounts', {
        id: full.id,
        userId: full.userId,
        type: full.type,
        data: encrypted.data.data,
      });
      return { success: true, data: full };
    } catch (err) {
      return makeError('ACCOUNT_CREATE_FAILED', 'Failed to create account.', err);
    }
  },

  async getAccountById(id: UUID, key: CryptoKey): Promise<Result<Account | null>> {
    try {
      const db = await getDB();
      const record = await db.get('accounts', id);
      if (!record) return { success: true, data: null };
      return await decryptData<Account>(key, { data: record.data });
    } catch (err) {
      return makeError('ACCOUNT_READ_FAILED', 'Failed to read account.', err);
    }
  },

  async listAccountsByUser(userId: UUID, key: CryptoKey): Promise<Result<Account[]>> {
    try {
      const db = await getDB();
      const records = await db.getAllFromIndex('accounts', 'userId', userId);
      const accounts: Account[] = [];
      for (const record of records) {
        const result = await decryptData<Account>(key, { data: record.data });
        if (!result.success) return result;
        accounts.push(result.data);
      }
      accounts.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return { success: true, data: accounts };
    } catch (err) {
      return makeError('ACCOUNT_LIST_FAILED', 'Failed to list accounts.', err);
    }
  },

  async updateAccount(
    id: UUID,
    updates: Partial<Omit<Account, 'id' | 'createdAt'>>,
    key: CryptoKey
  ): Promise<Result<Account>> {
    try {
      const db = await getDB();
      const existing = await db.get('accounts', id);
      if (!existing) {
        return makeError('ACCOUNT_NOT_FOUND', `No account found with id: ${id}`);
      }
      const decrypted = await decryptData<Account>(key, { data: existing.data });
      if (!decrypted.success) return decrypted;
      const updated: Account = {
        ...decrypted.data,
        ...updates,
        id: decrypted.data.id,
        createdAt: decrypted.data.createdAt,
        updatedAt: new Date().toISOString() as ISODateString,
      };
      const encrypted = await encryptData(key, updated);
      if (!encrypted.success) return encrypted;
      await db.put('accounts', {
        id: updated.id,
        userId: updated.userId,
        type: updated.type,
        data: encrypted.data.data,
      });
      return { success: true, data: updated };
    } catch (err) {
      return makeError('ACCOUNT_UPDATE_FAILED', 'Failed to update account.', err);
    }
  },

  async deleteAccount(id: UUID): Promise<Result<void>> {
    try {
      const db = await getDB();
      await db.delete('accounts', id);
      return { success: true, data: undefined };
    } catch (err) {
      return makeError('ACCOUNT_DELETE_FAILED', 'Failed to delete account.', err);
    }
  },
};
