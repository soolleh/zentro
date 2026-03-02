export const DB_NAME = 'zentro-db';
export const DB_VERSION = 1;

/**
 * Application-level encryption for user records (passwordHash, webAuthnCredentialId).
 * These are compile-time constants — NOT security secrets.
 * They protect against trivial IndexedDB inspection but are inherently reviewable
 * in the source. The primary security layer is the user's PBKDF2-derived key.
 */
export const APP_ENCRYPTION_PASSPHRASE = 'zentro-app-v1-user-record-protection-passphrase-2026';
export const APP_ENCRYPTION_SALT_BASE64 = 'emVudHJvLWFwcC12MS11c2VyLXNhbHQtMjAyNg==';
