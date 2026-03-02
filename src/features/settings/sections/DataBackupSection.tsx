/**
 * DataBackupSection
 *
 * Export (CSV, encrypted backup, plain JSON) and import (restore from backup).
 */

import { useRef, useState } from 'react';
import {
  HardDrive,
  Download,
  Upload,
  FileText,
  Loader2,
} from 'lucide-react';
import { SettingsSection } from '../components/SettingsSection';
import { SettingsCard } from '../components/SettingsCard';
import { SettingsRow } from '../components/SettingsRow';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { PasswordForImportDialog } from '../components/PasswordForImportDialog';
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
      triggerBrowserDownload(result.data, `zentro-backup-${todayString()}.zentro`);
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
