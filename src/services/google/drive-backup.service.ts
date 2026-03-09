/**
 * drive-backup.service.ts
 *
 * Orchestrates backup creation, rotation, and restore.
 * All write/read operations go through the encrypted settingsService pipeline.
 * Drive is just a storage transport — it never sees unencrypted data.
 */

import * as driveService from '@/services/google/drive.service';
import * as oauthService from '@/services/google/oauth.service';
import {
  exportEncryptedBackup,
  importEncryptedBackupWithKey,
} from '@/services/settings/settings.service';
import type { BackupMeta } from '@/services/settings/settings.service';
import { readSWState, writeSWState } from '@/services/storage/sw-state.storage';
import { useSessionStore } from '@/app/stores/session.store';
import type { Result, UUID, ISODateString } from '@/shared/types/common.types';
import { format, parseISO, formatRelative } from 'date-fns';
import type { DriveFile } from '@/services/google/drive.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BACKUP_FILE_PREFIX = 'zentro-backup-';
export const MAX_BACKUPS_TO_KEEP = 7;
export const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

const SW_LAST_BACKUP_KEY = 'lastBackupAt';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DriveBackupResult = {
  fileId: string;
  fileName: string;
  size: number;
  uploadedAt: ISODateString;
};

export type DriveBackupFile = {
  fileId: string;
  fileName: string;
  size: number;
  createdAt: ISODateString;
  label: string;
  meta?: BackupMeta;
};

export type { BackupMeta };

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

