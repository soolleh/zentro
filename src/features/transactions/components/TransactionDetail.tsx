import { useState, useEffect } from 'react';
import { Pencil, Trash2, X, AlertTriangle } from 'lucide-react';
import type { Transaction } from '@/shared/types/transaction.types';
import type { Category } from '@/shared/types/category.types';
import type { Account } from '@/shared/types/account.types';
import { format, parseISO } from 'date-fns';
import { useDateFormat } from '@/app/preferences.store';
import { useDerivedKey } from '@/app/stores/session.store';
import { recurringRuleStorage } from '@/services/storage/recurring-rule.storage';
import type { RecurringRule } from '@/shared/types/transaction.types';

import { transactionStorage } from '@/services/storage/transaction.storage';
import { useTransactionStore } from '@/app/stores/transaction.store';
import { useUIStore } from '@/app/ui.store';

type TransactionDetailProps = {
  transaction: Transaction;
  category?: Category;
  account?: Account;
  onClose: () => void;
  onEdit: () => void;
};

const TYPE_BADGE_CLASSES: Record<string, string> = {
  Income: 'bg-[hsl(var(--chart-4)/0.12)] text-[hsl(var(--chart-4))]',
  Expense: 'bg-muted text-muted-foreground',
  Transfer: 'bg-[hsl(var(--chart-2)/0.12)] text-[hsl(var(--chart-2))]',
};

const AMOUNT_COLOR: Record<string, string> = {
  Income: 'text-[hsl(var(--chart-4))]',
  Expense: 'text-foreground',
  Transfer: 'text-muted-foreground',
};

function formatDateByPref(dateStr: string, pref: string): string {
  try {
    const date = parseISO(dateStr);
    switch (pref) {
      case 'MM/DD/YYYY': return format(date, 'MM/dd/yyyy');
      case 'YYYY-MM-DD': return format(date, 'yyyy-MM-dd');
      default: return format(date, 'dd/MM/yyyy');
    }
  } catch {
    return dateStr.slice(0, 10);
  }
}

type DetailRowProps = { label: string; value: React.ReactNode };
function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function ConfirmDeleteDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-card rounded-2xl shadow-xl p-6 max-w-sm w-full flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
          <h3 className="text-base font-semibold text-foreground">Delete Transaction</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete this transaction? This action cannot be undone.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-10 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 h-10 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export function TransactionDetail({
  transaction,
  category,
  account,
  onClose,
  onEdit,
}: TransactionDetailProps) {
  const [recurringRule, setRecurringRule] = useState<RecurringRule | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const derivedKey = useDerivedKey();
  const { dateFormat } = useDateFormat();
  const removeTransactionFromList = useTransactionStore((s) => s.removeTransactionFromList);
  const addToast = useUIStore((s) => s.addToast);

  useEffect(() => {
    if (transaction.recurringRuleId && derivedKey) {
      void recurringRuleStorage
        .getRuleById(transaction.recurringRuleId, derivedKey)
        .then((r) => {
          if (r.success && r.data) setRecurringRule(r.data);
        });
    }
  }, [transaction.recurringRuleId, derivedKey]);

  useEffect(() => {
    if (transaction.receiptBlob) {
      const blob = new Blob([transaction.receiptBlob]);
      const url = URL.createObjectURL(blob);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReceiptUrl(url);
      return () => { URL.revokeObjectURL(url); };
    }
    return undefined;
  }, [transaction.receiptBlob]);

  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await transactionStorage.deleteTransaction(transaction.id);
    setIsDeleting(false);
    if (result.success) {
      removeTransactionFromList(transaction.id);
      addToast({ type: 'success', message: 'Transaction deleted.' });
      onClose();
    } else {
      addToast({ type: 'error', message: 'Failed to delete transaction.' });
    }
  };

  const frequencyLabel = recurringRule
    ? `Yes — ${recurringRule.frequency}`
    : 'No';

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide ${TYPE_BADGE_CLASSES[transaction.type] ?? ''}`}
        >
          {transaction.type}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-150"
            aria-label="Edit transaction"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => { setShowDeleteConfirm(true); }}
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted/50 transition-colors duration-150"
            aria-label="Delete transaction"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-150"
            aria-label="Close panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6 flex flex-col gap-6">
        {/* Amount block */}
        <div className="flex flex-col items-center gap-1 py-4">
          <span className={`text-4xl font-bold tabular-nums ${AMOUNT_COLOR[transaction.type] ?? ''}`}>
            {transaction.type === 'Income' && '+'}
            {transaction.type === 'Transfer' && '→'}
            ${transaction.amount.toFixed(2)}
          </span>
          <span className="text-sm text-muted-foreground">
            {transaction.currency} · {formatDateByPref(transaction.date, dateFormat)}
          </span>
        </div>

        {/* Detail rows */}
        <div>
          <DetailRow
            label="Account"
            value={
              <span className="flex items-center gap-1.5">
                {account?.name ?? 'Unknown'}
                <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                  {account?.type ?? ''}
                </span>
              </span>
            }
          />
          <DetailRow
            label="Category"
            value={
              category ? (
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  {category.name}
                </span>
              ) : (
                'Uncategorized'
              )
            }
          />
          <DetailRow
            label="Date"
            value={formatDateByPref(transaction.date, dateFormat)}
          />
          <DetailRow label="Type" value={transaction.type} />
          <DetailRow label="Recurring" value={frequencyLabel} />
          {transaction.isReconciled && (
            <DetailRow label="Status" value="Reconciled" />
          )}
          {transaction.notes && (
            <div className="py-3 border-b border-border/50">
              <div className="text-sm text-muted-foreground mb-1">Notes</div>
              <div className="text-sm font-medium text-foreground whitespace-pre-wrap">
                {transaction.notes}
              </div>
            </div>
          )}
        </div>

        {/* Receipt section */}
        {receiptUrl && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">Receipt</span>
            <div className="w-full rounded-xl border border-border overflow-hidden max-h-64">
              <img
                src={receiptUrl}
                alt="Receipt"
                className="w-full max-h-64 object-cover"
              />
            </div>
            <a
              href={receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              View full size
            </a>
          </div>
        )}

        {/* Recurring series actions */}
        {transaction.recurringRuleId && (
          <div className="rounded-xl border border-border bg-muted/30 p-4 flex flex-col gap-3">
            <div>
              <div className="text-sm font-medium text-foreground">Recurring transaction</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {recurringRule ? `Repeats ${recurringRule.frequency.toLowerCase()}` : 'Loading…'}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onEdit}
                className="flex-1 h-9 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
              >
                Edit series
              </button>
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(true); }}
                className="flex-1 h-9 rounded-lg border border-destructive/50 text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors"
              >
                Delete series
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <ConfirmDeleteDialog
          onConfirm={() => {
            setShowDeleteConfirm(false);
            void handleDelete();
          }}
          onCancel={() => { setShowDeleteConfirm(false); }}
        />
      )}

      {/* Loading overlay for delete */}
      {isDeleting && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/70 z-10">
          <div className="text-sm text-muted-foreground">Deleting…</div>
        </div>
      )}
    </>
  );
}
