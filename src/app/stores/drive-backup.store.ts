/**
 * drive-backup.store.ts
 *
 * Zustand store managing Google Drive backup state and operations.
 * All async side-effects go through driveBackupService —
 * this store only manages UI state and delegates to the service layer.
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import * as oauthService from '@/services/google/oauth.service';
import * as driveBackupService from '@/services/google/drive-backup.service';
import * as driveService from '@/services/google/drive.service';
import * as tokenStorage from '@/services/storage/google-tokens.storage';
import { readSWState, writeSWState } from '@/services/storage/sw-state.storage';
import { useSessionStore } from '@/app/stores/session.store';
import { importEncryptedBackup } from '@/services/settings/settings.service';
import type { Result, UUID, ISODateString } from '@/shared/types/common.types';
import type { DriveBackupFile } from '@/services/google/drive-backup.service';
import { BACKUP_FILE_PREFIX } from '@/services/google/drive-backup.service';
import { formatRelative, format, parseISO } from 'date-fns';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRestoreLabel(createdAt: string): string {
  try {
    const date = parseISO(createdAt);
    const rel = formatRelative(date, new Date());
    return rel.charAt(0).toUpperCase() + rel.slice(1);
  } catch {
    try {
      return format(parseISO(createdAt), 'MMM d, yyyy');
    } catch {
      return createdAt;
    }
  }
}

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

type DriveBackupState = {
  isConnected: boolean;
  connectedEmail: string | null;
  connectedName: string | null;
  lastBackupAt: ISODateString | null;
  isBackingUp: boolean;
  backupError: string | null;
  backups: DriveBackupFile[];
  isLoadingBackups: boolean;
  isRestoring: boolean;
  restoreError: string | null;
  isDisconnecting: boolean;
  // Restore flow — ephemeral, in-memory only, never persisted
  restoreTokens: { accessToken: string; email: string; displayName: string } | null;
  restoreBackups: DriveBackupFile[];
  isLoadingRestoreBackups: boolean;
};

type DriveBackupActions = {
  initialize: (userId: UUID) => Promise<boolean>;
  connect: (returnPath: string) => Promise<void>;
  disconnect: (userId: UUID) => Promise<void>;
  runBackup: (userId: UUID) => Promise<void>;
  loadBackups: (userId: UUID) => Promise<void>;
  restoreBackup: (userId: UUID, fileId: string) => Promise<Result<void>>;
  deleteBackup: (userId: UUID, fileId: string) => Promise<Result<void>>;
  clearBackupError: () => void;
  clearRestoreError: () => void;
  // Restore flow actions
  setRestoreTokens: (tokens: { accessToken: string; email: string; displayName: string }) => void;
  clearRestoreSession: () => void;
  loadRestoreBackups: () => Promise<void>;
  restoreFromToken: (userId: UUID, fileId: string, password: string) => Promise<Result<void>>;
};

type DriveBackupStore = DriveBackupState & DriveBackupActions;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useDriveBackupStore = create<DriveBackupStore>((set, get) => ({
  isConnected: false,
  connectedEmail: null,
  connectedName: null,
  lastBackupAt: null,
  isBackingUp: false,
  backupError: null,
  backups: [],
  isLoadingBackups: false,
  isRestoring: false,
  restoreError: null,
  isDisconnecting: false,
  restoreTokens: null,
  restoreBackups: [],
  isLoadingRestoreBackups: false,

  /**
   * Loads tokens from IDB and populates connection state.
   * Returns true if connected, false if not.
   */
  initialize: async (userId: UUID): Promise<boolean> => {
    const { derivedKey } = useSessionStore.getState();
    if (!derivedKey) return false;

    const result = await tokenStorage.loadTokens(userId, derivedKey);
    if (!result.success || !result.data) {
      set({ isConnected: false, connectedEmail: null, connectedName: null });
      return false;
    }

    const tokens = result.data;
    const lastBackupAt = await readSWState<string>('lastBackupAt');

    set({
      isConnected: true,
      connectedEmail: tokens.email,
      connectedName: tokens.displayName,
      lastBackupAt: lastBackupAt as ISODateString | null,
    });

    return true;
  },

  /**
   * Stores returnPath in sessionStorage and initiates the PKCE OAuth flow.
   */
  connect: async (returnPath: string): Promise<void> => {
    sessionStorage.setItem('zentro_drive_return_path', returnPath);
    await oauthService.initiateOAuthFlow(returnPath);
  },

  /**
   * Revokes token, removes from IDB, clears all Drive state.
   */
  disconnect: async (userId: UUID): Promise<void> => {
    set({ isDisconnecting: true });
    try {
      const { derivedKey } = useSessionStore.getState();
      if (derivedKey) {
        const loadResult = await tokenStorage.loadTokens(userId, derivedKey);
        if (loadResult.success && loadResult.data) {
          await oauthService.revokeToken(loadResult.data.accessToken);
        }
      }
      await tokenStorage.deleteTokens(userId);
      await writeSWState('activeGoogleConnection', null);
      set({
        isConnected: false,
        connectedEmail: null,
        connectedName: null,
        lastBackupAt: null,
        isBackingUp: false,
        backupError: null,
        backups: [],
        isDisconnecting: false,
      });
    } catch {
      set({ isDisconnecting: false });
    }
  },

  /**
   * Runs a backup and updates lastBackupAt on success.
   */
  runBackup: async (userId: UUID): Promise<void> => {
    set({ isBackingUp: true, backupError: null });
    try {
      const result = await driveBackupService.runBackup(userId);
      if (result.success) {
        set({
          lastBackupAt: result.data.uploadedAt,
          isBackingUp: false,
          backupError: null,
        });
      } else {
        set({ isBackingUp: false, backupError: result.error.message });
      }
    } catch (err) {
      set({
        isBackingUp: false,
        backupError: err instanceof Error ? err.message : 'Backup failed.',
      });
    }
  },

  /**
   * Loads the list of backup files from Drive.
   */
  loadBackups: async (userId: UUID): Promise<void> => {
    set({ isLoadingBackups: true });
    const result = await driveBackupService.listBackups(userId);
    if (result.success) {
      set({ backups: result.data, isLoadingBackups: false });
    } else {
      set({ isLoadingBackups: false });
    }
  },

  /**
   * Restores a backup using the active session key. Returns Result for the caller to handle navigation.
   */
  restoreBackup: async (userId: UUID, fileId: string): Promise<Result<void>> => {
    const { derivedKey } = useSessionStore.getState();
    if (!derivedKey) {
      return {
        success: false,
        error: { code: 'NO_SESSION', message: 'No active session. Please log in again.' },
      };
    }
    set({ isRestoring: true, restoreError: null });
    const result = await driveBackupService.restoreFromBackup(userId, fileId, derivedKey);
    if (result.success) {
      set({ isRestoring: false });
    } else {
      set({ isRestoring: false, restoreError: result.error.message });
    }
    return result;
  },

  /**
   * Deletes a single backup file from Drive.
   */
  deleteBackup: async (userId: UUID, fileId: string): Promise<Result<void>> => {
    const result = await driveBackupService.deleteBackup(userId, fileId);
    if (result.success) {
      set((s) => ({ backups: s.backups.filter((b) => b.fileId !== fileId) }));
    }
    return result;
  },

  clearBackupError: () => {
    set({ backupError: null });
  },
  clearRestoreError: () => {
    set({ restoreError: null });
  },

  // ---------------------------------------------------------------------------
  // Restore flow — unauthenticated (no userId, no CryptoKey)
  // ---------------------------------------------------------------------------

  setRestoreTokens: (tokens) => {
    set({ restoreTokens: tokens });
  },

  clearRestoreSession: () => {
    set({ restoreTokens: null, restoreBackups: [], isLoadingRestoreBackups: false });
  },

  loadRestoreBackups: async () => {
    const { restoreTokens } = get();
    if (!restoreTokens) return;
    set({ isLoadingRestoreBackups: true });
    const result = await driveService.listFiles(restoreTokens.accessToken);
    if (result.success) {
      const backups: DriveBackupFile[] = result.data
        .filter((f) => f.name.startsWith(BACKUP_FILE_PREFIX))
        .sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime())
        .map((f) => ({
          fileId: f.id,
          fileName: f.name,
          size: f.size,
          createdAt: f.createdTime as ISODateString,
          label: buildRestoreLabel(f.createdTime),
        }));
      set({ restoreBackups: backups, isLoadingRestoreBackups: false });
    } else {
      set({ isLoadingRestoreBackups: false });
    }
  },

  restoreFromToken: async (
    userId: UUID,
    fileId: string,
    password: string
  ): Promise<Result<void>> => {
    const { restoreTokens } = get();
    if (!restoreTokens) {
      return {
        success: false,
        error: { code: 'NO_RESTORE_SESSION', message: 'No restore session active.' },
      };
    }
    set({ isRestoring: true, restoreError: null });
    const downloadResult = await driveService.downloadFile(fileId, restoreTokens.accessToken);
    if (!downloadResult.success) {
      set({ isRestoring: false, restoreError: downloadResult.error.message });
      return downloadResult;
    }
    const file = new File([downloadResult.data], 'backup.zentro', {
      type: 'application/zentro-backup',
    });
    const importResult = await importEncryptedBackup(userId, password, file);
    if (!importResult.success) {
      let errorCode = importResult.error.code;
      let errorMsg = importResult.error.message;
      if (errorCode === 'IMPORT_AUTH_FAILED' || errorCode === 'IMPORT_DECRYPT_FAILED') {
        errorCode = 'WRONG_PASSWORD';
        errorMsg = 'Incorrect password. Please try again.';
      } else if (errorCode === 'IMPORT_INVALID' || errorCode === 'IMPORT_PARSE_FAILED') {
        errorCode = 'CORRUPT_BACKUP';
        errorMsg = 'This backup file appears to be corrupted.';
      }
      set({ isRestoring: false, restoreError: errorMsg });
      return { success: false, error: { code: errorCode, message: errorMsg } };
    }
    set({ isRestoring: false });
    return { success: true, data: undefined };
  },
}));

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function useDriveBackup() {
  return useDriveBackupStore(
    useShallow((s) => ({
      isConnected: s.isConnected,
      connectedEmail: s.connectedEmail,
      connectedName: s.connectedName,
      lastBackupAt: s.lastBackupAt,
      isBackingUp: s.isBackingUp,
      backupError: s.backupError,
      isDisconnecting: s.isDisconnecting,
      connect: s.connect,
      disconnect: s.disconnect,
      runBackup: s.runBackup,
      initialize: s.initialize,
      clearBackupError: s.clearBackupError,
    }))
  );
}

export function useDriveBackupList() {
  return useDriveBackupStore(
    useShallow((s) => ({
      backups: s.backups,
      isLoadingBackups: s.isLoadingBackups,
      loadBackups: s.loadBackups,
      deleteBackup: s.deleteBackup,
    }))
  );
}

export function useDriveRestore() {
  return useDriveBackupStore(
    useShallow((s) => ({
      isRestoring: s.isRestoring,
      restoreError: s.restoreError,
      restoreBackup: s.restoreBackup,
      clearRestoreError: s.clearRestoreError,
    }))
  );
}

export function useDriveRestoreFlow() {
  return useDriveBackupStore(
    useShallow((s) => ({
      restoreTokens: s.restoreTokens,
      restoreBackups: s.restoreBackups,
      isLoadingRestoreBackups: s.isLoadingRestoreBackups,
      isRestoring: s.isRestoring,
      restoreError: s.restoreError,
      setRestoreTokens: s.setRestoreTokens,
      clearRestoreSession: s.clearRestoreSession,
      loadRestoreBackups: s.loadRestoreBackups,
      restoreFromToken: s.restoreFromToken,
      clearRestoreError: s.clearRestoreError,
    }))
  );
}
