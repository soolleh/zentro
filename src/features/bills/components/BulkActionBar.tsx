import { CheckCircle2, X, CheckSquare } from 'lucide-react';
import { format } from 'date-fns';
import type { ISODateString } from '@/shared/types/common.types';
import { useBillStore } from '@/app/stores/bill.store';
import { useCurrentUser } from '@/app/stores/session.store';
import { useShallow } from 'zustand/react/shallow';

const LABEL_SELECT_ALL = 'Select all pending';
const LABEL_DESELECT = 'Deselect all';
const BTN_CANCEL = 'Cancel';

export function BulkActionBar() {
  const currentUser = useCurrentUser();
  const { selectedEntryIds, isLoading, bulkPaySelected, selectAllPending, clearSelection, toggleBulkMode } =
    useBillStore(
      useShallow((s) => ({
        selectedEntryIds: s.selectedEntryIds,
        isLoading: s.isLoading,
        bulkPaySelected: s.bulkPaySelected,
        selectAllPending: s.selectAllPending,
        clearSelection: s.clearSelection,
        toggleBulkMode: s.toggleBulkMode,
      }))
    );

  const count = selectedEntryIds.length;

  const handleBulkPay = () => {
    if (!currentUser || count === 0) return;
    const today = format(new Date(), "yyyy-MM-dd'T'00:00:00.000'Z'") as ISODateString;
    void bulkPaySelected(currentUser.id, today);
  };

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="fixed bottom-20 left-4 right-4 z-40 lg:bottom-6 lg:max-w-lg lg:mx-auto"
    >
      <div className="bg-card border border-border rounded-2xl shadow-xl p-3">
        {/* Selection summary */}
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-sm font-medium text-foreground">
            {count === 0 ? 'No bills selected' : `${String(count)} bill${count === 1 ? '' : 's'} selected`}
          </span>
          <button
            type="button"
            onClick={toggleBulkMode}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label={BTN_CANCEL}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Secondary actions */}
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={selectAllPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors"
          >
            <CheckSquare size={12} aria-hidden="true" />
            {LABEL_SELECT_ALL}
          </button>
          {count > 0 && (
            <button
              type="button"
              onClick={clearSelection}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground border border-border hover:bg-muted transition-colors"
            >
              {LABEL_DESELECT}
            </button>
          )}
        </div>

        {/* Pay button */}
        <button
          type="button"
          onClick={handleBulkPay}
          disabled={count === 0 || isLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 transition-opacity"
        >
          {isLoading ? (
            <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 size={16} aria-hidden="true" />
          )}
          {count === 0 ? 'Pay Selected' : `Pay ${String(count)} Bill${count === 1 ? '' : 's'} Today`}
        </button>
      </div>
    </div>
  );
}
