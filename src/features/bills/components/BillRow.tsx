import { useState, useRef, useCallback } from 'react';
import { MoreHorizontal, CheckCircle2, Clock, AlarmClock, XCircle, Undo2, Pencil } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { EnrichedBillEntry } from '@/shared/types/bill.types';
import type { UUID } from '@/shared/types/common.types';
import { isOverdue } from '@/services/bills/bill.service';
import { useBillStore } from '@/app/stores/bill.store';

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<
  EnrichedBillEntry['status'],
  { label: string; className: string }
> = {
  pending: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
  paid: { label: 'Paid', className: 'bg-chart-4/15 text-chart-4' },
  snoozed: { label: 'Snoozed', className: 'bg-chart-3/15 text-chart-3' },
  skipped: { label: 'Skipped', className: 'bg-muted text-muted-foreground' },
};

function getDueDateLabel(entry: EnrichedBillEntry): { text: string; className: string } {
  if (entry.status === 'paid') {
    const paidDate = entry.paidDate ? format(parseISO(entry.paidDate), 'MMM d') : 'N/A';
    return { text: `Paid ${paidDate}`, className: 'text-chart-4' };
  }
  if (entry.status === 'skipped') {
    return { text: 'Skipped', className: 'text-muted-foreground' };
  }
  const overdue = isOverdue(entry);
  const dateLabel = format(parseISO(entry.dueDate), 'MMM d');
  if (overdue) {
    return { text: `Overdue · ${dateLabel}`, className: 'text-destructive font-medium' };
  }
  if (entry.status === 'snoozed' && entry.snoozeUntil) {
    const snoozeLabel = format(parseISO(entry.snoozeUntil), 'MMM d');
    return { text: `Snooze until ${snoozeLabel}`, className: 'text-chart-3' };
  }
  return { text: `Due ${dateLabel}`, className: 'text-muted-foreground' };
}

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// ---------------------------------------------------------------------------
// Status icon
// ---------------------------------------------------------------------------

