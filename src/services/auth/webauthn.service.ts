/**
 * WebAuthn service — biometric enrollment and verification.
 *
 * Uses the native navigator.credentials API exclusively.
 * No third-party WebAuthn libraries.
 *
 * All methods return Promise<Result<T>>. Nothing throws.
 */

import type { Result, UUID, ISODateString } from '@/shared/types/common.types';
import type { BiometricCredential } from '@/shared/types/user.types';
import type { SerializedEncryptedPayload } from '@/services/crypto/crypto.types';
import { encryptData, decryptData } from '@/services/crypto/crypto.service';
import { getAppEncryptionKey } from '@/services/crypto/app-key';
import { biometricStorage } from '@/services/storage/biometric.storage';

// ---------------------------------------------------------------------------
// Base64url helpers (WebAuthn uses base64url, not standard base64)
// ---------------------------------------------------------------------------

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BiometricEnrollParams = {
  readonly userId: UUID;
  readonly userDisplayName: string;
  readonly emailHash: string;
  /** Encrypted copy of the extractable CryptoKey raw bytes, protected with the app key. */
  readonly encryptedKeyBlob: SerializedEncryptedPayload;
};

export type BiometricVerifyParams = {
  readonly credentialId: string;
};

// ---------------------------------------------------------------------------
// Feature detection
// ---------------------------------------------------------------------------

/**
 * Returns true only if both window.PublicKeyCredential and navigator.credentials
 * are available. Called before every WebAuthn operation — no crashes on unsupported
 * browsers.
 */
export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' && 'PublicKeyCredential' in window && 'credentials' in navigator
  );
}

/**
 * Checks whether a platform authenticator (Face ID, Touch ID, Windows Hello,
 * Android biometrics) is available.
 * Returns false on any error or if WebAuthn is unsupported — never throws.
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
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

// ---------------------------------------------------------------------------
// Enrollment
// ---------------------------------------------------------------------------

/**
 * Registers a new WebAuthn biometric credential.
 *
 * The `encryptedKeyBlob` must be created by calling `encryptKeyForBiometric`
 * with an EXTRACTABLE copy of the user's derived CryptoKey. The session key is
 * non-extractable; for enrollment, derive a separate extractable key from the
 * same password + salt (see `BiometricSettings` for the full enrollment flow).
 *
 * Returns a `BiometricCredential` ready for persistence.
 */
export async function enrollBiometric(
  params: BiometricEnrollParams
): Promise<Result<BiometricCredential>> {
  if (!isWebAuthnSupported()) {
    return makeError('WEBAUTHN_UNSUPPORTED', 'WebAuthn is not supported on this device.');
  }

  try {
    const { userId, userDisplayName, emailHash, encryptedKeyBlob } = params;

    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userIdBytes = new TextEncoder().encode(userId);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'Zentro',
          id: window.location.hostname,
        },
        user: {
          id: userIdBytes,
          name: emailHash,
          displayName: userDisplayName,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60_000,
        attestation: 'none',
      },
    });

    if (!credential || !(credential instanceof PublicKeyCredential)) {
      return makeError('WEBAUTHN_ENROLL_FAILED', 'Credential creation did not return a result.');
    }

    const credentialId = bufferToBase64url(credential.rawId);
    const now = new Date().toISOString() as ISODateString;

    const biometricCredential: BiometricCredential = {
      credentialId,
      userId,
      encryptedKeyBlob,
      enrolledAt: now,
    };

    return { success: true, data: biometricCredential };
  } catch (err) {
    return makeError('WEBAUTHN_ENROLL_FAILED', 'Biometric enrollment failed.', err);
  }
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * Verifies a WebAuthn biometric credential.
 *
 * Returns the stored `BiometricCredential` on success — the caller is expected
 * to then call `decryptKeyFromBiometric(credential.encryptedKeyBlob)` to recover
 * the CryptoKey and unlock the session.
 *
 * Error handling note:
 * - User cancellation results in a DOMException with name 'NotAllowedError'.
 *   Callers should check `error.code === 'WEBAUTHN_USER_CANCELLED'` and handle
 *   silently (no error toast, no error message shown to the user).
 * - All other failures use 'WEBAUTHN_VERIFY_FAILED'.
 */
