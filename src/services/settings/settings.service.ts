/**
 * settings.service.ts
 *
 * Handles data export (CSV, encrypted backup, plain JSON),
 * backup import/restore, and account deletion.
 *
 * This service operates entirely client-side using the WebCrypto API and
 * IndexedDB. No data ever leaves the device.
 */

import { encryptData, decryptData } from '@/services/crypto/crypto.service';
import type { SerializedEncryptedPayload } from '@/services/crypto/crypto.types';
import { userStorage } from '@/services/storage/user.storage';
import { settingsStorage } from '@/services/storage/settings.storage';
import { categoryStorage } from '@/services/storage/category.storage';
import { transactionStorage } from '@/services/storage/transaction.storage';
import { unlockWithPassword } from '@/services/auth/auth.service';
import type { Result, UUID } from '@/shared/types/common.types';
import type { Transaction } from '@/shared/types/transaction.types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function makeError(code: string, message: string, cause?: unknown): Result<never> {
  console.error(`[settingsService] ${code}:`, message, cause);
  return { success: false, error: { code, message } };
}

/**
 * Gather all storable data for a given user. Returns partial data gracefully
 * when storages are not yet implemented (returns empty arrays / null).
 */
async function gatherUserData(userId: UUID, derivedKey: CryptoKey) {
  const [settingsResult, categoriesResult, transactionsResult] = await Promise.all([
    settingsStorage.getSettingsByUser(userId, derivedKey),
    categoryStorage.listCategoriesByUser(userId, derivedKey),
    transactionStorage.listTransactionsByUser(
      userId,
      { userId, limit: 999999, sortBy: 'date', sortOrder: 'desc' },
      derivedKey
    ),
  ]);

  return {
    settings: settingsResult.success ? settingsResult.data : null,
    categories: categoriesResult.success ? categoriesResult.data : [],
    transactions: transactionsResult.success ? transactionsResult.data.transactions : [],
  };
}

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

const CSV_HEADERS = 'date,type,amount,currency,categoryId,accountId,notes\n' as const;

function transactionToCSVRow(tx: Transaction): string {
  const escape = (value: string | undefined): string => {
    if (value == null) return '';
    const str = value;
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  return [
    escape(tx.date),
    escape(tx.type),
    String(tx.amount),
    escape(tx.currency),
    escape(tx.categoryId),
    escape(tx.accountId),
    escape(tx.notes ?? ''),
  ].join(',');
}

export async function exportTransactionsCSV(
  userId: UUID,
  derivedKey: CryptoKey
): Promise<Result<Blob>> {
  try {
    const result = await transactionStorage.listTransactionsByUser(
      userId,
      { userId, limit: 999999, sortBy: 'date', sortOrder: 'desc' },
      derivedKey
    );

    if (!result.success) {
      if (result.error.code === 'NOT_IMPLEMENTED') {
        // Storage not yet implemented — return headers-only CSV
        return {
          success: true,
          data: new Blob([CSV_HEADERS], { type: 'text/csv;charset=utf-8;' }),
        };
      }
      return makeError('CSV_EXPORT_FAILED', result.error.message);
    }

    const rows = result.data.transactions.map(transactionToCSVRow).join('\n');
    const csv = CSV_HEADERS + rows;

    return {
      success: true,
      data: new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    };
  } catch (err) {
    return makeError('CSV_EXPORT_FAILED', 'Unexpected error during CSV export.', err);
  }
}

// ---------------------------------------------------------------------------
// Encrypted Backup Export (.zentro)
// ---------------------------------------------------------------------------

export async function exportEncryptedBackup(
  userId: UUID,
  derivedKey: CryptoKey
): Promise<Result<Blob>> {
  try {
    const data = await gatherUserData(userId, derivedKey);

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      userId,
      ...data,
    };

    // encryptData(key, plaintext) — key is first arg
    const encryptResult = await encryptData(derivedKey, payload);
    if (!encryptResult.success) {
      return makeError('BACKUP_EXPORT_FAILED', encryptResult.error.message);
    }

    // Wrap in a .zentro envelope so we can detect it on import
    const envelope = JSON.stringify({
      zentro: true,
      version: 1,
      payload: encryptResult.data, // { data: base64 }
    });

    return {
      success: true,
      data: new Blob([envelope], { type: 'application/zentro-backup' }),
    };
  } catch (err) {
    return makeError('BACKUP_EXPORT_FAILED', 'Unexpected error during backup export.', err);
  }
}

// ---------------------------------------------------------------------------
// Plain JSON Export
// ---------------------------------------------------------------------------