function StatusIcon({ status, isOverdueEntry }: { status: EnrichedBillEntry['status']; isOverdueEntry: boolean }) {
  if (status === 'paid') return <CheckCircle2 size={16} className="text-chart-4" aria-hidden="true" />;
  if (status === 'snoozed') return <AlarmClock size={16} className="text-chart-3" aria-hidden="true" />;
  if (status === 'skipped') return <XCircle size={16} className="text-muted-foreground" aria-hidden="true" />;
  if (isOverdueEntry) return <Clock size={16} className="text-destructive" aria-hidden="true" />;
  return <Clock size={16} className="text-primary" aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// Action menu
// ---------------------------------------------------------------------------

type ActionMenuProps = {
  entry: EnrichedBillEntry;
  onSnooze: () => void;
  onSkip: () => void;
  onUndoPay: () => void;
  onEdit: () => void;
};

function ActionMenu({ entry, onSnooze, onSkip, onUndoPay, onEdit }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const skipEntry = useBillStore((s) => s.skipEntry);
  const undoPayEntry = useBillStore((s) => s.undoPayEntry);

  const close = useCallback(() => { setOpen(false); }, []);

  const handleSkip = useCallback(() => {
    void skipEntry(entry.id);
    onSkip();
    close();
  }, [entry.id, skipEntry, onSkip, close]);

  const handleUndoPay = useCallback(() => {
    void undoPayEntry(entry.id);
    onUndoPay();
    close();
  }, [entry.id, undoPayEntry, onUndoPay, close]);

  const handleSnooze = useCallback(() => {
    onSnooze();
    close();
  }, [onSnooze, close]);

  const handleEdit = useCallback(() => {
    onEdit();
    close();
  }, [onEdit, close]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={close}
            aria-hidden="true"
          />
          <div
            role="menu"
            className="absolute right-0 top-8 z-40 min-w-[160px] rounded-xl border border-border bg-card shadow-lg py-1"
          >
            {(entry.status === 'pending' || entry.status === 'snoozed') && (
              <button
                role="menuitem"
                type="button"
                onClick={handleSnooze}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <AlarmClock size={14} aria-hidden="true" />
                Snooze
              </button>
            )}
            {(entry.status === 'pending' || entry.status === 'snoozed') && (
              <button
                role="menuitem"
                type="button"
                onClick={handleSkip}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <XCircle size={14} aria-hidden="true" />
                Skip this month
              </button>
            )}
            {entry.status === 'paid' && (
              <button
                role="menuitem"
                type="button"
                onClick={handleUndoPay}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <Undo2 size={14} aria-hidden="true" />
                Undo payment
              </button>
            )}
            <button
              role="menuitem"
              type="button"
              onClick={handleEdit}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <Pencil size={14} aria-hidden="true" />
              Edit bill
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BillRow
// ---------------------------------------------------------------------------

type BillRowProps = {
  entry: EnrichedBillEntry;
  isBulkMode: boolean;
  isSelected: boolean;
  onToggleSelect: (id: UUID) => void;
  onOpenQuickPay: (entry: EnrichedBillEntry) => void;
  onOpenSnooze: (entry: EnrichedBillEntry) => void;
  onEditBill: (billId: UUID) => void;
};

export function BillRow({
  entry,
  isBulkMode,
  isSelected,
  onToggleSelect,
  onOpenQuickPay,
  onOpenSnooze,
  onEditBill,
}: BillRowProps) {
  const overdue = isOverdue(entry);
  const badge = STATUS_BADGE[entry.status];
  const dueDateInfo = getDueDateLabel(entry);
  const isPaid = entry.status === 'paid' || entry.status === 'skipped';
  const isPayable = entry.status === 'pending' || entry.status === 'snoozed';

  const handleRowClick = useCallback(() => {
    if (isBulkMode) {
      onToggleSelect(entry.id);
    } else if (isPayable) {
      onOpenQuickPay(entry);
    }
  }, [isBulkMode, isPayable, entry, onToggleSelect, onOpenQuickPay]);

  return (
    <div
      role={isBulkMode ? 'checkbox' : 'button'}
      aria-checked={isBulkMode ? isSelected : undefined}
      aria-label={`${entry.bill.name} — ${formatAmount(entry.bill.amount, entry.bill.currency)} — ${badge.label}`}
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(); } }}
      className={[
        'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors rounded-xl',
        'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isBulkMode && isSelected ? 'bg-primary/5' : '',
        overdue && !isPaid ? 'border-l-2 border-destructive' : '',
      ].join(' ')}
    >
      {/* Bulk checkbox */}
      {isBulkMode && (
        <div
          className={[
            'h-5 w-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors',
            isSelected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background',
          ].join(' ')}
          aria-hidden="true"
        >
          {isSelected && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L4 7L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      )}

      {/* Status icon + emoji */}
      <div className="relative flex-shrink-0">
        <span className="text-2xl leading-none" role="img" aria-label={entry.bill.name}>
          {entry.bill.emoji || '💳'}
        </span>
        <span className="absolute -bottom-0.5 -right-0.5">
          <StatusIcon status={entry.status} isOverdueEntry={overdue} />
        </span>
      </div>

      {/* Name + due date */}
      <div className="flex-1 min-w-0">
        <p className={`truncate font-medium ${isPaid ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
          {entry.bill.name}
        </p>
        <p className={`text-xs ${dueDateInfo.className}`}>{dueDateInfo.text}</p>
      </div>

      {/* Amount + badge + menu */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-sm font-semibold ${isPaid ? 'text-muted-foreground' : 'text-foreground'}`}>
          {formatAmount(entry.bill.amount, entry.bill.currency)}
        </span>
        <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
          {badge.label}
        </span>
        {!isBulkMode && (
          <div onClick={(e) => { e.stopPropagation(); }}>
            <ActionMenu
              entry={entry}
              onSnooze={() => { onOpenSnooze(entry); }}
              onSkip={() => { /* handled inside */ }}
              onUndoPay={() => { /* handled inside */ }}
              onEdit={() => { onEditBill(entry.bill.id); }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
