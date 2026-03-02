import type { Result, UUID } from '@/shared/types/common.types';
import type { BiometricCredential } from '@/shared/types/user.types';
import { getDB } from './storage.db';
import { encryptData, decryptData } from '@/services/crypto/crypto.service';
import { getAppEncryptionKey } from '@/services/crypto/app-key';

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

export const biometricStorage = {
  /**
   * Saves a biometric credential, encrypted with the app-level key.
   * One credential per user — upserts by credentialId (the store key path).
   * If the user already has a credential, it is replaced.
   */
  async saveBiometricCredential(
    credential: BiometricCredential
  ): Promise<Result<BiometricCredential>> {
    try {
      const appKey = await getAppEncryptionKey();
      const encrypted = await encryptData(appKey, credential);
      if (!encrypted.success) return encrypted;

      const db = await getDB();
      await db.put('biometric_credentials', {
        credentialId: credential.credentialId,
        userId: credential.userId,
        data: encrypted.data.data,
      });
      return { success: true, data: credential };
    } catch (err) {
      return makeError('BIOMETRIC_SAVE_FAILED', 'Failed to save biometric credential.', err);
    }
  },

  /**
   * Retrieves the biometric credential for a user, or null if not enrolled.
   */
  async getBiometricCredentialByUser(userId: UUID): Promise<Result<BiometricCredential | null>> {
    try {
      const db = await getDB();
      const record = await db.getFromIndex('biometric_credentials', 'userId', userId);
      if (!record) return { success: true, data: null };

      const appKey = await getAppEncryptionKey();
      const decrypted = await decryptData<BiometricCredential>(appKey, { data: record.data });
      if (!decrypted.success) return decrypted;
      return { success: true, data: decrypted.data };
    } catch (err) {
      return makeError('BIOMETRIC_READ_FAILED', 'Failed to read biometric credential.', err);
    }
  },

  /**
   * Retrieves a biometric credential by its WebAuthn credentialId.
   * Used internally by webauthn.service after successful verification.
   */
  async getBiometricCredentialByCredentialId(
    credentialId: string
  ): Promise<Result<BiometricCredential | null>> {
    try {
      const db = await getDB();
      const record = await db.get('biometric_credentials', credentialId);
      if (!record) return { success: true, data: null };

      const appKey = await getAppEncryptionKey();
      const decrypted = await decryptData<BiometricCredential>(appKey, { data: record.data });
      if (!decrypted.success) return decrypted;
      return { success: true, data: decrypted.data };
    } catch (err) {
      return makeError('BIOMETRIC_READ_FAILED', 'Failed to read biometric credential by ID.', err);
    }
  },

  /**
   * Removes the biometric credential for a user.
   * After this, biometric unlock is disabled until re-enrolled.
   */
  async deleteBiometricCredential(userId: UUID): Promise<Result<void>> {
    try {
      const db = await getDB();
      // Find the record by userId index
      const record = await db.getFromIndex('biometric_credentials', 'userId', userId);
      if (!record) return { success: true, data: undefined };

      await db.delete('biometric_credentials', record.credentialId);
      return { success: true, data: undefined };
    } catch (err) {
      return makeError('BIOMETRIC_DELETE_FAILED', 'Failed to delete biometric credential.', err);
    }
  },
};
