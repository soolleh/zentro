/**
 * alert.storage.ts
 *
 * Encrypted IndexedDB storage for account balance alerts.
 * All financial data is AES-GCM encrypted before storage.
 * All methods return Result<T>. No throws.
 */
import type { Result, UUID, ISODateString } from '@/shared/types/common.types';
import type { AccountAlert } from '@/shared/types/alert.types';
import { getDB } from './storage.db';
import { encryptData, decryptData } from '@/services/crypto/crypto.service';
import { generateUUID } from '@/services/crypto/crypto.utils';

const MAX_ALERTS_PER_ACCOUNT = 5;

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

export const alertStorage = {
  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  async createAlert(
    alert: Omit<AccountAlert, 'id' | 'createdAt' | 'updatedAt'>,
    key: CryptoKey
  ): Promise<Result<AccountAlert>> {
    try {
      // Enforce max 5 alerts per account per user
      const countResult = await alertStorage.listAlertsByAccount(alert.accountId, key, true);
      if (!countResult.success) return countResult;
      if (countResult.data.length >= MAX_ALERTS_PER_ACCOUNT) {
        return makeError(
          'TOO_MANY_ALERTS',
          `Maximum ${MAX_ALERTS_PER_ACCOUNT.toString()} alerts per account allowed.`
        );
      }

      const now = new Date().toISOString() as ISODateString;
      const full: AccountAlert = {
        ...alert,
        id: generateUUID(),
        createdAt: now,
        updatedAt: now,
      };

      const encrypted = await encryptData(key, full);
      if (!encrypted.success) return encrypted;

      const db = await getDB();
      await db.put('account_alerts', {
        id: full.id,
        userId: full.userId,
        accountId: full.accountId,
        status: full.status,
        data: encrypted.data.data,
      });

      return { success: true, data: full };
    } catch (err) {
      return makeError('ALERT_CREATE_FAILED', 'Failed to create alert.', err);
    }
  },

  // ---------------------------------------------------------------------------
  // READ
  // ---------------------------------------------------------------------------

  async getAlertById(id: UUID, key: CryptoKey): Promise<Result<AccountAlert | null>> {
    try {
      const db = await getDB();
      const record = await db.get('account_alerts', id);
      if (!record) return { success: true, data: null };
      return await decryptData<AccountAlert>(key, { data: record.data });
    } catch (err) {
      return makeError('ALERT_READ_FAILED', 'Failed to read alert.', err);
    }
  },

  async listAlertsByUser(userId: UUID, key: CryptoKey): Promise<Result<AccountAlert[]>> {
    try {
      const db = await getDB();
      const records = await db.getAllFromIndex('account_alerts', 'userId', userId);
      const alerts: AccountAlert[] = [];
      for (const record of records) {
        const result = await decryptData<AccountAlert>(key, { data: record.data });
        if (!result.success) return result;
        alerts.push(result.data);
      }
      alerts.sort((a, b) => {
        if (a.accountId < b.accountId) return -1;
        if (a.accountId > b.accountId) return 1;
        return a.createdAt.localeCompare(b.createdAt);
      });
      return { success: true, data: alerts };
    } catch (err) {
      return makeError('ALERT_LIST_FAILED', 'Failed to list alerts.', err);
    }
  },

  /**
   * List all alerts for an account.
   * By default only returns isEnabled: true alerts.
   * Pass `includeDisabled: true` to include all.
   */
  async listAlertsByAccount(
    accountId: UUID,
    key: CryptoKey,
    includeDisabled = false
  ): Promise<Result<AccountAlert[]>> {
    try {
      const db = await getDB();
      const records = await db.getAllFromIndex('account_alerts', 'accountId', accountId);
      const alerts: AccountAlert[] = [];
      for (const record of records) {
        const result = await decryptData<AccountAlert>(key, { data: record.data });
        if (!result.success) return result;
        if (!includeDisabled && !result.data.isEnabled) continue;
        alerts.push(result.data);
      }
      alerts.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return { success: true, data: alerts };
    } catch (err) {
      return makeError('ALERT_LIST_FAILED', 'Failed to list alerts for account.', err);
    }
  },

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  async updateAlert(
    id: UUID,
    updates: Partial<AccountAlert>,
    key: CryptoKey
  ): Promise<Result<AccountAlert>> {
    try {
      const db = await getDB();
      const existing = await db.get('account_alerts', id);
      if (!existing) return makeError('ALERT_NOT_FOUND', 'Alert not found.');

      const decrypted = await decryptData<AccountAlert>(key, { data: existing.data });
      if (!decrypted.success) return decrypted;

      const now = new Date().toISOString() as ISODateString;
      const updated: AccountAlert = { ...decrypted.data, ...updates, updatedAt: now };

      const encrypted = await encryptData(key, updated);
      if (!encrypted.success) return encrypted;

      await db.put('account_alerts', {
        id: updated.id,
        userId: updated.userId,
        accountId: updated.accountId,
        status: updated.status,
        data: encrypted.data.data,
      });

      return { success: true, data: updated };
    } catch (err) {
      return makeError('ALERT_UPDATE_FAILED', 'Failed to update alert.', err);
    }
  },

  async deleteAlert(id: UUID): Promise<Result<void>> {
    try {
      const db = await getDB();
      await db.delete('account_alerts', id);
      return { success: true, data: undefined };
    } catch (err) {
      return makeError('ALERT_DELETE_FAILED', 'Failed to delete alert.', err);
    }
  },

  // ---------------------------------------------------------------------------
  // STATUS HELPERS
  // ---------------------------------------------------------------------------

  async markAlertTriggered(
    id: UUID,
    balance: number,
    key: CryptoKey
  ): Promise<Result<AccountAlert>> {
    try {
      const db = await getDB();
      const existing = await db.get('account_alerts', id);
      if (!existing) return makeError('ALERT_NOT_FOUND', 'Alert not found.');

      const decrypted = await decryptData<AccountAlert>(key, { data: existing.data });
      if (!decrypted.success) return decrypted;

      const now = new Date().toISOString() as ISODateString;
      const updated: AccountAlert = {
        ...decrypted.data,
        status: 'triggered',
        lastTriggeredAt: now,
        lastTriggeredBalance: balance,
        updatedAt: now,
      };

      const encrypted = await encryptData(key, updated);
      if (!encrypted.success) return encrypted;

      await db.put('account_alerts', {
        id: updated.id,
        userId: updated.userId,
        accountId: updated.accountId,
        status: updated.status,
        data: encrypted.data.data,
      });

      return { success: true, data: updated };
    } catch (err) {
      return makeError('ALERT_MARK_TRIGGERED_FAILED', 'Failed to mark alert triggered.', err);
    }
  },

  async snoozeAlert(id: UUID, until: ISODateString, key: CryptoKey): Promise<Result<AccountAlert>> {
    try {
      const db = await getDB();
      const existing = await db.get('account_alerts', id);
      if (!existing) return makeError('ALERT_NOT_FOUND', 'Alert not found.');

      const decrypted = await decryptData<AccountAlert>(key, { data: existing.data });
      if (!decrypted.success) return decrypted;

      const now = new Date().toISOString() as ISODateString;
      const updated: AccountAlert = {
        ...decrypted.data,
        status: 'snoozed',
        snoozeUntil: until,
        updatedAt: now,
      };

      const encrypted = await encryptData(key, updated);
      if (!encrypted.success) return encrypted;

      await db.put('account_alerts', {
        id: updated.id,
        userId: updated.userId,
        accountId: updated.accountId,
        status: updated.status,
        data: encrypted.data.data,
      });

      return { success: true, data: updated };
    } catch (err) {
      return makeError('ALERT_SNOOZE_FAILED', 'Failed to snooze alert.', err);
    }
  },

  async resetAlertStatus(id: UUID, key: CryptoKey): Promise<Result<AccountAlert>> {
    try {
      const db = await getDB();
      const existing = await db.get('account_alerts', id);
      if (!existing) return makeError('ALERT_NOT_FOUND', 'Alert not found.');

      const decrypted = await decryptData<AccountAlert>(key, { data: existing.data });
      if (!decrypted.success) return decrypted;

      const now = new Date().toISOString() as ISODateString;
      const updated: AccountAlert = {
        ...decrypted.data,
        status: 'active',
        snoozeUntil: null,
        updatedAt: now,
      };

      const encrypted = await encryptData(key, updated);
      if (!encrypted.success) return encrypted;

      await db.put('account_alerts', {
        id: updated.id,
        userId: updated.userId,
        accountId: updated.accountId,
        status: updated.status,
        data: encrypted.data.data,
      });

      return { success: true, data: updated };
    } catch (err) {
      return makeError('ALERT_RESET_FAILED', 'Failed to reset alert status.', err);
    }
  },
};
