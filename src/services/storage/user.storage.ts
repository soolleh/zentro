import type { Result, UUID } from '@/shared/types/common.types';
import type { LocalUser } from '@/shared/types/user.types';
import { getDB } from './storage.db';
import { APP_ENCRYPTION_PASSPHRASE, APP_ENCRYPTION_SALT_BASE64 } from './storage.constants';
import { deriveCryptoKey, encryptData, decryptData } from '@/services/crypto/crypto.service';
import { base64ToBuffer } from '@/services/crypto/crypto.utils';

// ---------------------------------------------------------------------------
// App-level encryption key (lazy singleton)
// Protects user records at rest; derived from compile-time constants.
// ---------------------------------------------------------------------------
let appKeyPromise: Promise<CryptoKey> | null = null;

function getAppKey(): Promise<CryptoKey> {
  if (!appKeyPromise) {
    appKeyPromise = (async () => {
      const saltBuffer = base64ToBuffer(APP_ENCRYPTION_SALT_BASE64);
      const salt = new Uint8Array(saltBuffer);
      const result = await deriveCryptoKey(APP_ENCRYPTION_PASSPHRASE, salt);
      if (!result.success) {
        appKeyPromise = null;
        throw new Error(result.error.message);
      }
      return result.data;
    })();
  }
  return appKeyPromise;
}

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

export const userStorage = {
  async createUser(user: LocalUser): Promise<Result<LocalUser>> {
    try {
      const key = await getAppKey();
      const encrypted = await encryptData(key, user);
      if (!encrypted.success) return encrypted;
      const db = await getDB();
      await db.put('users', { id: user.id, emailHash: user.emailHash, data: encrypted.data.data });
      return { success: true, data: user };
    } catch (err) {
      return makeError('USER_CREATE_FAILED', 'Failed to create user.', err);
    }
  },

  async getUserById(id: UUID): Promise<Result<LocalUser>> {
    try {
      const key = await getAppKey();
      const db = await getDB();
      const record = await db.get('users', id);
      if (!record) {
        return makeError('USER_NOT_FOUND', `No user found with id: ${id}`);
      }
      return await decryptData<LocalUser>(key, { data: record.data });
    } catch (err) {
      return makeError('USER_READ_FAILED', 'Failed to read user.', err);
    }
  },

  async getUserByEmailHash(emailHash: string): Promise<Result<LocalUser>> {
    try {
      const key = await getAppKey();
      const db = await getDB();
      const record = await db.getFromIndex('users', 'emailHash', emailHash);
      if (!record) {
        return makeError('USER_NOT_FOUND', 'No user found with that email.');
      }
      return await decryptData<LocalUser>(key, { data: record.data });
    } catch (err) {
      return makeError('USER_READ_FAILED', 'Failed to read user by email hash.', err);
    }
  },

  async listUsers(): Promise<Result<LocalUser[]>> {
    try {
      const key = await getAppKey();
      const db = await getDB();
      const records = await db.getAll('users');
      const users: LocalUser[] = [];
      for (const record of records) {
        const result = await decryptData<LocalUser>(key, { data: record.data });
        if (!result.success) return result;
        users.push(result.data);
      }
      return { success: true, data: users };
    } catch (err) {
      return makeError('USER_LIST_FAILED', 'Failed to list users.', err);
    }
  },

  async updateUser(user: LocalUser): Promise<Result<LocalUser>> {
    try {
      const key = await getAppKey();
      const db = await getDB();
      const existing = await db.get('users', user.id);
      if (!existing) {
        return makeError('USER_NOT_FOUND', `No user found with id: ${user.id}`);
      }
      const encrypted = await encryptData(key, user);
      if (!encrypted.success) return encrypted;
      await db.put('users', { id: user.id, emailHash: user.emailHash, data: encrypted.data.data });
      return { success: true, data: user };
    } catch (err) {
      return makeError('USER_UPDATE_FAILED', 'Failed to update user.', err);
    }
  },

  async deleteUser(id: UUID): Promise<Result<void>> {
    try {
      const db = await getDB();
      await db.delete('users', id);
      return { success: true, data: undefined };
    } catch (err) {
      return makeError('USER_DELETE_FAILED', 'Failed to delete user.', err);
    }
  },
};
