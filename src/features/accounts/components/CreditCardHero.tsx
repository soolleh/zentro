/**
 * CreditCardHero.tsx
 *
 * Credit card specific balance hero section for account detail.
 * Shows outstanding balance, credit limit, utilization bar, and payment info.
 */

import { Calendar, AlertCircle } from 'lucide-react';
import type { Account } from '@/shared/types/account.types';
import { formatCurrency, formatPercent } from '@/shared/utils/currency.utils';

const LABELS = {
  OUTSTANDING: 'Outstanding',
  CREDIT_LIMIT: 'Credit limit',
  AVAILABLE: 'Available credit',
  UTILIZATION: 'Utilization',
  MIN_PAYMENT: 'Min. payment',
  PAYMENT_DUE: 'Payment due:',
  OVERDUE: 'Payment overdue',
} as const;

function utilizationColor(ratio: number): string {
  if (ratio >= 0.8) return 'text-destructive';
  if (ratio >= 0.5) return 'text-[hsl(var(--chart-3))]';
  return 'text-[hsl(var(--chart-4))]';
}

function utilizationBarColor(ratio: number): string {
  if (ratio >= 0.8) return 'bg-destructive';
  if (ratio >= 0.5) return 'bg-[hsl(var(--chart-3))]';
  return 'bg-[hsl(var(--chart-4))]';
}

type CreditCardHeroProps = {
  readonly account: Account;
  readonly currentBalance: number;
};

export function CreditCardHero({ account, currentBalance }: CreditCardHeroProps) {
  const currency = account.currency;
  const creditLimit = account.creditLimit ?? 0;
  const available = Math.max(0, creditLimit - currentBalance);
  const utilization = creditLimit > 0 ? currentBalance / creditLimit : 0;
  const utilizationPct = Math.min(1, Math.max(0, utilization));
  const minPayment = account.minimumPaymentDue ?? null;
  const paymentDueDate = account.paymentDueDate ?? null;

  const isOverdue =
    paymentDueDate !== null &&
    paymentDueDate < (new Date().toISOString().slice(0, 10) as typeof paymentDueDate);

  return (
    <div className="px-6 py-5 border-b border-border flex flex-col gap-4">
      {/* Balance + limit row */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-2xl font-bold tabular-nums tracking-tight text-destructive">
            {formatCurrency(currentBalance, currency)}
          </span>
          <span className="text-xs text-muted-foreground">{LABELS.OUTSTANDING}</span>
        </div>
        {creditLimit > 0 && (
          <div className="flex flex-col gap-0.5 text-right">
            <span className="text-base font-semibold text-muted-foreground tabular-nums">
              {formatCurrency(creditLimit, currency)}
            </span>
            <span className="text-xs text-muted-foreground">{LABELS.CREDIT_LIMIT}</span>
          </div>
        )}
      </div>

      {/* Utilization bar */}
      {creditLimit > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${utilizationBarColor(utilizationPct)}`}
              style={{ width: `${(utilizationPct * 100).toFixed(1)}%` }}
            />
          </div>

          {/* Stats row */}
          <div className="flex justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">{LABELS.AVAILABLE}</span>
              <span className="text-sm font-semibold text-[hsl(var(--chart-4))]">
                {formatCurrency(available, currency)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 text-center">
              <span className="text-xs text-muted-foreground">{LABELS.UTILIZATION}</span>
              <span className={`text-sm font-semibold ${utilizationColor(utilizationPct)}`}>
                {formatPercent(utilizationPct, 1)}
              </span>
            </div>
            {minPayment !== null && (
              <div className="flex flex-col gap-0.5 text-right">
                <span className="text-xs text-muted-foreground">{LABELS.MIN_PAYMENT}</span>
                <span className="text-sm font-semibold text-foreground">
                  {formatCurrency(minPayment, currency)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment due date */}
      {paymentDueDate && (
        <div
          className={`flex items-center gap-2 rounded-lg px-3 py-2 ${isOverdue
              ? 'bg-destructive/5 border border-destructive/20'
              : 'bg-muted/40'
            }`}
        >
          {isOverdue ? (
            <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
          ) : (
            <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          )}
          <span
            className={`text-xs ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}
          >
            {isOverdue ? LABELS.OVERDUE : `${LABELS.PAYMENT_DUE} ${paymentDueDate}`}
          </span>
        </div>
      )}
    </div>
  );
}
