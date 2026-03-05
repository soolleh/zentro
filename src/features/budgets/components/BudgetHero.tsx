import { differenceInDays, parseISO } from 'date-fns';
import type { BudgetCycleUtilization } from '@/shared/types/budget.types';
import { formatCurrency } from '@/shared/utils/currency.utils';

type BudgetHeroProps = {
  readonly cycleUtilization: BudgetCycleUtilization;
};

function getBarColor(percent: number): string {
  if (percent >= 100) return 'bg-destructive';
  if (percent >= 90) return 'bg-amber-500';
  if (percent >= 70) return 'bg-[hsl(var(--chart-3))]';
  return 'bg-primary';
}

export function BudgetHero({ cycleUtilization }: BudgetHeroProps) {
  const {
    totalAllocated,
    totalSpent,
    totalRemaining,
    overallUtilization,
    budgets,
    currency,
    cycleEnd,
  } = cycleUtilization;

  const isOverspent = totalSpent > totalAllocated;
  const barColor = getBarColor(overallUtilization);
  const barWidth = `${String(Math.min(overallUtilization, 100))}%`;

  // Projected velocity extension
  const avgProjectedPct = budgets.length > 0
    ? budgets.reduce((s, eb) => s + eb.velocity.projectedPercentUsed, 0) / budgets.length
    : 0;
  const projectedOverage = avgProjectedPct > 100
    ? Math.min(avgProjectedPct - overallUtilization, 100 - Math.min(overallUtilization, 100))
    : 0;

  // Days remaining in cycle
  const today = new Date();
  const cycleEndDate = parseISO(cycleEnd);
  const daysRemaining = Math.max(0, differenceInDays(cycleEndDate, today) + 1);

  const overBudgetCount = budgets.filter((b) => b.isOverBudget).length;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 mb-5">
      <div className="flex flex-col gap-4">
        {/* Top row */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Budget
            </p>
            <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground mt-1">
              {formatCurrency(totalAllocated, currency)}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-sm text-muted-foreground">Spent</span>
              <span className="text-sm font-semibold text-foreground">
                {formatCurrency(totalSpent, currency)}
              </span>
              <span className="text-sm text-muted-foreground">of</span>
              <span className="text-sm font-semibold text-foreground">
                {formatCurrency(totalAllocated, currency)}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span
              className={`text-lg font-bold tabular-nums ${isOverspent ? 'text-destructive' : 'text-[hsl(var(--chart-4))]'}`}
            >
              {formatCurrency(Math.abs(totalRemaining), currency)}
            </span>
            <span className="text-xs text-muted-foreground">
              {isOverspent ? 'over budget' : 'remaining'}
            </span>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="w-full h-3 rounded-full bg-muted overflow-hidden relative">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
            style={{ width: barWidth }}
          />
          {projectedOverage > 0 && (
            <div
              className={`absolute top-0 h-full rounded-r-full opacity-40 ${barColor}`}
              style={{
                left: barWidth,
                width: `${String(projectedOverage)}%`,
              }}
            />
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Budgets active</span>
            <span className="text-sm font-semibold text-foreground">
              {String(budgets.length)} {budgets.length === 1 ? 'category' : 'categories'}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Over budget</span>
            <span className={`text-sm font-semibold ${overBudgetCount > 0 ? 'text-destructive' : 'text-foreground'}`}>
              {String(overBudgetCount)} {overBudgetCount === 1 ? 'category' : 'categories'}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Days remaining</span>
            <span className="text-sm font-semibold text-foreground">
              {String(daysRemaining)} {daysRemaining === 1 ? 'day' : 'days'} left
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
