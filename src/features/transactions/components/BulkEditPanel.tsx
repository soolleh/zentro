import { useState, useMemo } from 'react';
import { AlertTriangle, Calendar } from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';
import { SlidePanel } from '@/shared/components/SlidePanel';
import { CategorySelector } from './CategorySelector';
import {
  useBulkOperation,
  useTransactionStore,
  type BulkOperationRecord,
} from '@/app/stores/transaction.store';
import { useSessionStore } from '@/app/stores/session.store';
import { useUIStore } from '@/app/ui.store';
import { bulkUpdateField, bulkShiftDates, type BulkEditField } from '@/services/transactions/bulk-transaction.service';
import type { UUID, ISODateString } from '@/shared/types/common.types';
import { useShallow } from 'zustand/react/shallow';

type BulkEditPanelProps = {
  open: boolean;
  field: BulkEditField | 'date-shift';
  selectedIds: UUID[];
  onClose: () => void;
};

const PANEL_TITLES: Record<BulkEditField | 'date-shift', string> = {
  categoryId: 'Change Category',
  tagIds: 'Add / Remove Tags',
  accountId: 'Change Account',
  type: 'Change Type',
  notes: 'Edit Notes',
  'date-shift': 'Shift Dates',
};

// ---------------------------------------------------------------------------
// CategoryId panel
// ---------------------------------------------------------------------------

