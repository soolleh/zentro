/**
 * BudgetUtilizationCard.tsx
 *
 * Dashboard widget — budget utilization progress bars.
 */

import { Link } from 'react-router-dom';
import { PiggyBank } from 'lucide-react';
import { DashboardCard } from './DashboardCard';
import { useBudgetUtilization } from '@/app/stores/dashboard.store';
import { formatCurrency } from '@/shared/utils/currency.utils';
import type { BudgetUtilizationSummary } from '@/shared/types/dashboard.types';

const MAX_VISIBLE = 5;

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function BudgetSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="h-8 w-full rounded-xl animate-pulse bg-muted" />
      <div className="h-8 w-full rounded-xl animate-pulse bg-muted" />
      <div className="h-8 w-full rounded-xl animate-pulse bg-muted" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single budget row
// ---------------------------------------------------------------------------

function BudgetRow({ b }: { b: BudgetUtilizationSummary }) {
  const pct = b.percentUsed;
  const currency = b.budget.currency;
  const threshold = b.budget.alertThreshold;

  const barColor =
    b.isOverBudget
      ? 'bg-destructive'
      : pct >= threshold - 10 && pct >= threshold
        ? 'bg-[hsl(var(--chart-3))]'
        : 'bg-primary';

  const pctColor =
    b.isOverBudget
      ? 'text-destructive'
      : pct >= threshold
        ? 'text-[hsl(var(--chart-3))]'
        : 'text-foreground';

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: b.category.color }}
            aria-hidden
          />
          <span className="text-xs font-medium text-foreground truncate max-w-[120px]">
            {b.category.name}
          </span>
          {b.isOverBudget && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
              Over
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs tabular-nums text-muted-foreground">
            {formatCurrency(b.spent, currency)} of {formatCurrency(b.budget.amount, currency)}
          </span>
          <span className={`text-xs font-semibold ${pctColor}`}>
            {Math.round(pct)}%
          </span>
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
          style={{ width: `${String(Math.min(pct, 100))}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BudgetUtilizationCard() {
  const { budgetUtilization } = useBudgetUtilization();

  const visible = budgetUtilization.slice(0, MAX_VISIBLE);
  const remaining = budgetUtilization.length - MAX_VISIBLE;

  const skeleton = <BudgetSkeleton />;

  return (
    <DashboardCard
      title="Budgets"
      subtitle={`${String(budgetUtilization.length)} active`}
      action={{ label: 'Manage', href: '/budgets' }}
      skeleton={skeleton}
    >
      {budgetUtilization.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-4">
          <PiggyBank className="w-8 h-8 text-muted-foreground/30" aria-hidden />
          <p className="text-xs text-muted-foreground">No budgets set</p>
          <Link
            to="/budgets"
            className="text-xs text-primary cursor-pointer hover:underline underline-offset-4"
          >
            Set up budgets
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((b) => (
            <BudgetRow key={b.budget.id} b={b} />
          ))}
          {remaining > 0 && (
            <Link
              to="/budgets"
              className="text-xs text-primary font-medium text-center cursor-pointer hover:underline underline-offset-4 pt-1"
            >
              {remaining} more budget{remaining > 1 ? 's' : ''} — View all
            </Link>
          )}
        </div>
      )}
    </DashboardCard>
  );
}
