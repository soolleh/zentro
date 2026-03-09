import { useEffect, useRef, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTransactionStore, useBulkMode, useBulkOperation, type BulkOperationRecord } from '@/app/stores/transaction.store';
import { useSessionStore } from '@/app/stores/session.store';
import { useUIStore } from '@/app/ui.store';
import { bulkDeleteTransactions } from '@/services/transactions/bulk-transaction.service';
import { formatCurrency } from '@/shared/utils/currency.utils';
import type { UUID, ISODateString } from '@/shared/types/common.types';
import { useShallow } from 'zustand/react/shallow';

type BulkDeleteDialogProps = {
  readonly open: boolean;
  readonly selectedIds: UUID[];
  readonly onClose: () => void;
};

const FOCUSABLE_SELECTORS =
  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));
}

export function BulkDeleteDialog({ open, selectedIds, onClose }: BulkDeleteDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  const transactions = useTransactionStore(useShallow((s) => s.transactions));
  const removeBulkDeleted = useTransactionStore((s) => s.removeBulkDeleted);
  const setLastBulkOperation = useTransactionStore((s) => s.setLastBulkOperation);
  const { setBulkOperating, setBulkOperationError, isBulkOperating } = useBulkOperation();
  const { exitBulkMode } = useBulkMode();
  const derivedKey = useSessionStore((s) => s.derivedKey);
  const addToast = useUIStore((s) => s.addToast);

  const selectedTxs = useMemo(
    () => transactions.filter((t) => selectedIds.includes(t.id as UUID)),
    [transactions, selectedIds],
  );

  // Summarise: single-currency total or mixed indicator
  const amountSummary = useMemo(() => {
    const byCurrency = new Map<string, number>();
    for (const tx of selectedTxs) {
      const prev = byCurrency.get(tx.currency) ?? 0;
      byCurrency.set(tx.currency, prev + tx.amount);
    }
    if (byCurrency.size === 0) return null;
    if (byCurrency.size === 1) {
      const [[currency, total]] = Array.from(byCurrency.entries());
      return formatCurrency(total, currency);
    }
    // Mixed currencies — just show the count of distinct currencies
    return `${selectedTxs.length.toString()} transactions across ${byCurrency.size.toString()} currencies`;
  }, [selectedTxs]);

  // Remember opening trigger for focus restore
  useEffect(() => {
    if (open) triggerRef.current = document.activeElement;
  }, [open]);

  // Auto-focus and cleanup
  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const focusable = getFocusableElements(dialogRef.current);
    focusable[0]?.focus();

    return () => {
      (triggerRef.current as HTMLElement | null)?.focus();
    };
  }, [open]);

  // Keyboard: Escape + Tab trap
  useEffect(() => {
    if (!open || !dialogRef.current) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); };
  }, [open, onClose]);

  if (!open) return null;

  async function handleConfirmDelete() {
    if (!derivedKey) return;
    setBulkOperating(true);

    try {
      // Snapshot full transaction records before deletion
      const snapshots: Record<UUID, import('@/shared/types/transaction.types').Transaction> = {};
      for (const tx of selectedTxs) {
        snapshots[tx.id as UUID] = tx;
      }

      const result = await bulkDeleteTransactions(selectedIds, derivedKey);
      if (!result.success) {
        setBulkOperationError(result.error.message);
        return;
      }

      const { deleted, errors } = result.data;

      removeBulkDeleted(selectedIds);

      const record: BulkOperationRecord = {
        type: 'delete',
        affectedIds: selectedIds,
        previousValues: snapshots,
        description: `Deleted ${deleted.toString()} transaction${deleted !== 1 ? 's' : ''}`,
        performedAt: new Date().toISOString() as ISODateString,
      };
      setLastBulkOperation(record);

      const msg = errors > 0
        ? `${deleted.toString()} deleted, ${errors.toString()} failed.`
        : `${deleted.toString()} transaction${deleted !== 1 ? 's' : ''} deleted.`;
      addToast({ message: msg, type: errors > 0 ? 'warning' : 'success' });

      onClose();
      exitBulkMode();
    } finally {
      setBulkOperating(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="bulk-delete-title"
        aria-describedby="bulk-delete-desc"
        className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-xl border border-border bg-card shadow-lg p-6 focus:outline-none"
        tabIndex={-1}
      >
        <h2
          id="bulk-delete-title"
          className="text-base font-semibold text-foreground mb-1"
        >
          Delete {selectedIds.length.toString()} transaction{selectedIds.length !== 1 ? 's' : ''}?
        </h2>
        <p
          id="bulk-delete-desc"
          className="text-sm text-muted-foreground mb-4 leading-relaxed"
        >
          This action cannot be undone. All selected records will be permanently removed.
        </p>

        {/* Warning card */}
        {amountSummary && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/6 border border-destructive/20 mb-5">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" aria-hidden />
            <div className="text-xs text-foreground">
              <p className="font-medium text-destructive">
                You are deleting {selectedIds.length.toString()} transaction{selectedIds.length !== 1 ? 's' : ''}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                Total value: <span className="font-semibold text-foreground">{amountSummary}</span>
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isBulkOperating}
            className="rounded-lg px-4 py-2 text-sm font-medium text-foreground bg-secondary hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { void handleConfirmDelete(); }}
            disabled={isBulkOperating}
            className="rounded-lg px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-destructive disabled:opacity-60"
          >
            {isBulkOperating ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </>
  );
}
