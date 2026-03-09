/**
 * RestoreConfirmDialog.tsx
 *
 * Dialog shown before restoring a Drive backup.
 * No password required — the active session key is used to decrypt.
 * The user must type “CONFIRM” as a deliberate acknowledgement.
 */

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useDriveRestore } from '@/app/stores/drive-backup.store';
import { useSessionStore } from '@/app/stores/session.store';
import type { DriveBackupFile } from '@/services/google/drive-backup.service';
import { MetaBadge } from './MetaBadge';

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

const LABELS = {
  TITLE: 'Restore from backup',
  WARNING:
    'Restoring will replace all your current local data with this backup. This cannot be undone.',
  CONFIRM_LABEL: 'Type CONFIRM to proceed',
  CONFIRM_PLACEHOLDER: 'CONFIRM',
  CANCEL: 'Cancel',
  CONFIRM_BTN: 'Restore backup',
  CONFIRMING: 'Restoring…',
  ERROR_DECRYPT: 'Failed to decrypt backup. It may belong to a different account.',
  ERROR_CORRUPT: 'This backup file appears to be corrupted.',
} as const;

const CONFIRM_WORD = 'CONFIRM';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RestoreConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  backup: DriveBackupFile;
  onSuccess: () => void; // called after successful restore
};

// ---------------------------------------------------------------------------
// Focusable helpers
// ---------------------------------------------------------------------------

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RestoreConfirmDialog({
  open,
  onClose,
  backup,
  onSuccess,
}: RestoreConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [inlineError, setInlineError] = useState<string | null>(null);

  const currentUser = useSessionStore((s) => s.currentUser);
  const { isRestoring, restoreBackup, clearRestoreError } = useDriveRestore();

  const isConfirmed = confirmText === CONFIRM_WORD;

  // Remember trigger
  useEffect(() => {
    if (open) { triggerRef.current = document.activeElement; }
  }, [open]);

  // Auto-focus + focus trap
  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const focusable = getFocusable(dialogRef.current);
    focusable[0]?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { handleClose(); return; }
      if (e.key !== 'Tab') return;
      const els = getFocusable(dialogRef.current!);
      if (els.length === 0) { e.preventDefault(); return; }
      if (e.shiftKey) {
        if (document.activeElement === els[0]) { e.preventDefault(); els[els.length - 1]?.focus(); }
      } else {
        if (document.activeElement === els[els.length - 1]) { e.preventDefault(); els[0]?.focus(); }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      (triggerRef.current as HTMLElement | null)?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleClose() {
    if (isRestoring) return;
    setConfirmText('');
    setInlineError(null);
    clearRestoreError();
    onClose();
  }

  async function handleConfirm() {
    if (!currentUser || !isConfirmed) return;
    setInlineError(null);

    const result = await restoreBackup(currentUser.id, backup.fileId);

    if (result.success) {
      onSuccess();
    } else if (result.error.code === 'DECRYPT_FAILED') {
      setInlineError(LABELS.ERROR_DECRYPT);
    } else if (result.error.code === 'CORRUPT_BACKUP') {
      setInlineError(LABELS.ERROR_CORRUPT);
    } else {
      setInlineError(result.error.message);
    }
  }

  if (!open) return null;

  const backupDate = (() => {
    try { return format(parseISO(backup.createdAt), 'MMMM d, yyyy · h:mm a'); } catch { return backup.label; }
  })();
  const backupSize = formatBytes(backup.size);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby="restore-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={dialogRef}
        className="relative w-full max-w-md bg-card rounded-2xl border border-border shadow-xl p-6 flex flex-col gap-5"
      >
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h2 id="restore-dialog-title" className="text-base font-semibold text-foreground">
            {LABELS.TITLE}
          </h2>
          <p className="text-xs text-muted-foreground">
            {backupDate} · {backupSize}
          </p>
        </div>

        {/* Backup metadata */}
        {backup.meta && <MetaBadge meta={backup.meta} />}

        {/* Warning */}
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30">
          <AlertTriangle
            className="w-4 h-4 text-amber-600 mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <p className="text-xs text-amber-700 dark:text-amber-400">{LABELS.WARNING}</p>
        </div>

        {/* CONFIRM text field */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="restore-confirm" className="text-sm font-medium text-foreground">
            {LABELS.CONFIRM_LABEL}
          </label>
          <input
            id="restore-confirm"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={confirmText}
            onChange={(e) => {
              setConfirmText(e.target.value);
              setInlineError(null);
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && isConfirmed) void handleConfirm(); }}
            disabled={isRestoring}
            placeholder={LABELS.CONFIRM_PLACEHOLDER}
            className={[
              'h-10 w-full rounded-lg border bg-background px-3 text-sm font-mono tracking-widest text-foreground',
              'placeholder:text-muted-foreground/40 placeholder:tracking-normal placeholder:font-sans',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'transition-colors duration-100',
              inlineError ? 'border-destructive' : 'border-input hover:border-ring',
              isRestoring ? 'opacity-50 cursor-not-allowed' : '',
            ].join(' ')}
          />
          {inlineError && (
            <p role="alert" className="text-xs text-destructive mt-1">
              {inlineError}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={handleClose}
            disabled={isRestoring}
            className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {LABELS.CANCEL}
          </button>
          <button
            type="button"
            onClick={() => { void handleConfirm(); }}
            disabled={isRestoring || !isConfirmed}
            className="h-9 px-4 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRestoring ? (
              <>
                <Loader2Icon />
                {LABELS.CONFIRMING}
              </>
            ) : (
              LABELS.CONFIRM_BTN
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal utility
// ---------------------------------------------------------------------------

function Loader2Icon() {
  return (
    <svg
      className="w-3.5 h-3.5 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toString()} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
