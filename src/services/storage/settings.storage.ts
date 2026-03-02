import type { Result, UUID } from '@/shared/types/common.types';
import type { UserSettings } from '@/shared/types/settings.types';
import { getDB } from './storage.db';
import { encryptData, decryptData } from '@/services/crypto/crypto.service';

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

export const settingsStorage = {
  /**
   * Retrieve settings for a user. Requires the user's derived CryptoKey.
   */
  async getSettingsByUser(userId: UUID, key: CryptoKey): Promise<Result<UserSettings>> {
    try {
      const db = await getDB();
      const record = await db.get('user_settings', userId);
      if (!record) {
        return makeError('SETTINGS_NOT_FOUND', 'No settings found for this user.');
      }
      return await decryptData<UserSettings>(key, { data: record.data });
    } catch (err) {
      return makeError('SETTINGS_READ_FAILED', 'Failed to read user settings.', err);
    }
  },

  /**
   * Create or update settings for a user. Requires the user's derived CryptoKey.
   * The IDB key for settings is the userId.
   */
  async upsertSettings(settings: UserSettings, key: CryptoKey): Promise<Result<UserSettings>> {
    try {
      const encrypted = await encryptData(key, settings);
      if (!encrypted.success) return encrypted;
      const db = await getDB();
      await db.put('user_settings', { id: settings.userId, data: encrypted.data.data });
      return { success: true, data: settings };
    } catch (err) {
      return makeError('SETTINGS_WRITE_FAILED', 'Failed to save user settings.', err);
    }
  },
};
