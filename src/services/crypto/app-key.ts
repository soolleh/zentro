/**
 * App-level AES-GCM encryption key singleton.
 *
 * This key is derived from compile-time constants (NOT security secrets).
 * It protects user records and biometric credentials at rest against trivial
 * IndexedDB inspection. The primary security layer remains the user's
 * PBKDF2-derived key.
 *
 * Exported as a single lazy getter shared across all storage services that
 * need to encrypt/decrypt app-level records.
 */

import { deriveCryptoKey } from '@/services/crypto/crypto.service';
import { base64ToBuffer } from '@/services/crypto/crypto.utils';
import {
  APP_ENCRYPTION_PASSPHRASE,
  APP_ENCRYPTION_SALT_BASE64,
} from '@/services/storage/storage.constants';

let appKeyPromise: Promise<CryptoKey> | null = null;

export function getAppEncryptionKey(): Promise<CryptoKey> {
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
