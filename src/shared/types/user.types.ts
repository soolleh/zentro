import type { UUID, ISODateString } from './common.types';

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