function CategoryPanel({
  selectedIds,
  onClose,
}: {
  selectedIds: UUID[];
  onClose: () => void;
}) {
  const transactions = useTransactionStore(useShallow((s) => s.transactions));
  const applyBulkUpdates = useTransactionStore((s) => s.applyBulkUpdates);
  const setLastBulkOperation = useTransactionStore((s) => s.setLastBulkOperation);
  const { setBulkOperating, setBulkOperationError } = useBulkOperation();
  const derivedKey = useSessionStore((s) => s.derivedKey);
  const addToast = useUIStore((s) => s.addToast);

  const [categoryId, setCategoryId] = useState<UUID | null>(null);
  const [error, setError] = useState('');

  const selectedTxs = useMemo(
    () => transactions.filter((t) => selectedIds.includes(t.id as UUID)),
    [transactions, selectedIds]
  );

  const hasMixedTypes = useMemo(() => {
    const types = new Set(selectedTxs.map((t) => t.type));
    return types.size > 1;
  }, [selectedTxs]);

  async function handleSubmit() {
    if (!categoryId) { setError('Please select a category.'); return; }
    if (!derivedKey) return;
    setError('');
    setBulkOperating(true);

    try {
      const result = await bulkUpdateField(selectedIds, 'categoryId', categoryId, derivedKey);
      if (!result.success) {
        setBulkOperationError(result.error.message);
        setError(result.error.message);
        return;
      }
      const { updated, errors, previousValues } = result.data;

      // Update in-memory list
      const updateMap: Record<UUID, { categoryId: UUID }> = {};
      for (const id of selectedIds) {
        updateMap[id] = { categoryId };
      }
      applyBulkUpdates(updateMap);

      const record: BulkOperationRecord = {
        type: 'categorize',
        affectedIds: selectedIds,
        previousValues,
        description: `Changed category for ${updated.toString()} transaction${updated !== 1 ? 's' : ''}`,
        performedAt: new Date().toISOString() as ISODateString,
      };
      setLastBulkOperation(record);

      const msg = errors > 0
        ? `${updated.toString()} updated, ${errors.toString()} failed.`
        : `Category updated for ${updated.toString()} transaction${updated !== 1 ? 's' : ''}.`;
      addToast({ message: msg, type: errors > 0 ? 'warning' : 'success' });
      onClose();
    } finally {
      setBulkOperating(false);
    }
  }

  return (
    <div className="px-6 py-5 flex flex-col gap-4 pb-32">
      <p className="text-sm font-medium text-foreground mb-0">New category</p>
      <CategorySelector
        value={categoryId}
        onChange={(id) => { setCategoryId(id); setError(''); }}
      />

      {hasMixedTypes && (
        <div className="flex items-start gap-1.5 p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/60">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" aria-hidden />
          <p className="text-xs text-amber-700">
            Your selection includes multiple transaction types. The selected category will be applied to all of them.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="sticky bottom-0 bg-card border-t border-border -mx-6 px-6 py-4 mt-4">
        <button
          type="button"
          onClick={() => { void handleSubmit(); }}
          className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-150 disabled:opacity-60"
          disabled={!categoryId}
        >
          Apply to {selectedIds.length.toString()} transaction{selectedIds.length !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date-shift panel
// ---------------------------------------------------------------------------

function DateShiftPanel({
  selectedIds,
  onClose,
}: {
  selectedIds: UUID[];
  onClose: () => void;
}) {
  const transactions = useTransactionStore(useShallow((s) => s.transactions));
  const applyBulkUpdates = useTransactionStore((s) => s.applyBulkUpdates);
  const setLastBulkOperation = useTransactionStore((s) => s.setLastBulkOperation);
  const { setBulkOperating, setBulkOperationError, isBulkOperating } = useBulkOperation();
  const derivedKey = useSessionStore((s) => s.derivedKey);
  const addToast = useUIStore((s) => s.addToast);

  const [direction, setDirection] = useState<'backward' | 'forward'>('backward');
  const [days, setDays] = useState(1);
  const [error, setError] = useState('');

  const shiftDays = direction === 'forward' ? days : -days;
  const today = new Date();
  const previewFrom = format(today, 'MMM d');
  const previewTo = format(addDays(today, shiftDays), 'MMM d');

  const shiftedAnyFuture = direction === 'forward' && days > 0;

  async function handleSubmit() {
    if (!derivedKey) return;
    setError('');
    setBulkOperating(true);

    try {
      const result = await bulkShiftDates(selectedIds, shiftDays, derivedKey);
      if (!result.success) {
        setBulkOperationError(result.error.message);
        setError(result.error.message);
        return;
      }
      const { updated, errors, previousValues } = result.data;

      // Build new-value map for in-memory update
      const updateMap: Record<UUID, { date: ISODateString }> = {};
      const selectedTxs = transactions.filter((t) => selectedIds.includes(t.id as UUID));
      for (const tx of selectedTxs) {
        const shifted = addDays(parseISO(tx.date), shiftDays);
        updateMap[tx.id as UUID] = {
          date: shifted.toISOString() as ISODateString,
        };
      }
      applyBulkUpdates(updateMap);

      const record: BulkOperationRecord = {
        type: 'date-shift',
        affectedIds: selectedIds,
        previousValues,
        description: `Shifted ${updated.toString()} date${updated !== 1 ? 's' : ''} ${direction} by ${days.toString()} day${days !== 1 ? 's' : ''}`,
        performedAt: new Date().toISOString() as ISODateString,
      };
      setLastBulkOperation(record);

      const msg = errors > 0
        ? `${updated.toString()} updated, ${errors.toString()} failed.`
        : `Shifted ${updated.toString()} date${updated !== 1 ? 's' : ''}.`;
      addToast({ message: msg, type: errors > 0 ? 'warning' : 'success' });
      onClose();
    } finally {
      setBulkOperating(false);
    }
  }

  return (
    <div className="px-6 py-5 flex flex-col gap-4 pb-32">
      <p className="text-sm font-medium text-foreground">Shift all dates by</p>

      {/* Direction selector */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted">
        {(['backward', 'forward'] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => { setDirection(d); }}
            className={[
              'flex-1 py-1.5 rounded-md text-sm font-medium transition-all duration-150 capitalize',
              direction === d
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {d === 'backward' ? 'Backward' : 'Forward'}
          </button>
        ))}
      </div>

      {/* Days input */}
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={365}
          value={days}
          inputMode="numeric"
          onChange={(e) => {
            const v = Math.max(1, Math.min(365, parseInt(e.target.value, 10) || 1));
            setDays(v);
          }}
          className="w-16 h-10 rounded-lg border border-input bg-background px-3 text-sm font-semibold tabular-nums text-center focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <span className="text-sm text-muted-foreground">
          day{days !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Preview */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/40 border border-border">
        <Calendar className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
        <div className="text-xs text-muted-foreground">
          <span>
            Dates will shift {direction} by {days.toString()} day{days !== 1 ? 's' : ''}.
          </span>
          <span className="ml-1 text-foreground font-medium">
            e.g. {previewFrom} → {previewTo}
          </span>
        </div>
      </div>

      {/* Future date warning */}
      {shiftedAnyFuture && (
        <div className="flex items-start gap-1.5 p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/60">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" aria-hidden />
          <p className="text-xs text-amber-700">
            Some transactions may be dated in the future.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="sticky bottom-0 bg-card border-t border-border -mx-6 px-6 py-4 mt-4">
        <button
          type="button"
          onClick={() => { void handleSubmit(); }}
          disabled={isBulkOperating}
          className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-150 disabled:opacity-60"
        >
          {isBulkOperating ? 'Shifting…' : `Shift ${selectedIds.length.toString()} date${selectedIds.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tag panel (stub — tag infrastructure not yet available on transactions)
// ---------------------------------------------------------------------------

function TagPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="px-6 py-5 flex flex-col gap-4 pb-32">
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <span className="text-4xl">🏷️</span>
        <p className="text-sm font-semibold text-foreground">Tag support coming soon</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Transaction tags will be available in an upcoming update.
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="w-full h-10 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-colors duration-150"
      >
        Close
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BulkEditPanel
// ---------------------------------------------------------------------------

export function BulkEditPanel({ open, field, selectedIds, onClose }: BulkEditPanelProps) {
  const title = PANEL_TITLES[field] ?? 'Edit';
  const count = selectedIds.length;

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
    >
      <div className="px-6 pt-1 pb-2 border-b border-border">
        <p className="text-xs text-muted-foreground">
          Applying to {count.toString()} transaction{count !== 1 ? 's' : ''}
        </p>
      </div>

      {field === 'categoryId' && (
        <CategoryPanel selectedIds={selectedIds} onClose={onClose} />
      )}
      {field === 'date-shift' && (
        <DateShiftPanel selectedIds={selectedIds} onClose={onClose} />
      )}
      {field === 'tagIds' && (
        <TagPanel onClose={onClose} />
      )}
    </SlidePanel>
  );
}