function todayFilename(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${BACKUP_FILE_PREFIX}${y.toString()}-${m}-${day}.zentro`;
}

function buildBackupLabel(createdAt: string): string {
  try {
    const date = parseISO(createdAt);
    const now = new Date();
    // date-fns formatRelative gives "today at X", "yesterday at X", etc.
    const rel = formatRelative(date, now);
    // Capitalize first letter
    return rel.charAt(0).toUpperCase() + rel.slice(1);
  } catch {
    return format(parseISO(createdAt), 'MMM d, yyyy');
  }
}

/**
 * Calls a Drive API function. On 401, refreshes the token and retries once.
 */
async function withRetry<T>(
  userId: UUID,
  fn: (accessToken: string) => Promise<Result<T>>
): Promise<Result<T>> {
  const tokenResult = await oauthService.getValidAccessToken(userId);
  if (!tokenResult.success) return tokenResult;

  const first = await fn(tokenResult.data);
  if (first.success) return first;

  if (first.error.code === 'GOOGLE_TOKEN_EXPIRED') {
    // Force refresh and retry once
    const retryToken = await oauthService.getValidAccessToken(userId);
    if (!retryToken.success) return retryToken;
    return fn(retryToken.data);
  }

  return first;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a new encrypted backup and uploads it to Google Drive appDataFolder.
 * Prunes old backups leaving at most MAX_BACKUPS_TO_KEEP.
 */
export async function runBackup(userId: UUID): Promise<Result<DriveBackupResult>> {
  const { derivedKey } = useSessionStore.getState();
  if (!derivedKey) {
    return makeError('NO_SESSION', 'No active session.');
  }

  // 1. Get valid access token
  const tokenResult = await oauthService.getValidAccessToken(userId);
  if (!tokenResult.success) return tokenResult;
  const accessToken = tokenResult.data;

  // 2. Produce the encrypted .zentro Blob
  const exportResult = await exportEncryptedBackup(userId, derivedKey);
  if (!exportResult.success) {
    return makeError('BACKUP_EXPORT_FAILED', exportResult.error.message);
  }

  const { blob, meta } = exportResult.data;
  const fileName = todayFilename();

  // 3. Upload to Drive — embed meta as appProperties for display without decrypting
  const appProperties: Record<string, string> = {
    accounts: String(meta.accounts),
    transactions: String(meta.transactions),
    categories: String(meta.categories),
    budgets: String(meta.budgets),
    goals: String(meta.goals),
    bills: String(meta.bills),
  };

  const uploadResult = await driveService.uploadFile({
    name: fileName,
    content: blob,
    mimeType: 'application/octet-stream',
    accessToken,
    appProperties,
  });

  if (!uploadResult.success) {
    return makeError('DRIVE_UPLOAD_FAILED', uploadResult.error.message);
  }

  // 4. Update lastBackupAt in sw_state
  const now = new Date().toISOString();
  await writeSWState(SW_LAST_BACKUP_KEY, now);

  // 5. Prune old backups (best-effort)
  pruneOldBackups(accessToken).catch(() => undefined);

  return {
    success: true,
    data: {
      fileId: uploadResult.data.id,
      fileName: uploadResult.data.name,
      size: uploadResult.data.size,
      uploadedAt: now as ISODateString,
    },
  };
}

/**
 * Deletes all but the newest MAX_BACKUPS_TO_KEEP backup files from Drive.
 * Failures are silently swallowed.
 */
export async function pruneOldBackups(accessToken: string): Promise<void> {
  try {
    const listResult = await driveService.listFiles(accessToken);
    if (!listResult.success) return;

    const backups = listResult.data
      .filter((f) => f.name.startsWith(BACKUP_FILE_PREFIX))
      .sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());

    const toDelete = backups.slice(MAX_BACKUPS_TO_KEEP);
    await Promise.all(toDelete.map((f) => driveService.deleteFile(f.id, accessToken)));
  } catch {
    // Best-effort
  }
}

function parseAppPropertiesMeta(file: DriveFile): BackupMeta | undefined {
  const p = file.appProperties;
  if (!p) return undefined;
  const n = (k: string) => {
    const v = parseInt(p[k] ?? '', 10);
    return isNaN(v) ? 0 : v;
  };
  return {
    accounts: n('accounts'),
    transactions: n('transactions'),
    categories: n('categories'),
    budgets: n('budgets'),
    goals: n('goals'),
    bills: n('bills'),
  };
}

/**
 * Lists all backup files in appDataFolder with human-readable labels.
 */
export async function listBackups(userId: UUID): Promise<Result<DriveBackupFile[]>> {
  const result = await withRetry(userId, (token) => driveService.listFiles(token));
  if (!result.success) return result;

  const files: DriveFile[] = result.data
    .filter((f) => f.name.startsWith(BACKUP_FILE_PREFIX))
    .sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());

  const backups: DriveBackupFile[] = files.map((f) => ({
    fileId: f.id,
    fileName: f.name,
    size: f.size,
    createdAt: f.createdTime as ISODateString,
    label: buildBackupLabel(f.createdTime),
    meta: parseAppPropertiesMeta(f),
  }));

  return { success: true, data: backups };
}

/**
 * Downloads a specific backup file from Drive as a raw Blob.
 */
export async function downloadBackup(userId: UUID, fileId: string): Promise<Result<Blob>> {
  return withRetry(userId, (token) => driveService.downloadFile(fileId, token));
}

/**
 * Deletes a specific backup file from Drive.
 */
export async function deleteBackup(userId: UUID, fileId: string): Promise<Result<void>> {
  return withRetry(userId, (token) => driveService.deleteFile(fileId, token));
}

/**
 * Returns true if a backup should run: never backed up, or last backup > 24h ago.
 */
export async function shouldRunBackup(_userId: UUID): Promise<boolean> {
  try {
    const lastBackupAt = await readSWState<string>(SW_LAST_BACKUP_KEY);
    if (!lastBackupAt) return true;
    return Date.now() - new Date(lastBackupAt).getTime() > BACKUP_INTERVAL_MS;
  } catch {
    return true;
  }
}

/**
 * Downloads a backup from Drive and restores it using the user's session key.
 * The user must be authenticated — no password re-entry required.
 * On success, the caller must log the user out and navigate to /login.
 */
export async function restoreFromBackup(
  userId: UUID,
  fileId: string,
  derivedKey: CryptoKey
): Promise<Result<void>> {
  // 1. Download
  const downloadResult = await downloadBackup(userId, fileId);
  if (!downloadResult.success) return downloadResult;

  // 2. Wrap Blob as File for import
  const file = new File([downloadResult.data], 'backup.zentro', {
    type: 'application/zentro-backup',
  });

  // 3. Restore via settings service (no password needed — key from active session)
  const importResult = await importEncryptedBackupWithKey(userId, derivedKey, file);
  if (!importResult.success) {
    if (importResult.error.code === 'IMPORT_DECRYPT_FAILED') {
      return {
        success: false,
        error: {
          code: 'DECRYPT_FAILED',
          message: 'Failed to decrypt backup. It may belong to a different account.',
        },
      };
    }
    if (
      importResult.error.code === 'IMPORT_INVALID' ||
      importResult.error.code === 'IMPORT_PARSE_FAILED'
    ) {
      return {
        success: false,
        error: { code: 'CORRUPT_BACKUP', message: 'This backup file appears to be corrupted.' },
      };
    }
    return importResult;
  }

  return { success: true, data: undefined };
}
