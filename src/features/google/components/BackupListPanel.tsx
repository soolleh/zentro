/**
 * BackupListPanel.tsx
 *
 * SlidePanel listing backup files stored on Google Drive.
 * Each row shows a backup with its label, size, and time.
 * Clicking "Restore" opens RestoreConfirmDialog.
 */

import { useEffect, useState } from 'react';
import { Loader2, FileArchive, CloudOff, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { SlidePanel } from '@/shared/components/SlidePanel';
import { RestoreConfirmDialog } from './RestoreConfirmDialog';
import { MetaBadge } from './MetaBadge';
import { useDriveBackupList } from '@/app/stores/drive-backup.store';
import { useSessionStore } from '@/app/stores/session.store';
import { useUIStore } from '@/app/ui.store';
import type { DriveBackupFile } from '@/services/google/drive-backup.service';
import { ROUTES } from '@/app/routes.constants';
import { useNavigate } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toString()} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BackupListPanelProps = {
  open: boolean;
  onClose: () => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BackupListPanel({ open, onClose }: BackupListPanelProps) {
  const navigate = useNavigate();
  const currentUser = useSessionStore((s) => s.currentUser);
  const logout = useSessionStore((s) => s.logout);
  const addToast = useUIStore((s) => s.addToast);
  const { backups, isLoadingBackups, loadBackups, deleteBackup } = useDriveBackupList();

  const [selectedBackup, setSelectedBackup] = useState<DriveBackupFile | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load backups when panel opens
  useEffect(() => {
    if (open && currentUser) {
      void loadBackups(currentUser.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentUser?.id]);

  function handleRestoreClick(backup: DriveBackupFile) {
    setSelectedBackup(backup);
    setRestoreDialogOpen(true);
  }

  function handleRestoreSuccess() {
    setRestoreDialogOpen(false);
    onClose();
    addToast({ type: 'success', message: 'Data restored successfully. Please log in again.' });
    logout();
    void navigate(ROUTES.LOGIN);
  }

  async function handleDelete(backup: DriveBackupFile) {
    if (!currentUser) return;
    setDeletingId(backup.fileId);
    const result = await deleteBackup(currentUser.id, backup.fileId);
    setDeletingId(null);
    if (!result.success) {
      addToast({ type: 'error', message: 'Failed to delete backup. Please try again.' });
    }
  }

  return (
    <>
      <SlidePanel open={open} onClose={onClose} title="Drive Backups" size="sm">
        <div className="flex flex-col gap-0 divide-y divide-border">
          {/* Loading state */}
          {isLoadingBackups && (
            <div className="flex items-center justify-center py-12 gap-2">
              <Loader2
                className="w-5 h-5 animate-spin text-muted-foreground"
                aria-hidden="true"
              />
              <span className="text-sm text-muted-foreground">Loading backups…</span>
            </div>
          )}

          {/* Backup rows */}
          {!isLoadingBackups && backups.length > 0 &&
            backups.map((backup) => (
              <BackupRow
                key={backup.fileId}
                backup={backup}
                isDeleting={deletingId === backup.fileId}
                onRestore={() => { handleRestoreClick(backup); }}
                onDelete={() => { void handleDelete(backup); }}
              />
            ))}

          {/* Empty state */}
          {!isLoadingBackups && backups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <CloudOff
                className="w-8 h-8 text-muted-foreground/30"
                aria-hidden="true"
              />
              <span className="text-sm text-muted-foreground">
                No backups found on Google Drive.
              </span>
            </div>
          )}
        </div>
      </SlidePanel>

      {/* Restore dialog */}
      {selectedBackup && (
        <RestoreConfirmDialog
          open={restoreDialogOpen}
          onClose={() => { setRestoreDialogOpen(false); }}
          backup={selectedBackup}
          onSuccess={handleRestoreSuccess}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// BackupRow
// ---------------------------------------------------------------------------

type BackupRowProps = {
  backup: DriveBackupFile;
  isDeleting: boolean;
  onRestore: () => void;
  onDelete: () => void;
};

function BackupRow({ backup, isDeleting, onRestore, onDelete }: BackupRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const time = (() => {
    try { return format(parseISO(backup.createdAt), 'h:mm a'); } catch { return ''; }
  })();

  function handleTrashClick() {
    setConfirmDelete(true);
  }

  function handleDeleteCancel() {
    setConfirmDelete(false);
  }

  function handleDeleteConfirm() {
    setConfirmDelete(false);
    onDelete();
  }

  return (
    <div className="flex flex-col gap-2 px-6 py-4 hover:bg-muted/20 transition-colors duration-100">
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <FileArchive className="w-4 h-4 text-primary" aria-hidden="true" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{backup.label}</p>
          <p className="text-xs text-muted-foreground">
            {formatBytes(backup.size)}{time ? ` · ${time}` : ''}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {confirmDelete ? (
            <>
              <button
                type="button"
                onClick={handleDeleteCancel}
                className="h-7 px-2.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="h-7 px-2.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium hover:opacity-90 transition-opacity"
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onRestore}
                className="h-7 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:border-primary hover:text-primary transition-all duration-150"
              >
                Restore
              </button>
              <button
                type="button"
                onClick={handleTrashClick}
                disabled={isDeleting}
                aria-label="Delete backup"
                className="h-7 w-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-destructive hover:text-destructive transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Metadata badges */}
      {backup.meta && <MetaBadge meta={backup.meta} className="ml-12" />}
    </div>
  );
}
