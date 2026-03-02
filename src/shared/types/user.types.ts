import type { UUID, ISODateString } from './common.types';
import type { SerializedEncryptedPayload } from '@/services/crypto/crypto.types';

/**
 * Stored biometric credential linking a WebAuthn credentialId to an encrypted
 * copy of the user's derived CryptoKey. Allows session unlock without re-entering
 * a password after biometric verification.
 */
export type BiometricCredential = {
  readonly credentialId: string;
  readonly userId: UUID;
  /** AES-GCM encrypted raw bytes of the user's derived CryptoKey (app-level key). */
  readonly encryptedKeyBlob: SerializedEncryptedPayload;
  readonly enrolledAt: ISODateString;
};

export type LocalUser = {
  readonly id: UUID;
  readonly displayName: string;
  readonly emailHash: string;
  readonly createdAt: ISODateString;
  readonly salt: string;
  readonly passwordHash: string;
  readonly webAuthnCredentialId?: string;
};

export type UserSession = {
  readonly userId: UUID;
  readonly displayName: string;
  readonly derivedKey: CryptoKey;
  readonly lockedAt?: ISODateString;
  readonly expiresAt: ISODateString;
};
