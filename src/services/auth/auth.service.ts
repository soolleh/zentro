import type { Result, ISODateString } from '@/shared/types/common.types';
import type { LocalUser } from '@/shared/types/user.types';
import {
  generateSalt,
  hashPassword,
  verifyPassword,
  deriveCryptoKey,
} from '@/services/crypto/crypto.service';
import { bufferToBase64, base64ToBuffer, generateUUID } from '@/services/crypto/crypto.utils';
import { userStorage } from '@/services/storage/user.storage';
import { settingsStorage } from '@/services/storage/settings.storage';
import { categoryStorage } from '@/services/storage/category.storage';
import { ALL_SYSTEM_CATEGORIES } from '@/shared/constants/categories.constants';
import { buildDefaultSettings } from './auth.constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RegisterParams = {
  readonly displayName: string;
  readonly email: string;
  readonly password: string;
};

export type LoginParams = {
  readonly email: string;
  readonly password: string;
};

export type AuthResult = {
  readonly user: LocalUser;
  readonly derivedKey: CryptoKey;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/**
 * Hashes an email address to a consistent, non-reversible string for lookup.
 * Email is normalised (trimmed + lowercased) before hashing.
 */
export async function hashEmail(email: string): Promise<Result<string>> {
  try {
    const normalised = email.trim().toLowerCase();
    const encoded = new TextEncoder().encode(normalised);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return { success: true, data: hex };
  } catch (err) {
    return makeError('EMAIL_HASH_FAILED', 'Failed to hash email address.', err);
  }
}

// ---------------------------------------------------------------------------
// registerUser
// ---------------------------------------------------------------------------

/**
 * Creates a new local user account.
 * Steps:
 *  1. Hash email → check for duplicates
 *  2. Generate salt + hash password
 *  3. Derive CryptoKey from password + salt
 *  4. Persist user record (encrypted with app-level key)
 *  5. Persist default settings (encrypted with derived key)
 *  6. Seed all system categories for this user (encrypted with derived key)
 *  7. Return { user, derivedKey }
 */
export async function registerUser(params: RegisterParams): Promise<Result<AuthResult>> {
  const { displayName, email, password } = params;

  // 1. Hash email and check uniqueness
  const emailHashResult = await hashEmail(email);
  if (!emailHashResult.success) return emailHashResult;
  const emailHash = emailHashResult.data;

  const existingResult = await userStorage.getUserByEmailHash(emailHash);
  if (existingResult.success) {
    return makeError('EMAIL_ALREADY_EXISTS', 'An account with this email already exists.');
  }
  // Only proceed if the error was USER_NOT_FOUND
  if (existingResult.error.code !== 'USER_NOT_FOUND') {
    return existingResult;
  }

  // 2. Generate salt + hash password
  const salt = generateSalt();
  const saltBase64 = bufferToBase64(salt.buffer);

  const hashResult = await hashPassword(password, salt);
  if (!hashResult.success) return hashResult;

  // 3. Derive CryptoKey
  const keyResult = await deriveCryptoKey(password, salt);
  if (!keyResult.success) return keyResult;
  const derivedKey = keyResult.data;

  // 4. Build and persist user record
  const now = new Date().toISOString() as ISODateString; // ISODateString is a branded type requiring cast
  const userId = generateUUID();
  const user: LocalUser = {
    id: userId,
    displayName: displayName.trim(),
    emailHash,
    createdAt: now,
    salt: saltBase64,
    passwordHash: hashResult.data,
  };

  const createResult = await userStorage.createUser(user);
  if (!createResult.success) return createResult;

  // 5. Persist default settings
  const defaultSettings = buildDefaultSettings(userId, now);
  const settingsResult = await settingsStorage.upsertSettings(defaultSettings, derivedKey);
  if (!settingsResult.success) return settingsResult;

  // 6. Seed system categories — replace sentinel userId with real userId
  for (const systemCat of ALL_SYSTEM_CATEGORIES) {
    const cat = { ...systemCat, userId };
    const catResult = await categoryStorage.createCategory(cat, derivedKey);
    if (!catResult.success) return catResult;
  }

  return { success: true, data: { user, derivedKey } };
}

// ---------------------------------------------------------------------------
// loginUser
// ---------------------------------------------------------------------------

/**
 * Authenticates an existing local user.
 * Returns { user, derivedKey } on success.
 */
export async function loginUser(params: LoginParams): Promise<Result<AuthResult>> {
  const { email, password } = params;

  // 1. Hash email to find user
  const emailHashResult = await hashEmail(email);
  if (!emailHashResult.success) return emailHashResult;

  const userResult = await userStorage.getUserByEmailHash(emailHashResult.data);
  if (!userResult.success) {
    // Return a generic error to avoid email enumeration
    return makeError('INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }
  const user = userResult.data;

  // 2. Reconstruct salt from base64 and verify password
  const saltBuffer = base64ToBuffer(user.salt);
  const salt = new Uint8Array(saltBuffer);

  const verifyResult = await verifyPassword(password, salt, user.passwordHash);
  if (!verifyResult.success) return verifyResult;
  if (!verifyResult.data) {
    return makeError('INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  // 3. Derive CryptoKey
  const keyResult = await deriveCryptoKey(password, salt);
  if (!keyResult.success) return keyResult;

  return { success: true, data: { user, derivedKey: keyResult.data } };
}

// ---------------------------------------------------------------------------
// logoutUser
// ---------------------------------------------------------------------------

/**
 * No storage operations needed — the session store handles in-memory cleanup.
 */
export function logoutUser(): Result<void> {
  return { success: true, data: undefined };
}
