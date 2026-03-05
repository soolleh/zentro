import { useState, useEffect, useRef } from 'react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import type { EnrichedBillEntry } from '@/shared/types/bill.types';
import type { ISODateString } from '@/shared/types/common.types';
import { useBillStore } from '@/app/stores/bill.store';
import { useCurrentUser } from '@/app/stores/session.store';

const TITLE = 'Mark as Paid';
const LABEL_AMOUNT = 'Amount Paid';
const LABEL_DATE = 'Payment Date';
const LABEL_NOTES = 'Notes (optional)';
const BTN_CONFIRM = 'Confirm Payment';
const BTN_CANCEL = 'Cancel';

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

type QuickPaySheetProps = {
  entry: EnrichedBillEntry;
  onClose: () => void;
};

export function QuickPaySheet({ entry, onClose }: QuickPaySheetProps) {
  const currentUser = useCurrentUser();
  const payEntry = useBillStore((s) => s.payEntry);
  const isLoading = useBillStore((s) => s.isLoading);

  const today = format(new Date(), "yyyy-MM-dd'T'00:00:00.000'Z'") as ISODateString;

  const [amount, setAmount] = useState<string>(entry.bill.amount.toFixed(2));
  const [payDate, setPayDate] = useState<string>(today);
  const [notes, setNotes] = useState('');
  const [amountError, setAmountError] = useState('');

  const sheetRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus first input when sheet opens
  useEffect(() => {
    const id = setTimeout(() => { firstInputRef.current?.focus(); }, 50);
    return () => { clearTimeout(id); };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => { window.removeEventListener('keydown', handler); };
  }, [onClose]);

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const validate = (): boolean => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      setAmountError('Please enter a valid amount greater than 0.');
      return false;
    }
    setAmountError('');
    return true;
  };

  const handleConfirm = async () => {
    if (!validate() || !currentUser) return;
    await payEntry(
      {
        entryId: entry.id,
        paidAmount: parseFloat(amount),
        paidDate: payDate as ISODateString,
        notes: notes.trim() || undefined,
      },
      entry,
      currentUser.id
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={TITLE}
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-card border-t border-border shadow-xl p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto lg:max-w-md lg:mx-auto lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:rounded-2xl lg:border"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl" role="img" aria-label={entry.bill.name}>
              {entry.bill.emoji || '💳'}
            </span>
            <div>
              <h2 className="font-semibold text-foreground">{TITLE}</h2>
              <p className="text-sm text-muted-foreground">{entry.bill.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label={BTN_CANCEL}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Default amount hint */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
          <CheckCircle2 size={14} className="text-primary flex-shrink-0" aria-hidden="true" />
          <span className="text-xs text-primary">
            Expected: {formatAmount(entry.bill.amount, entry.bill.currency)}
          </span>
        </div>

        {/* Amount field */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="qp-amount" className="text-sm font-medium text-foreground">
            {LABEL_AMOUNT}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
              {entry.bill.currency}
            </span>
            <input
              ref={firstInputRef}
              id="qp-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setAmountError(''); }}
              className={[
                'w-full pl-12 pr-3 py-2.5 rounded-lg border bg-background text-sm',
                'focus:outline-none focus:ring-2 focus:ring-ring',
                amountError ? 'border-destructive' : 'border-input',
              ].join(' ')}
              aria-describedby={amountError ? 'qp-amount-error' : undefined}
            />
          </div>
          {amountError && (
            <p id="qp-amount-error" role="alert" className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle size={12} aria-hidden="true" />
              {amountError}
            </p>
          )}
        </div>

        {/* Date field */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="qp-date" className="text-sm font-medium text-foreground">
            {LABEL_DATE}
          </label>
          <input
            id="qp-date"
            type="date"
            value={payDate.slice(0, 10)}
            onChange={(e) => { setPayDate(`${e.target.value}T00:00:00.000Z` as ISODateString); }}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="qp-notes" className="text-sm font-medium text-foreground">
            {LABEL_NOTES}
          </label>
          <input
            id="qp-notes"
            type="text"
            value={notes}
            onChange={(e) => { setNotes(e.target.value); }}
            placeholder="e.g. Online banking, autopay…"
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => { void handleConfirm(); }}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 transition-opacity"
          >
            {isLoading ? (
              <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 size={16} aria-hidden="true" />
            )}
            {BTN_CONFIRM}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {BTN_CANCEL}
          </button>
        </div>
      </div>
    </>
  );
}
