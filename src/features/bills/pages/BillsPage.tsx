import { useEffect, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  List,
  CheckSquare,
  Loader2,
  ReceiptText,
} from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { useBillStore } from '@/app/stores/bill.store';
import { useCurrentUser } from '@/app/stores/session.store';
import type { EnrichedBillEntry } from '@/shared/types/bill.types';
import type { UUID } from '@/shared/types/common.types';
import { isOverdue } from '@/services/bills/bill.service';
import { BillsSummaryStrip } from '@/features/bills/components/BillsSummaryStrip';
import { BillRow } from '@/features/bills/components/BillRow';
import { QuickPaySheet } from '@/features/bills/components/QuickPaySheet';
import { SnoozePicker } from '@/features/bills/components/SnoozePicker';
import { BulkActionBar } from '@/features/bills/components/BulkActionBar';
import { BillForm } from '@/features/bills/components/BillForm';

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <span className="h-4 min-w-4 px-1 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center">
        {count}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ monthLabel }: { monthLabel: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <ReceiptText size={48} className="text-muted-foreground/40 mb-4" aria-hidden="true" />
      <p className="font-medium text-foreground mb-1">No bills for {monthLabel}</p>
      <p className="text-sm text-muted-foreground">
        Tap the + button to add your first recurring bill.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BillsPage
// ---------------------------------------------------------------------------

export function BillsPage() {
  const currentUser = useCurrentUser();

  const {
    entries,
    bills,
    monthOffset,
    isLoading,
    isBulkMode,
    selectedEntryIds,
    isFormOpen,
    editingBill,
    isQuickPayOpen,
    quickPayEntry,
    isSnoozeOpen,
    activeSnoozeEntry,
    loadBills,
    loadEntries,
    loadSummary,
    setMonthOffset,
    openForm,
    closeForm,
    openQuickPay,
    closeQuickPay,
    openSnooze,
    closeSnooze,
    toggleBulkMode,
    toggleEntrySelection,
  } = useBillStore(
    useShallow((s) => ({
      entries: s.entries,
      bills: s.bills,
      monthOffset: s.monthOffset,
      isLoading: s.isLoading,
      isBulkMode: s.isBulkMode,
      selectedEntryIds: s.selectedEntryIds,
      isFormOpen: s.isFormOpen,
      editingBill: s.editingBill,
      isQuickPayOpen: s.isQuickPayOpen,
      quickPayEntry: s.quickPayEntry,
      isSnoozeOpen: s.isSnoozeOpen,
      activeSnoozeEntry: s.activeSnoozeEntry,
      loadBills: s.loadBills,
      loadEntries: s.loadEntries,
      loadSummary: s.loadSummary,
      setMonthOffset: s.setMonthOffset,
      openForm: s.openForm,
      closeForm: s.closeForm,
      openQuickPay: s.openQuickPay,
      closeQuickPay: s.closeQuickPay,
      openSnooze: s.openSnooze,
      closeSnooze: s.closeSnooze,
      toggleBulkMode: s.toggleBulkMode,
      toggleEntrySelection: s.toggleEntrySelection,
    }))
  );

  // Explicitly typed alias so both ESLint and tsc-b agree on EnrichedBillEntry|null
  const snoozeEntryForPicker: EnrichedBillEntry | null = activeSnoozeEntry;

  // Initial load
  useEffect(() => {
    if (!currentUser) return;
    void loadBills(currentUser.id);
    void loadSummary(currentUser.id);
  }, [currentUser, loadBills, loadSummary]);

  // Reload entries when month changes
  useEffect(() => {
    if (!currentUser) return;
    void loadEntries(currentUser.id);
  }, [currentUser, monthOffset, loadEntries]);

  // Reload summary when entries change (after pay/skip/snooze)
  useEffect(() => {
    if (!currentUser) return;
    void loadSummary(currentUser.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  // Month label header
  const refDate = addMonths(new Date(), monthOffset);
  const monthLabel = format(refDate, 'MMMM yyyy');

  // Group entries
  const overdueEntries = entries.filter(
    (e: EnrichedBillEntry) =>
      (e.status === 'pending' || e.status === 'snoozed') && isOverdue(e)
  );
  const pendingEntries = entries.filter(
    (e: EnrichedBillEntry) =>
      (e.status === 'pending' || e.status === 'snoozed') && !isOverdue(e)
  );
  const doneEntries = entries.filter(
    (e: EnrichedBillEntry) => e.status === 'paid' || e.status === 'skipped'
  );

  const handleEditBill = useCallback(
    (billId: UUID) => {
      const bill = bills.find((b) => b.id === billId);
      if (bill) openForm(bill);
    },
    [bills, openForm]
  );

  const renderEntryGroup = (group: EnrichedBillEntry[]) =>
    group.map((entry) => (
      <BillRow
        key={entry.id}
        entry={entry}
        isBulkMode={isBulkMode}
        isSelected={selectedEntryIds.includes(entry.id)}
        onToggleSelect={toggleEntrySelection}
        onOpenQuickPay={openQuickPay}
        onOpenSnooze={openSnooze}
        onEditBill={handleEditBill}
      />
    ));

  return (
    <div className="min-h-full bg-background pb-32">
      {/* ── Page header ── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h1 className="text-xl font-bold text-foreground">Bills</h1>
          <div className="flex items-center gap-2">
            {/* Bulk mode toggle */}
            <button
              type="button"
              onClick={toggleBulkMode}
              className={[
                'p-2 rounded-lg transition-colors text-sm',
                isBulkMode
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              ].join(' ')}
              aria-label={isBulkMode ? 'Exit bulk select' : 'Select multiple bills'}
              aria-pressed={isBulkMode}
            >
              {isBulkMode ? (
                <CheckSquare size={18} aria-hidden="true" />
              ) : (
                <List size={18} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between px-4 pb-3">
          <button
            type="button"
            onClick={() => { setMonthOffset(monthOffset - 1); }}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => { setMonthOffset(0); }}
            className="text-sm font-semibold text-foreground hover:text-primary transition-colors px-2"
            aria-label={`Viewing ${monthLabel}. Click to return to current month.`}
          >
            {monthLabel}
          </button>
          <button
            type="button"
            onClick={() => { setMonthOffset(monthOffset + 1); }}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Next month"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ── Summary strip ── */}
      <BillsSummaryStrip />

      {/* ── Bill list ── */}
      {isLoading && entries.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-muted-foreground" aria-label="Loading bills" />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState monthLabel={monthLabel} />
      ) : (
        <div className="flex flex-col">
          {/* Overdue */}
          {overdueEntries.length > 0 && (
            <section aria-label="Overdue bills">
              <SectionHeader title="Overdue" count={overdueEntries.length} />
              <div className="mx-4 rounded-xl border border-destructive/20 bg-destructive/5 overflow-hidden divide-y divide-border">
                {renderEntryGroup(overdueEntries)}
              </div>
            </section>
          )}

          {/* Pending / upcoming */}
          {pendingEntries.length > 0 && (
            <section aria-label="Pending bills" className="mt-2">
              <SectionHeader title="Upcoming" count={pendingEntries.length} />
              <div className="mx-4 rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
                {renderEntryGroup(pendingEntries)}
              </div>
            </section>
          )}

          {/* Paid / Skipped */}
          {doneEntries.length > 0 && (
            <section aria-label="Paid and skipped bills" className="mt-2">
              <SectionHeader title="Paid & Skipped" count={doneEntries.length} />
              <div className="mx-4 rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
                {renderEntryGroup(doneEntries)}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── FAB ── */}
      {!isBulkMode && (
        <button
          type="button"
          onClick={() => { openForm(); }}
          className="fixed bottom-24 right-4 z-30 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:bottom-8"
          aria-label="Add new bill"
        >
          <Plus size={24} aria-hidden="true" />
        </button>
      )}

      {/* ── Bulk action bar ── */}
      {isBulkMode && <BulkActionBar />}

      {/* ── Modals ── */}
      <BillForm
        open={isFormOpen}
        editingBill={editingBill}
        onClose={closeForm}
      />

      {isQuickPayOpen && quickPayEntry && (
        <QuickPaySheet entry={quickPayEntry} onClose={closeQuickPay} />
      )}

      {isSnoozeOpen && snoozeEntryForPicker !== null && (
        <SnoozePicker entry={snoozeEntryForPicker} onClose={closeSnooze} />
      )}
    </div>
  );
}
