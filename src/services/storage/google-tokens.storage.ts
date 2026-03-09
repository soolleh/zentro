/**
 * google-tokens.storage.ts
 *
 * Stores and retrieves Google OAuth2 tokens in the `google_tokens` IDB store.
 * Tokens are encrypted with the user's session CryptoKey before storage —
 * the same encryption pipeline used for all other sensitive data.
 *
 * The `checkDriveTokensExist` function is the only operation that does NOT
 * require a CryptoKey — it checks for record existence without decrypting.
 * This is intentional: it is called on the login page before any session exists.
 */

import { getDB } from '@/services/storage/storage.db';
import { encryptData, decryptData } from '@/services/crypto/crypto.service';
import type { Result, UUID } from '@/shared/types/common.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GoogleTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp ms
  scope: string;
  tokenType: string;
  email: string;
  displayName: string;
};

// ---------------------------------------------------------------------------
// Storage operations
// ---------------------------------------------------------------------------

/**
 * Encrypts and writes Google tokens to IDB for the given user.
 */
export async function saveTokens(
  userId: UUID,
  tokens: GoogleTokens,
  cryptoKey: CryptoKey
): Promise<Result<void>> {
  try {
    const encrypted = await encryptData(cryptoKey, tokens);
    if (!encrypted.success) {
      return { success: false, error: encrypted.error };
    }
    const db = await getDB();
    await db.put('google_tokens', { userId, data: encrypted.data.data });
    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'GOOGLE_TOKENS_SAVE_FAILED',
        message: 'Failed to save Google tokens.',
        context: err instanceof Error ? { cause: err.message } : undefined,
      },
    };
  }
}

/**
 * Reads and decrypts Google tokens for the given user.
 * Returns null when no stored tokens exist.
 */
export async function loadTokens(
  userId: UUID,
  cryptoKey: CryptoKey
): Promise<Result<GoogleTokens | null>> {
  try {
    const db = await getDB();
    const record = await db.get('google_tokens', userId);
    if (!record) return { success: true, data: null };

    const decrypted = await decryptData<GoogleTokens>(cryptoKey, { data: record.data });
    if (!decrypted.success) {
      return { success: false, error: decrypted.error };
    }
    return { success: true, data: decrypted.data };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'GOOGLE_TOKENS_LOAD_FAILED',
        message: 'Failed to load Google tokens.',
        context: err instanceof Error ? { cause: err.message } : undefined,
      },
    };
  }
}

/**
 * Deletes stored tokens for the given user.
 */
export async function deleteTokens(userId: UUID): Promise<Result<void>> {
  try {
    const db = await getDB();
    await db.delete('google_tokens', userId);
    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'GOOGLE_TOKENS_DELETE_FAILED',
        message: 'Failed to delete Google tokens.',
        context: err instanceof Error ? { cause: err.message } : undefined,
      },
    };
  }
}

/**
 * Checks whether a google_tokens record exists for ANY user.
 * Does NOT decrypt — used on the login page before a session exists.
 */
export async function checkDriveTokensExist(): Promise<boolean> {
  try {
    const db = await getDB();
    const keys = await db.getAllKeys('google_tokens');
    return keys.length > 0;
  } catch {
    return false;
  }
}
