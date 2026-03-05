import type { Result } from '@/shared/types/common.types';
import type { SerializedEncryptedPayload } from './crypto.types';
import {
  PBKDF2_ITERATIONS,
  AES_KEY_LENGTH,
  SALT_BYTE_LENGTH,
  IV_BYTE_LENGTH,
  ALGORITHM_AES_GCM,
  ALGORITHM_PBKDF2,
  ALGORITHM_SHA256,
} from './crypto.constants';
import { bufferToBase64, base64ToBuffer } from './crypto.utils';

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

export async function deriveCryptoKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>
): Promise<Result<CryptoKey>> {
  try {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      ALGORITHM_PBKDF2,
      false,
      ['deriveKey']
    );
    const key = await crypto.subtle.deriveKey(
      {
        name: ALGORITHM_PBKDF2,
        salt,
        iterations: PBKDF2_ITERATIONS,
        hash: ALGORITHM_SHA256,
      },
      keyMaterial,
      { name: ALGORITHM_AES_GCM, length: AES_KEY_LENGTH },
      true, // extractable — needed for sessionStorage refresh-persist
      ['encrypt', 'decrypt']
    );
    return { success: true, data: key };
  } catch (err) {
    return makeError('CRYPTO_KEY_DERIVATION_FAILED', 'Failed to derive crypto key.', err);
  }
}

export function generateSalt(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTE_LENGTH));
}

export function generateIV(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH));
}

export async function encryptData(
  key: CryptoKey,
  plaintext: unknown
): Promise<Result<SerializedEncryptedPayload>> {
  try {
    const encoder = new TextEncoder();
    const iv: Uint8Array<ArrayBuffer> = generateIV();
    const encoded = encoder.encode(JSON.stringify(plaintext));
    const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM_AES_GCM, iv }, key, encoded);
    // Combine: iv (12 bytes) + ciphertext
    const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.byteLength);
    return { success: true, data: { data: bufferToBase64(combined.buffer) } };
  } catch (err) {
    return makeError('CRYPTO_ENCRYPT_FAILED', 'Failed to encrypt data.', err);
  }
}

export async function decryptData<T>(
  key: CryptoKey,
  payload: SerializedEncryptedPayload
): Promise<Result<T>> {
  try {
    const combined = new Uint8Array(base64ToBuffer(payload.data));
    const iv = combined.slice(0, IV_BYTE_LENGTH);
    const ciphertext = combined.slice(IV_BYTE_LENGTH);
    const plaintext = await crypto.subtle.decrypt({ name: ALGORITHM_AES_GCM, iv }, key, ciphertext);
    const decoder = new TextDecoder();
    const parsed = JSON.parse(decoder.decode(plaintext)) as T;
    return { success: true, data: parsed };
  } catch (err) {
    return makeError('CRYPTO_DECRYPT_FAILED', 'Failed to decrypt data.', err);
  }
}

export async function hashPassword(
  password: string,
  salt: Uint8Array<ArrayBuffer>
): Promise<Result<string>> {
  try {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      ALGORITHM_PBKDF2,
      false,
      ['deriveBits']
    );
    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: ALGORITHM_PBKDF2,
        salt,
        iterations: PBKDF2_ITERATIONS,
        hash: ALGORITHM_SHA256,
      },
      keyMaterial,
      256
    );
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return { success: true, data: hex };
  } catch (err) {
    return makeError('CRYPTO_HASH_FAILED', 'Failed to hash password.', err);
  }
}

export async function verifyPassword(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  storedHash: string
): Promise<Result<boolean>> {
  const result = await hashPassword(password, salt);
  if (!result.success) return result;
  return { success: true, data: result.data === storedHash };
}
