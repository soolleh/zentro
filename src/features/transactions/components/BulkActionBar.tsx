import { useState } from 'react';
import { Tag, Tags, CalendarClock, Trash2, RotateCcw, Loader2 } from 'lucide-react';
import { useBulkMode, useBulkOperation, useTransactionStore } from '@/app/stores/transaction.store';
import { useUIStore } from '@/app/ui.store';
import type { BulkEditField } from '@/services/transactions/bulk-transaction.service';
import { BulkEditPanel } from './BulkEditPanel';
import { BulkDeleteDialog } from './BulkDeleteDialog';

export function BulkActionBar() {
  const { isBulkMode, selectedTransactionIds, clearSelection } = useBulkMode();
  const { isBulkOperating, lastBulkOperation, undoLastBulkOperation } = useBulkOperation();
  const setLastBulkOperation = useTransactionStore((s) => s.setLastBulkOperation);
  const addToast = useUIStore((s) => s.addToast);

  const [activeField, setActiveField] = useState<BulkEditField | 'date-shift' | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);

  const count = selectedTransactionIds.length;
  const disabled = count === 0 || isBulkOperating;

  if (!isBulkMode) return null;

  const ACTIONS: {
    field: BulkEditField | 'date-shift';
    icon: React.ReactNode;
    label: string;
    color?: string;
  }[] = [
      {
        field: 'categoryId',
        icon: <Tag className="w-5 h-5 text-primary" aria-hidden />,
        label: 'Categorize',
      },
      {
        field: 'tagIds',
        icon: <Tags className="w-5 h-5 text-primary" aria-hidden />,
        label: 'Tag',
      },
      {
        field: 'date-shift',
        icon: <CalendarClock className="w-5 h-5 text-[hsl(var(--chart-3))]" aria-hidden />,
        label: 'Shift Date',
      },
    ];

  async function handleUndo() {
    setIsUndoing(true);
    try {
      await undoLastBulkOperation();
      setLastBulkOperation(null);
      addToast({ message: 'Undone.', type: 'success' });
    } finally {
      setIsUndoing(false);
    }
  }

  return (
    <>
      {/* Action bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-lg px-4 pt-3 pb-6 animate-in slide-in-from-bottom duration-200"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        {/* Undo strip */}
        {lastBulkOperation && (
          <div className="flex items-center justify-between py-2 px-3 mb-2 bg-muted/40 rounded-xl border border-border">
            <div className="flex items-center gap-2 min-w-0">
              <RotateCcw className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />
              <span className="text-xs text-muted-foreground truncate">
                {lastBulkOperation.description}
              </span>
            </div>
            <button
              type="button"
              disabled={isUndoing}
              onClick={() => { void handleUndo(); }}
              className="h-7 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all duration-150 shrink-0 ml-2 flex items-center gap-1 disabled:opacity-60"
            >
              {isUndoing && <Loader2 className="w-3 h-3 animate-spin" aria-hidden />}
              Undo
            </button>
          </div>
        )}

        {/* Selection summary */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-foreground">
            {count === 1 ? '1 transaction selected' : `${count.toString()} transactions selected`}
          </span>
          <button
            type="button"
            onClick={clearSelection}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            Clear
          </button>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-4 gap-2">
          {ACTIONS.map(({ field, icon, label }) => (
            <button
              key={field}
              type="button"
              disabled={disabled}
              onClick={() => { setActiveField(field); }}
              className="flex flex-col items-center gap-1 p-2.5 rounded-xl border border-border bg-background cursor-pointer hover:bg-muted/60 hover:border-primary/30 transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {icon}
              <span className="text-[10px] font-medium text-foreground">{label}</span>
            </button>
          ))}

          {/* Delete */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => { setDeleteOpen(true); }}
            className="flex flex-col items-center gap-1 p-2.5 rounded-xl border border-border bg-background cursor-pointer hover:bg-muted/60 hover:border-destructive/30 transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-5 h-5 text-destructive" aria-hidden />
            <span className="text-[10px] font-medium text-destructive">Delete</span>
          </button>
        </div>

        {/* "Select all" loading note */}
        {count > 0 && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Selecting {count.toString()} loaded transaction{count !== 1 ? 's' : ''}. Scroll down to load more.
          </p>
        )}
      </div>

      {/* Bulk edit panel */}
      <BulkEditPanel
        open={activeField !== null}
        field={activeField ?? 'categoryId'}
        selectedIds={selectedTransactionIds}
        onClose={() => { setActiveField(null); }}
      />

      {/* Bulk delete dialog */}
      <BulkDeleteDialog
        open={deleteOpen}
        selectedIds={selectedTransactionIds}
        onClose={() => { setDeleteOpen(false); }}
      />
    </>
  );
}
