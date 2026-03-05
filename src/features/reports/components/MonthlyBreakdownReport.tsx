/**
 * MonthlyBreakdownReport.tsx
 *
 * Report 1 — Monthly income, expenses, savings breakdown with category drill-down.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ReportSectionHeader } from './ReportSectionHeader';
import { useMonthlyBreakdown, useReportFilters } from '@/app/stores/reports.store';
import { useBaseCurrency } from '@/app/preferences.store';
import { formatCurrency } from '@/shared/utils/currency.utils';
import type { MonthlyBreakdown } from '@/shared/types/reports.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMonth(isoDate: string): string {
  try {
    return format(parseISO(isoDate), 'MMM yyyy');
  } catch {
    return isoDate.substring(0, 7);
  }
}

function formatRate(rate: number): string {
  return `${rate.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function MonthlyBreakdownSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-2">
            <div className="h-3 w-20 rounded animate-pulse bg-muted" />
            <div className="h-6 w-28 rounded animate-pulse bg-muted" />
            <div className="h-3 w-16 rounded animate-pulse bg-muted" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 w-full animate-pulse bg-muted border-b border-border/50 last:border-0" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expanded row — category mini bars
// ---------------------------------------------------------------------------

type CategoryMiniBarProps = {
  name: string;
  color: string;
  amount: number;
  percentage: number;
  currency: string;
};

function CategoryMiniBar({ name, color, amount, percentage, currency }: CategoryMiniBarProps) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center gap-3">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-xs text-foreground w-24 truncate">{name}</span>
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${String(Math.min(percentage, 100))}%`, backgroundColor: color }}
          />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground w-20 text-right">
          {formatCurrency(amount, currency)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Month row
// ---------------------------------------------------------------------------

type MonthRowProps = {
  breakdown: MonthlyBreakdown;
  currency: string;
  compareEnabled: boolean;
  compareBreakdown?: MonthlyBreakdown;
};

function MonthRow({ breakdown, currency, compareEnabled, compareBreakdown }: MonthRowProps) {
  const [expanded, setExpanded] = useState(false);

  const savingsColor =
    breakdown.savings >= 0 ? 'text-[hsl(var(--chart-4))]' : 'text-destructive';

  const topCategories = breakdown.categoryBreakdown.slice(0, 5);

  return (
    <>
      <div
        className="grid grid-cols-3 sm:grid-cols-5 px-5 py-3.5 border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors duration-100 cursor-pointer"
        onClick={() => { setExpanded((p) => !p); }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { setExpanded((p) => !p); }
        }}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          )}
          {formatMonth(breakdown.month)}
        </div>
        <div className="text-sm tabular-nums text-[hsl(var(--chart-4))]">
          {formatCurrency(breakdown.income, currency)}
        </div>
        <div className="text-sm tabular-nums text-destructive">
          {formatCurrency(breakdown.expenses, currency)}
        </div>
        <div className={`text-sm tabular-nums font-medium hidden sm:block ${savingsColor}`}>
          {formatCurrency(breakdown.savings, currency)}
        </div>
        <div className={`text-sm tabular-nums font-medium hidden sm:block ${savingsColor}`}>
          {formatRate(breakdown.savingsRate)}
        </div>
      </div>

      {/* Expanded category breakdown */}
      {expanded && topCategories.length > 0 && (
        <div className="px-5 py-4 bg-muted/20 border-b border-border animate-in slide-in-from-top-1 duration-200">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Category Breakdown
          </p>
          {topCategories.map((cat) => (
            <CategoryMiniBar
              key={cat.categoryId}
              name={cat.categoryName}
              color={cat.categoryColor}
              amount={cat.amount}
              percentage={cat.percentage}
              currency={currency}
            />
          ))}
        </div>
      )}

      {/* Compare delta row */}
      {compareEnabled && compareBreakdown && (
        <div className="grid grid-cols-3 sm:grid-cols-5 px-5 py-1.5 border-b border-dashed border-border/30 bg-muted/10">
          <div className="text-xs text-muted-foreground col-span-1 flex items-center pl-5">
            vs prev
          </div>
          {[
            breakdown.income - compareBreakdown.income,
            breakdown.expenses - compareBreakdown.expenses,
            breakdown.savings - compareBreakdown.savings,
          ].map((delta, idx) => (
            <div
              key={idx}
              className={`text-xs tabular-nums ${delta >= 0 ? 'text-[hsl(var(--chart-4))]' : 'text-destructive'
                } ${idx >= 2 ? 'hidden sm:block' : ''}`}
            >
              {delta >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(delta), currency)}
            </div>
          ))}
          <div className="hidden sm:block" />
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Summary stat card
// ---------------------------------------------------------------------------

type StatCardProps = {
  label: string;
  value: number;
  avgValue: number;
  currency: string;
  color: string;
  avgLabel: string;
};

function StatCard({ label, value, avgValue, currency, color, avgLabel }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xl font-bold tabular-nums ${color}`}>
        {formatCurrency(value, currency)}
      </span>
      <span className="text-xs text-muted-foreground">
        {avgLabel}: {formatCurrency(avgValue, currency)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MonthlyBreakdownReport() {
  const { monthlyBreakdown, isLoading } = useMonthlyBreakdown();
  const { filters } = useReportFilters();
  const { baseCurrency } = useBaseCurrency();

  if (isLoading) return <MonthlyBreakdownSkeleton />;

  const totalIncome = monthlyBreakdown.reduce((s, m) => s + m.income, 0);
  const totalExpenses = monthlyBreakdown.reduce((s, m) => s + m.expenses, 0);
  const totalSavings = totalIncome - totalExpenses;
  const monthCount = monthlyBreakdown.length || 1;
  const avgSavingsRate =
    totalIncome > 0
      ? Math.max(-100, Math.min(100, (totalSavings / totalIncome) * 100))
      : 0;

  const savingsColor = totalSavings >= 0 ? 'text-[hsl(var(--chart-4))]' : 'text-destructive';

  return (
    <div className="flex flex-col gap-4">
      <ReportSectionHeader title="Monthly Breakdown" />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Total Income"
          value={totalIncome}
          avgValue={totalIncome / monthCount}
          currency={baseCurrency}
          color="text-[hsl(var(--chart-4))]"
          avgLabel="Avg/month"
        />
        <StatCard
          label="Total Expenses"
          value={totalExpenses}
          avgValue={totalExpenses / monthCount}
          currency={baseCurrency}
          color="text-destructive"
          avgLabel="Avg/month"
        />
        <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Net Savings</span>
          <span className={`text-xl font-bold tabular-nums ${savingsColor}`}>
            {formatCurrency(totalSavings, baseCurrency)}
          </span>
          <span className="text-xs text-muted-foreground">
            Avg rate: {avgSavingsRate.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Monthly table */}
      {monthlyBreakdown.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No transactions in the selected period.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-3 sm:grid-cols-5 px-5 py-2.5 bg-muted/40 border-b border-border">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Month
            </div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Income
            </div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Expenses
            </div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:block">
              Savings
            </div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:block">
              Rate
            </div>
          </div>

          {/* Table rows */}
          {monthlyBreakdown.map((month) => (
            <MonthRow
              key={month.month}
              breakdown={month}
              currency={baseCurrency}
              compareEnabled={filters.compareEnabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}