export async function exportPlainJSON(userId: UUID, derivedKey: CryptoKey): Promise<Result<Blob>> {
  try {
    const data = await gatherUserData(userId, derivedKey);

    const json = JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        userId,
        ...data,
      },
      null,
      2
    );

    return {
      success: true,
      data: new Blob([json], { type: 'application/json' }),
    };
  } catch (err) {
    return makeError('JSON_EXPORT_FAILED', 'Unexpected error during JSON export.', err);
  }
}

// ---------------------------------------------------------------------------
// Import / Restore
// ---------------------------------------------------------------------------

type BackupPayload = {
  version: number;
  exportedAt: string;
  userId: string;
  settings: unknown;
  categories: unknown[];
  transactions: unknown[];
};

function isBackupPayload(obj: unknown): obj is BackupPayload {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'version' in obj &&
    'userId' in obj &&
    'settings' in obj
  );
}

/**
 * Import a .zentro encrypted backup. Requires the user's password to decrypt.
 *
 * Note: this is a best-effort restore. Storages that are not yet implemented
 * will silently skip their data. Only settings is fully guaranteed to restore.
 */
export async function importEncryptedBackup(
  userId: UUID,
  password: string,
  file: File
): Promise<Result<void>> {
  try {
    const keyResult = await unlockWithPassword(userId, password);
    if (!keyResult.success) {
      return makeError('IMPORT_AUTH_FAILED', 'Incorrect password.');
    }
    const derivedKey = keyResult.data;

    const text = await file.text();

    let envelope: unknown;
    try {
      envelope = JSON.parse(text);
    } catch {
      return makeError('IMPORT_PARSE_FAILED', 'Backup file is corrupt or invalid.');
    }

    if (
      typeof envelope !== 'object' ||
      envelope === null ||
      !('zentro' in envelope) ||
      !('payload' in envelope)
    ) {
      return makeError('IMPORT_INVALID', 'File is not a valid Zentro backup.');
    }

    const encPayload = (envelope as { payload: SerializedEncryptedPayload }).payload;

    // decryptData<T>(key, payload) — key is first arg
    const decryptResult = await decryptData<BackupPayload>(derivedKey, encPayload);
    if (!decryptResult.success) {
      return makeError('IMPORT_DECRYPT_FAILED', 'Failed to decrypt backup. Wrong password?');
    }

    const payload = decryptResult.data;

    if (!isBackupPayload(payload)) {
      return makeError('IMPORT_INVALID', 'Backup file format is not recognised.');
    }

    if (payload.settings && typeof payload.settings === 'object') {
      const settings = payload.settings as Parameters<typeof settingsStorage.upsertSettings>[0];
      await settingsStorage.upsertSettings(settings, derivedKey);
    }

    return { success: true, data: undefined };
  } catch (err) {
    return makeError('IMPORT_FAILED', 'Unexpected error during import.', err);
  }
}

/**
 * Import a plain-JSON backup (no decryption required).
 */
export async function importPlainJSON(
  _userId: UUID,
  derivedKey: CryptoKey,
  file: File
): Promise<Result<void>> {
  try {
    const text = await file.text();

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      return makeError('IMPORT_PARSE_FAILED', 'File is not valid JSON.');
    }

    if (!isBackupPayload(payload)) {
      return makeError('IMPORT_INVALID', 'File format is not recognised.');
    }

    if (payload.settings && typeof payload.settings === 'object') {
      const settings = payload.settings as Parameters<typeof settingsStorage.upsertSettings>[0];
      await settingsStorage.upsertSettings(settings, derivedKey);
    }

    return { success: true, data: undefined };
  } catch (err) {
    return makeError('IMPORT_FAILED', 'Unexpected error during JSON import.', err);
  }
}

// ---------------------------------------------------------------------------
// Account Deletion
// ---------------------------------------------------------------------------

/**
 * Permanently deletes a user account and all associated data.
 * Requires password confirmation.
 */
export async function deleteAccount(userId: UUID, password: string): Promise<Result<void>> {
  try {
    const verifyResult = await unlockWithPassword(userId, password);
    if (!verifyResult.success) {
      return makeError('DELETE_AUTH_FAILED', 'Incorrect password. Account not deleted.');
    }

    const deleteResult = await userStorage.deleteUser(userId);
    if (!deleteResult.success) {
      return makeError('DELETE_USER_FAILED', deleteResult.error.message);
    }

    return { success: true, data: undefined };
  } catch (err) {
    return makeError('DELETE_ACCOUNT_FAILED', 'Unexpected error during account deletion.', err);
  }
}

// ---------------------------------------------------------------------------
// Browser Download Helper
// ---------------------------------------------------------------------------

export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Delay revoke to allow download to start
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10_000);
}
