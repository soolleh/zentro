/**
 * ReconcileTab.tsx
 *
 * Reconciliation workflow inside account detail.
 * Allows user to set a statement closing date and balance, then mark
 * all transactions up to that date as reconciled.
 */

import { useState, useEffect } from 'react';
import { Info, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import type { UUID, ISODateString } from '@/shared/types/common.types';
import type { Account } from '@/shared/types/account.types';
import { reconcileAccount, getReconciledCount } from '@/services/accounts/account.service';
import { useDerivedKey } from '@/app/stores/session.store';
import { useUIStore } from '@/app/ui.store';
import { DatePicker } from '@/features/transactions/components/DatePicker';
import { formatCurrency } from '@/shared/utils/currency.utils';
import { usePreferencesStore } from '@/app/preferences.store';

const LABELS = {
  WHAT_IS: 'What is reconciliation?',
  EXPLANATION:
    'Mark transactions as verified against your bank statement. Reconciled transactions are shown with a checkmark.',
  RECONCILE_TO: 'Reconcile up to date',
  STATEMENT_BALANCE: 'Statement closing balance',
  STATEMENT_DESC: 'Enter the balance from your statement.',
  BALANCED: 'Balanced — ready to reconcile',
  DIFFERENCE: 'Difference:',
  RECONCILE_BTN: 'Reconcile transactions',
  RECONCILING: 'Reconciling…',
  ALREADY_RECONCILED: 'transactions already reconciled for this account',
} as const;

type ReconcileTabProps = {
  readonly accountId: UUID;
  readonly account: Account;
  readonly currentBalance: number;
  readonly onReconcileComplete: () => void;
};

export function ReconcileTab({
  accountId,
  account,
  currentBalance,
  onReconcileComplete,
}: ReconcileTabProps) {
  const derivedKey = useDerivedKey();
  const addToast = useUIStore((s) => s.addToast);
  const dateFormat = usePreferencesStore((s) => s.dateFormat);

  const today = new Date().toISOString().slice(0, 10) as ISODateString;

  const [reconcileDate, setReconcileDate] = useState<ISODateString | null>(today);
  const [statementBalance, setStatementBalance] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reconciledCount, setReconciledCount] = useState(0);

  // Load reconciled count
  useEffect(() => {
    if (!derivedKey) return;
    void getReconciledCount(accountId, derivedKey).then((result) => {
      if (result.success) setReconciledCount(result.data);
    });
  }, [accountId, derivedKey]);

  const statementNum = parseFloat(statementBalance);
  const difference = isNaN(statementNum) ? null : currentBalance - statementNum;
  const isBalanced = difference !== null && Math.abs(difference) < 0.01;

  const handleReconcile = async () => {
    if (!reconcileDate || !derivedKey) return;
    setIsSubmitting(true);
    const result = await reconcileAccount(accountId, reconcileDate, derivedKey);
    setIsSubmitting(false);
    if (!result.success) {
      addToast({ type: 'error', message: result.error.message, duration: 4000 });
      return;
    }
    addToast({
      type: 'success',
      message: `Transactions reconciled up to ${reconcileDate}.`,
      duration: 3000,
    });
    // Refresh reconciled count
    void getReconciledCount(accountId, derivedKey).then((r) => {
      if (r.success) setReconciledCount(r.data);
    });
    onReconcileComplete();
  };

  return (
    <div className="px-6 py-5 flex flex-col gap-5">
      {/* Explainer */}
      <div className="rounded-xl bg-muted/40 border border-border p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">{LABELS.WHAT_IS}</span>
          <span className="text-xs text-muted-foreground">{LABELS.EXPLANATION}</span>
        </div>
      </div>

      {/* Form */}
      <div className="flex flex-col gap-4">
        {/* Date picker */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">{LABELS.RECONCILE_TO}</label>
          <DatePicker
            value={reconcileDate}
            onChange={setReconcileDate}
            dateFormat={dateFormat}
          />
        </div>

        {/* Statement balance */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="statement-balance">
            {LABELS.STATEMENT_BALANCE}
          </label>
          <p className="text-xs text-muted-foreground -mt-0.5">{LABELS.STATEMENT_DESC}</p>
          <div className="flex items-center h-10 rounded-lg border border-input bg-background overflow-hidden focus-within:ring-1 focus-within:ring-ring">
            <span className="px-3 text-sm font-medium text-muted-foreground border-r border-input bg-muted/30 h-full flex items-center">
              {account.currency}
            </span>
            <input
              id="statement-balance"
              type="number"
              step="0.01"
              value={statementBalance}
              onChange={(e) => { setStatementBalance(e.target.value); }}
              className="flex-1 h-full px-3 text-sm bg-transparent text-foreground focus:outline-none"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Difference row */}
        {difference !== null && (
          <div
            className={`flex items-center justify-between p-3 rounded-xl border ${isBalanced
                ? 'border-[hsl(var(--chart-4)/0.3)] bg-[hsl(var(--chart-4)/0.05)]'
                : 'border-destructive/30 bg-destructive/5'
              }`}
          >
            <div className="flex items-center gap-2">
              {isBalanced ? (
                <CheckCircle2 className="w-4 h-4 text-[hsl(var(--chart-4))]" />
              ) : (
                <AlertCircle className="w-4 h-4 text-destructive" />
              )}
              <span
                className={`text-sm font-medium ${isBalanced ? 'text-[hsl(var(--chart-4))]' : 'text-destructive'
                  }`}
              >
                {isBalanced
                  ? LABELS.BALANCED
                  : `${LABELS.DIFFERENCE} ${formatCurrency(Math.abs(difference), account.currency)}`}
              </span>
            </div>
          </div>
        )}

        {/* Reconcile button */}
        <button
          type="button"
          onClick={() => { void handleReconcile(); }}
          disabled={!reconcileDate || isSubmitting}
          className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-150 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {LABELS.RECONCILING}
            </>
          ) : (
            LABELS.RECONCILE_BTN
          )}
        </button>

        {/* Reconciled count */}
        <p className="text-xs text-muted-foreground text-center">
          {`${String(reconciledCount)} ${LABELS.ALREADY_RECONCILED}`}
        </p>
      </div>
    </div>
  );
}
