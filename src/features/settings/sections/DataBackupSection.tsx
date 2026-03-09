/**
 * DataBackupSection
 *
 * Export (CSV, encrypted backup, plain JSON) and import (restore from backup).
 * Also includes Google Drive cloud backup management card.
 */

import { useRef, useState, useEffect } from 'react';
import {
  HardDrive,
  Download,
  Upload,
  FileText,
  Loader2,
  Shield,
  RefreshCw,
  Lock,
  Info,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { SettingsSection } from '../components/SettingsSection';
import { SettingsCard } from '../components/SettingsCard';
import { SettingsRow } from '../components/SettingsRow';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { PasswordForImportDialog } from '../components/PasswordForImportDialog';
import { GoogleDriveIcon } from '@/features/google/components/GoogleDriveIcon';
import { BackupListPanel } from '@/features/google/components/BackupListPanel';
import { useDriveBackup } from '@/app/stores/drive-backup.store';
import { isGoogleDriveConfigured } from '@/config/env';
import {
  exportTransactionsCSV,
  exportEncryptedBackup,
  exportPlainJSON,
  importEncryptedBackup,
  importPlainJSON,
  triggerBrowserDownload,
} from '@/services/settings/settings.service';
import { useSessionStore } from '@/app/stores/session.store';
import { useUIStore } from '@/app/ui.store';


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y.toString()}-${m}-${day}`;
}

function formatLastBackup(lastBackupAt: string | null): string {
  if (!lastBackupAt) return 'Never backed up';
  try {
    return `Today at ${format(parseISO(lastBackupAt), 'h:mm a')}`;
  } catch {
    return lastBackupAt;
  }
}

type ExportButtonProps = {
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  isPending: boolean;
};

function ExportButton({ label, description, icon, onClick, isPending }: ExportButtonProps) {
  return (
    <SettingsRow
      label={label}
      description={description}
      control={
        <button
          onClick={onClick}
          disabled={isPending}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : (
            <span aria-hidden="true">{icon}</span>
          )}
          {isPending ? 'Exporting…' : 'Export'}
        </button>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Google Drive Card
// ---------------------------------------------------------------------------

function GoogleDriveCard() {
  const currentUser = useSessionStore((s) => s.currentUser);
  const {
    isConnected,
    connectedEmail,
    connectedName,
    lastBackupAt,
    isBackingUp,
    backupError,
    isDisconnecting,
    connect,
    disconnect,
    runBackup,
    initialize,
  } = useDriveBackup();

  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [showBackupList, setShowBackupList] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const hasInit = useRef(false);

  useEffect(() => {
    if (!currentUser || hasInit.current) return;
    hasInit.current = true;
    void initialize(currentUser.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  async function handleConnect() {
    setConnectError(null);
    try {
      await connect('/settings#backup');
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Failed to start Google sign-in.');
    }
  }

  function handleDisconnect() {
    if (!currentUser) return;
    void disconnect(currentUser.id).then(() => {
      setShowDisconnectDialog(false);
    });
  }

  function handleBackupNow() {
    if (!currentUser) return;
    void runBackup(currentUser.id);
  }

  return (
    <>
      <SettingsCard>
        <div className="p-4 flex flex-col gap-4">
          {/* Header row */}
          <div className="flex items-center gap-3">
            <GoogleDriveIcon size={32} />
            <div className="flex flex-col gap-0">
              <span className="text-sm font-semibold text-foreground">Google Drive Backup</span>
              <span className="text-xs text-muted-foreground">
                Automatically back up your data daily.
              </span>
            </div>
          </div>

          {!isConnected ? (
            <>
              {/* Feature list */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
                  End-to-end encrypted before upload
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <RefreshCw className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
                  Daily automatic backups, last 7 kept
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Lock className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
                  Only Zentro can access its own folder
                </div>
              </div>

              {/* Privacy note */}
              <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/40 border border-border">
                <Info
                  className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <p className="text-xs text-muted-foreground">
                  Zentro uses the most restrictive Google Drive permission available. It can only
                  read and write to its own private folder — it cannot access any of your other
                  Drive files.
                </p>
              </div>

              {/* Connect button */}
              {isGoogleDriveConfigured ? (
                <button
                  type="button"
                  onClick={() => { void handleConnect(); }}
                  className="w-full h-10 rounded-xl border border-border bg-background flex items-center justify-center gap-2 text-sm font-medium hover:bg-muted/60 transition-all duration-150"
                >
                  <GoogleDriveIcon size={16} />
                  Connect Google Drive
                </button>
              ) : (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" aria-hidden="true" />
                  <p className="text-xs text-destructive">
                    Google Drive is not configured. Set{' '}
                    <code className="font-mono">VITE_GOOGLE_CLIENT_ID</code> and{' '}
                    <code className="font-mono">VITE_GOOGLE_REDIRECT_URI</code> in your{' '}
                    <code className="font-mono">.env</code> file and restart the dev server.
                  </p>
                </div>
              )}

              {connectError && (
                <div className="flex items-center gap-2 text-xs text-destructive">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  {connectError}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Account row */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                <CheckCircle2
                  className="w-5 h-5 text-[hsl(var(--chart-4))] shrink-0"
                  aria-hidden="true"
                />
                <div className="flex flex-col gap-0 flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground truncate">
                    {connectedName ?? 'Google Drive'}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {connectedEmail ?? ''}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowDisconnectDialog(true); }}
                  disabled={isDisconnecting}
                  className="text-xs text-destructive hover:underline cursor-pointer ml-auto shrink-0 disabled:opacity-50"
                >
                  {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
                </button>
              </div>

              {/* Backup status row */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0">
                  <span className="text-sm font-medium text-foreground">Last backup</span>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {isBackingUp ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                        Backing up…
                      </>
                    ) : (
                      formatLastBackup(lastBackupAt)
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleBackupNow}
                  disabled={isBackingUp}
                  className="h-8 px-3 rounded-lg border border-border text-xs font-medium hover:bg-muted/60 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  Back up now
                </button>
              </div>

              {/* Error row */}
              {backupError && (
                <div className="flex items-center gap-2 text-xs text-destructive">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  {backupError}
                </div>
              )}

              {/* Backup history row */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Backup history</span>
                <button
                  type="button"
                  onClick={() => { setShowBackupList(true); }}
                  className="text-xs text-primary hover:underline cursor-pointer"
                >
                  View backups
                </button>
              </div>
            </>
          )}
        </div>
      </SettingsCard>

      {/* Disconnect confirmation */}
      <ConfirmDialog
        open={showDisconnectDialog}
        onOpenChange={setShowDisconnectDialog}
        title="Disconnect Google Drive?"
        description="Automatic backups will stop. Your existing backups on Google Drive will not be deleted."
        confirmLabel="Disconnect"
        cancelLabel="Cancel"
        onConfirm={handleDisconnect}
        destructive
      />

      {/* Backup list panel */}
      <BackupListPanel
        open={showBackupList}
        onClose={() => { setShowBackupList(false); }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DataBackupSection() {
  const currentUser = useSessionStore((s) => s.currentUser);
  const derivedKey = useSessionStore((s) => s.derivedKey);
  const addToast = useUIStore((s) => s.addToast);

  const [csvPending, setCsvPending] = useState(false);
  const [backupPending, setBackupPending] = useState(false);
  const [jsonPending, setJsonPending] = useState(false);
  const [importPending, setImportPending] = useState(false);
  const [showJsonWarning, setShowJsonWarning] = useState(false);
  const [showImportPasswordDialog, setShowImportPasswordDialog] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const userId = currentUser?.id;

  // ---------------------------------------------------------------------------
  // Export CSV
  // ---------------------------------------------------------------------------

  async function handleExportCSV() {
    if (!userId || !derivedKey) return;
    setCsvPending(true);
    const result = await exportTransactionsCSV(userId, derivedKey);
    if (result.success) {
      triggerBrowserDownload(result.data, `zentro-transactions-${todayString()}.csv`);
      addToast({ type: 'success', message: 'Transactions exported.' });
    } else {
      addToast({ type: 'error', message: result.error.message });
    }
    setCsvPending(false);
  }

  // ---------------------------------------------------------------------------
  // Export Encrypted Backup
  // ---------------------------------------------------------------------------

  async function handleExportBackup() {
    if (!userId || !derivedKey) return;
    setBackupPending(true);
    const result = await exportEncryptedBackup(userId, derivedKey);
    if (result.success) {
      triggerBrowserDownload(result.data.blob, `zentro-backup-${todayString()}.zentro`);
      addToast({ type: 'success', message: 'Encrypted backup saved.' });
    } else {
      addToast({ type: 'error', message: result.error.message });
    }
    setBackupPending(false);
  }

  // ---------------------------------------------------------------------------
  // Export Plain JSON (confirmed)
  // ---------------------------------------------------------------------------

  async function handleExportJSON() {
    if (!userId || !derivedKey) return;
    setJsonPending(true);
    const result = await exportPlainJSON(userId, derivedKey);
    if (result.success) {
      triggerBrowserDownload(result.data, `zentro-export-${todayString()}.json`);
      addToast({ type: 'success', message: 'Plain JSON export saved.' });
    } else {
      addToast({ type: 'error', message: result.error.message });
    }
    setJsonPending(false);
  }

  // ---------------------------------------------------------------------------
  // Import
  // ---------------------------------------------------------------------------

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = '';

    const isZentro = file.name.endsWith('.zentro');
    if (isZentro) {
      setPendingImportFile(file);
      setShowImportPasswordDialog(true);
    } else {
      void handleImportPlain(file);
    }
  }

  async function handleImportWithPassword(password: string) {
    if (!pendingImportFile || !userId) throw new Error('No file selected.');
    const result = await importEncryptedBackup(userId, password, pendingImportFile);
    if (!result.success) throw new Error(result.error.message);
    addToast({ type: 'success', message: 'Backup restored successfully.' });
    setPendingImportFile(null);
  }

  async function handleImportPlain(file: File) {
    if (!userId || !derivedKey) return;
    setImportPending(true);
    const result = await importPlainJSON(userId, derivedKey, file);
    if (result.success) {
      addToast({ type: 'success', message: 'Data imported successfully.' });
    } else {
      addToast({ type: 'error', message: result.error.message });
    }
    setImportPending(false);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SettingsSection
      id="data-backup"
      title="Data & Backup"
      description="Export your data or restore from a previous backup."
    >
      {/* Data locality notice */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 px-4 py-3">
        <HardDrive size={15} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
          Your data is stored locally on this device and does not sync automatically.{' '}
          <strong>Regular backups are strongly recommended.</strong>
        </p>
      </div>

      {/* Export */}
      <SettingsCard>
        <ExportButton
          label="Export Transactions as CSV"
          description="Download all transactions in an importable spreadsheet format."
          icon={<FileText size={14} />}
          onClick={() => { void handleExportCSV(); }}
          isPending={csvPending}
        />

        <ExportButton
          label="Encrypted Backup"
          description="Full backup encrypted with your password. Saved as a .zentro file."
          icon={<Download size={14} />}
          onClick={() => { void handleExportBackup(); }}
          isPending={backupPending}
        />

        <ExportButton
          label="Plain JSON Export"
          description="Unencrypted export. Useful for migrating data. Store the file securely."
          icon={<Download size={14} />}
          onClick={() => { setShowJsonWarning(true); }}
          isPending={jsonPending}
        />
      </SettingsCard>

      {/* Google Drive Backup */}
      <GoogleDriveCard />

      {/* Import */}
      <SettingsCard>
        <SettingsRow
          label="Restore from Backup"
          description="Import a .zentro encrypted backup or a plain JSON export. Existing data will be overwritten."
          icon={Upload}
          control={
            <button
              onClick={() => { handleImportClick(); }}
              disabled={importPending}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {importPending ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <Upload size={14} aria-hidden="true" />
              )}
              {importPending ? 'Importing…' : 'Choose file'}
            </button>
          }
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".zentro,.json,application/json"
          onChange={handleFileSelected}
          aria-hidden="true"
          className="sr-only"
          tabIndex={-1}
        />
      </SettingsCard>

      {/* Plain JSON warning dialog */}
      <ConfirmDialog
        open={showJsonWarning}
        onOpenChange={setShowJsonWarning}
        title="Export Unencrypted Data?"
        description="This file will contain all your financial data in plaintext. Anyone who can access the file can read your data. Store it in a secure location or delete it after use."
        confirmLabel="Export anyway"
        cancelLabel="Cancel"
        onConfirm={() => { void handleExportJSON(); }}
        destructive
      />

      {/* Password dialog for encrypted backup import */}
      {pendingImportFile && (
        <PasswordForImportDialog
          open={showImportPasswordDialog}
          onOpenChange={(open) => {
            setShowImportPasswordDialog(open);
            if (!open) setPendingImportFile(null);
          }}
          onConfirm={handleImportWithPassword}
          fileName={pendingImportFile.name}
        />
      )}
    </SettingsSection>
  );
}
