import { useNavigate } from 'react-router-dom';
import { X, Loader2, ExternalLink } from 'lucide-react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { SlidePanel } from '@/shared/components/SlidePanel';
import type { CategoryDrillDown } from '@/shared/types/budget.types';
import { formatCurrency } from '@/shared/utils/currency.utils';
import { useDrillDown } from '@/app/stores/budget.store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM d');
  } catch {
    return iso;
  }
}

function formatCycleMonthYear(iso: string): string {
  try {
    return format(parseISO(iso), 'MMMM yyyy');
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type CategoryDrillDownPanelProps = {
  readonly currency: string;
  readonly cycleLabel: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function CategoryDrillDownPanel({ currency, cycleLabel }: CategoryDrillDownPanelProps) {
  const { drillDownData, isDrillDownLoading, isDrillDownOpen, closeDrillDown } = useDrillDown();
  const navigate = useNavigate();

  return (
    <SlidePanel
      open={isDrillDownOpen}
      onClose={closeDrillDown}
      size="lg"
    >
      {/* Panel header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
        <div className="flex items-center gap-2 min-w-0">
          {drillDownData && (
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: drillDownData.category.color }}
            />
          )}
          <span className="text-base font-semibold text-foreground truncate">
            {drillDownData?.category.name ?? 'Category'}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">{cycleLabel}</span>
        </div>
        <button
          type="button"
          onClick={closeDrillDown}
          className="shrink-0 p-1 rounded-lg hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Loading state */}
      {isDrillDownLoading && (
        <div className="flex items-center justify-center py-16 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading category data…</span>
        </div>
      )}

      {/* Content */}
      {!isDrillDownLoading && drillDownData && (
        <DrillDownContent
          data={drillDownData}
          currency={currency}
          onViewAll={() => {
            void navigate(`/transactions?categoryId=${drillDownData.category.id}`);
            closeDrillDown();
          }}
        />
      )}

      {/* Empty state */}
      {!isDrillDownLoading && !drillDownData && !isDrillDownOpen && null}
    </SlidePanel>
  );
}

// ---------------------------------------------------------------------------
// Drill-down content
// ---------------------------------------------------------------------------
type DrillDownContentProps = {
  readonly data: CategoryDrillDown;
  readonly currency: string;
  readonly onViewAll: () => void;
};

function DrillDownContent({ data, currency, onViewAll }: DrillDownContentProps) {
  const { currentCycle, historicalTrend, transactions, topMerchants } = data;
  const color = data.category.color;

  const expenseTx = transactions.filter((t) => t.type === 'Expense');
  const largestTx = expenseTx.reduce<{ amount: number; date: string } | null>(
    (max, t) => (max === null || t.amount > max.amount ? { amount: t.amount, date: t.date } : max),
    null
  );

  const oldestPoint = historicalTrend.length > 0 ? historicalTrend[0].cycleStart : null;
  const newestPoint = historicalTrend.length > 0 ? historicalTrend[historicalTrend.length - 1].cycleStart : null;

  return (
    <div className="flex flex-col gap-6 px-6 py-6">
      {/* Section 1 — Current cycle summary */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-muted/30 p-3 flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Budgeted</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {formatCurrency(currentCycle.effectiveAmount, currency)}
            </span>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3 flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Spent</span>
            <span className={`text-sm font-semibold tabular-nums ${currentCycle.isOverBudget ? 'text-destructive' : 'text-foreground'}`}>
              {formatCurrency(currentCycle.spent, currency)}
            </span>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3 flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Remaining</span>
            <span className={`text-sm font-semibold tabular-nums ${currentCycle.remaining >= 0 ? 'text-[hsl(var(--chart-4))]' : 'text-destructive'}`}>
              {formatCurrency(currentCycle.remaining, currency)}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${currentCycle.isOverBudget ? 'bg-destructive' : currentCycle.percentUsed >= 90 ? 'bg-amber-500' : 'bg-primary'}`}
            style={{ width: `${String(Math.min(currentCycle.percentUsed, 100))}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {currentCycle.percentUsed.toFixed(0)}% of budget used
        </span>
      </div>

      {/* Section 2 — 6-cycle trend */}
      {historicalTrend.length > 1 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            6-month history
          </p>
          <div style={{ height: 100 }}>
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={historicalTrend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={`dd-gradient-${data.category.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="spent"
                  stroke={color}
                  strokeWidth={2}
                  fill={`url(#dd-gradient-${data.category.id})`}
                  dot={{ r: 3, fill: color, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {oldestPoint !== null && newestPoint !== null && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatCycleMonthYear(oldestPoint)}</span>
              <span>{formatCycleMonthYear(newestPoint)}</span>
            </div>
          )}
        </div>
      )}

      {/* Section 3 — Spending stats */}
      <div className="rounded-xl bg-muted/40 border border-border overflow-hidden">
        <StatRow
          label="Average transaction"
          value={formatCurrency(data.averageTransactionAmount, currency)}
        />
        <StatRow
          label="Transaction frequency"
          value={`${data.transactionFrequency.toFixed(1)} per week`}
        />
        <StatRow
          label="Total transactions this cycle"
          value={`${String(expenseTx.length)} transactions`}
        />
        {largestTx !== null && (
          <StatRow
            label="Largest transaction"
            value={`${formatCurrency(largestTx.amount, currency)} · ${formatDate(largestTx.date)}`}
            last
          />
        )}
      </div>

      {/* Section 4 — Top merchants */}
      {topMerchants.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Where you spend
          </p>
          <div className="flex flex-col">
            {topMerchants.map((merchant, idx) => (
              <div
                key={merchant.name}
                className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0"
              >
                <span className="text-xs text-muted-foreground w-4 shrink-0">{String(idx + 1)}.</span>
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {merchant.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm font-medium text-foreground flex-1 truncate">
                  {merchant.name}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {String(merchant.transactionCount)} transactions
                </span>
                <span className="text-sm font-semibold tabular-nums text-foreground shrink-0">
                  {formatCurrency(merchant.totalSpent, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {topMerchants.length === 0 && (
        <p className="text-xs text-muted-foreground">No transactions yet</p>
      )}

      {/* Section 5 — Transactions list */}
      {expenseTx.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            This cycle · {String(expenseTx.length)} transactions
          </p>
          <div className="max-h-[300px] overflow-y-auto flex flex-col divide-y divide-border/50">
            {expenseTx.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2.5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">
                    {tx.notes ?? data.category.name}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(tx.date)}</span>
                </div>
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrency(tx.amount, currency)}
                </span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={onViewAll}
            className="mt-2 flex items-center gap-1 text-xs text-primary font-medium hover:underline cursor-pointer"
          >
            <ExternalLink className="w-3 h-3" />
            View all in transactions
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat row
// ---------------------------------------------------------------------------
type StatRowProps = {
  readonly label: string;
  readonly value: string;
  readonly last?: boolean;
};

function StatRow({ label, value, last = false }: StatRowProps) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 ${last ? '' : 'border-b border-border/50'}`}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