export async function verifyBiometric(
  params: BiometricVerifyParams
): Promise<Result<BiometricCredential>> {
  if (!isWebAuthnSupported()) {
    return makeError('WEBAUTHN_UNSUPPORTED', 'WebAuthn is not supported on this device.');
  }

  try {
    const { credentialId } = params;
    const credentialIdBytes = base64urlToBuffer(credentialId);

    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        allowCredentials: [{ id: credentialIdBytes, type: 'public-key' }],
        userVerification: 'required',
        timeout: 60_000,
      },
    });

    if (!assertion || !(assertion instanceof PublicKeyCredential)) {
      return makeError('WEBAUTHN_VERIFY_FAILED', 'Biometric verification did not return a result.');
    }

    // Retrieve the full credential (which contains the encrypted key blob) from storage
    // We look up by userId via the credentialId we just verified
    const storedResult = await biometricStorage.getBiometricCredentialByCredentialId(credentialId);
    if (!storedResult.success) return storedResult;
    if (!storedResult.data) {
      return makeError(
        'WEBAUTHN_CREDENTIAL_NOT_FOUND',
        'Verified credential not found in storage.'
      );
    }

    return { success: true, data: storedResult.data };
  } catch (err) {
    // Distinguish user cancellation from genuine errors
    if (err instanceof DOMException && err.name === 'NotAllowedError') {
      return makeError('WEBAUTHN_USER_CANCELLED', 'Biometric prompt was dismissed.');
    }
    return makeError('WEBAUTHN_VERIFY_FAILED', 'Biometric verification failed.', err);
  }
}

// ---------------------------------------------------------------------------
// Key encryption for biometric storage
// ---------------------------------------------------------------------------

/**
 * Encrypts the raw bytes of an EXTRACTABLE CryptoKey using the app-level key.
 *
 * IMPORTANT: The session's derived CryptoKey is non-extractable and cannot be
 * passed here directly. For biometric enrollment, the caller must first derive
 * a separate EXTRACTABLE copy of the key from the user's password + salt
 * (e.g., using a dedicated extractable derivation function), encrypt it here,
 * then discard the extractable key. The non-extractable session key remains
 * unchanged.
 *
 * The encrypted blob is stored alongside the WebAuthn credential and is
 * decrypted after biometric verification to restore the session key.
 */
export async function encryptKeyForBiometric(
  extractableKey: CryptoKey
): Promise<Result<SerializedEncryptedPayload>> {
  try {
    // Export the raw key bytes — will throw if the key is non-extractable
    const rawKeyBuffer = await crypto.subtle.exportKey('raw', extractableKey);
    const appKey = await getAppEncryptionKey();
    // Wrap the raw bytes in an object to use our standard encryptData helper
    const result = await encryptData(appKey, { rawKey: Array.from(new Uint8Array(rawKeyBuffer)) });
    if (!result.success) return result;
    return { success: true, data: result.data };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'InvalidAccessError') {
      return makeError(
        'KEY_NOT_EXTRACTABLE',
        'The provided key is not extractable. Derive an extractable copy for biometric enrollment.'
      );
    }
    return makeError('BIOMETRIC_KEY_ENCRYPT_FAILED', 'Failed to encrypt key for biometric.', err);
  }
}

/**
 * Decrypts the biometric key blob and re-imports it as a non-extractable
 * AES-GCM CryptoKey ready for session use.
 */
export async function decryptKeyFromBiometric(
  blob: SerializedEncryptedPayload
): Promise<Result<CryptoKey>> {
  try {
    const appKey = await getAppEncryptionKey();
    const decrypted = await decryptData<{ rawKey: number[] }>(appKey, blob);
    if (!decrypted.success) return decrypted;

    const rawKeyBytes = new Uint8Array(decrypted.data.rawKey);
    const key = await crypto.subtle.importKey(
      'raw',
      rawKeyBytes,
      { name: 'AES-GCM' },
      false, // non-extractable for session use
      ['encrypt', 'decrypt']
    );
    return { success: true, data: key };
  } catch (err) {
    return makeError('BIOMETRIC_KEY_DECRYPT_FAILED', 'Failed to decrypt key from biometric.', err);
  }
}
