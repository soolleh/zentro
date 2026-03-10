/**
 * IncomeTrendReport.tsx
 *
 * Report 4 — Income vs expense trend line chart over 12 months.
 */

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ReportSectionHeader } from './ReportSectionHeader';
import { useTrends, useReportFilters } from '@/app/stores/reports.store';
import { useBaseCurrency } from '@/app/preferences.store';
import { formatCurrency } from '@/shared/utils/currency.utils';
import type { TrendPoint } from '@/shared/types/reports.types';
import type { TooltipContentProps } from 'recharts';

// recharts' ValueType / NameType are not exported from the public API
type RVT = number | string | ReadonlyArray<number | string>;
type RNT = number | string;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function abbreviate(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(Math.round(value));
}

function formatMonthLabel(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM');
  } catch {
    return iso.substring(5, 7);
  }
}

function formatMonthFull(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM yyyy');
  } catch {
    return iso.substring(0, 7);
  }
}

// ---------------------------------------------------------------------------
// Build chart data by merging income + expense trend arrays
// ---------------------------------------------------------------------------

function buildChartData(
  incomeTrend: TrendPoint[],
  expenseTrend: TrendPoint[],
  compareEnabled: boolean
) {
  return incomeTrend.map((pt, i) => ({
    date: pt.date,
    label: formatMonthLabel(pt.date),
    income: pt.value,
    expenses: expenseTrend[i]?.value ?? 0,
    compareIncome: compareEnabled ? (pt.compareValue ?? 0) : undefined,
    compareExpenses: compareEnabled ? (expenseTrend[i]?.compareValue ?? 0) : undefined,
  }));
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

type ChartDataRow = {
  date?: string;
  income?: number;
  expenses?: number;
  compareIncome?: number;
  compareExpenses?: number;
};

function TrendTooltip({ active, payload }: TooltipContentProps<RVT, RNT>) {
  if (!active || !payload.length) return null;
  const item = payload[0] as { payload: ChartDataRow } | undefined;
  const row = item?.payload ?? {} as ChartDataRow;
  const income = row.income ?? 0;
  const expenses = row.expenses ?? 0;
  const net = income - expenses;
  const date = row.date ? formatMonthFull(row.date) : '';

  return (
    <div className="bg-card border border-border rounded-xl shadow-md px-4 py-3 min-w-[160px]">
      <p className="text-xs font-semibold text-foreground mb-2">{date}</p>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-4 h-0.5 rounded bg-[hsl(var(--chart-4))] shrink-0" />
        <span className="text-xs text-muted-foreground">Income:</span>
        <span className="text-xs font-medium text-foreground ml-auto tabular-nums">
          {income.toLocaleString()}
        </span>
      </div>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-4 h-0.5 rounded bg-destructive shrink-0" />
        <span className="text-xs text-muted-foreground">Expenses:</span>
        <span className="text-xs font-medium text-foreground ml-auto tabular-nums">
          {expenses.toLocaleString()}
        </span>
      </div>
      <div className="flex items-center gap-2 pt-1 border-t border-border">
        <span className="text-xs text-muted-foreground">Net:</span>
        <span
          className={`text-xs font-semibold ml-auto tabular-nums ${net >= 0 ? 'text-[hsl(var(--chart-4))]' : 'text-destructive'
            }`}
        >
          {net >= 0 ? '+' : ''}{net.toLocaleString()}
        </span>
      </div>
      {row.compareIncome !== undefined && (
        <div className="pt-1 mt-1 border-t border-border">
          <p className="text-xs text-muted-foreground mb-1">Previous period:</p>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground">Income:</span>
            <span className="text-xs tabular-nums text-muted-foreground ml-auto">
              {(row.compareIncome ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Expenses:</span>
            <span className="text-xs tabular-nums text-muted-foreground ml-auto">
              {(row.compareExpenses ?? 0).toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary callouts
// ---------------------------------------------------------------------------

type CalloutProps = {
  label: string;
  month: string;
  amount: number;
  currency: string;
};

function Callout({ label, month, amount, currency }: CalloutProps) {
  return (
    <div className="rounded-xl bg-muted/40 border border-border px-4 py-3 flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{month}</span>
      <span className="text-xs tabular-nums text-muted-foreground">{formatCurrency(amount, currency)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function IncomeTrendReport() {
  const { incomeTrend, expenseTrend } = useTrends();
  const { filters } = useReportFilters();
  const { baseCurrency } = useBaseCurrency();

  const chartData = buildChartData(incomeTrend, expenseTrend, filters.compareEnabled);

  // Summary callouts — use ternary to explicitly type as T | undefined so conditional rendering is valid
  const sortedByIncome = [...chartData].sort((a, b) => b.income - a.income);
  const sortedByExpense = [...chartData].sort((a, b) => b.expenses - a.expenses);
  const sortedBySavings = [...chartData].sort(
    (a, b) => b.income - b.expenses - (a.income - a.expenses)
  );
  const highestIncome = chartData.length > 0 ? sortedByIncome[0] : undefined;
  const highestExpense = chartData.length > 0 ? sortedByExpense[0] : undefined;
  const bestSavings = chartData.length > 0 ? sortedBySavings[0] : undefined;

  return (
    <div className="flex flex-col gap-4">
      <ReportSectionHeader title="Income vs Expenses" />

      <div className="rounded-2xl border border-border bg-card px-5 pt-5 pb-4">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.5}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={abbreviate}
              width={45}
            />
            <ReferenceLine
              y={0}
              stroke="hsl(var(--border))"
              strokeWidth={1}
            />
            <Tooltip content={TrendTooltip} />
            <Line
              type="monotone"
              dataKey="income"
              stroke="hsl(var(--chart-4))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: 'hsl(var(--chart-4))' }}
            />
            <Line
              type="monotone"
              dataKey="expenses"
              stroke="hsl(var(--destructive))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: 'hsl(var(--destructive))' }}
            />
            {filters.compareEnabled && (
              <Line
                type="monotone"
                dataKey="compareIncome"
                stroke="hsl(var(--chart-4))"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                dot={false}
              />
            )}
            {filters.compareEnabled && (
              <Line
                type="monotone"
                dataKey="compareExpenses"
                stroke="hsl(var(--destructive))"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                dot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>

        {/* Legend row */}
        <div className="flex items-center justify-center gap-6 mt-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-4 h-0.5 rounded bg-[hsl(var(--chart-4))]" />
            Income
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-4 h-0.5 rounded bg-destructive" />
            Expenses
          </div>
          {filters.compareEnabled && (
            <>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className="w-4 h-0.5 rounded bg-[hsl(var(--chart-4))] opacity-50"
                  style={{ background: `repeating-linear-gradient(90deg, hsl(var(--chart-4)) 0, hsl(var(--chart-4)) 4px, transparent 4px, transparent 8px)` }}
                />
                Prior income
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className="w-4 h-0.5 rounded opacity-50"
                  style={{ background: `repeating-linear-gradient(90deg, hsl(var(--destructive)) 0, hsl(var(--destructive)) 4px, transparent 4px, transparent 8px)` }}
                />
                Prior expenses
              </div>
            </>
          )}
        </div>
      </div>

      {/* Callouts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {highestIncome && (
          <Callout
            label="Highest Income"
            month={formatMonthFull(highestIncome.date)}
            amount={highestIncome.income}
            currency={baseCurrency}
          />
        )}
        {highestExpense && (
          <Callout
            label="Highest Expenses"
            month={formatMonthFull(highestExpense.date)}
            amount={highestExpense.expenses}
            currency={baseCurrency}
          />
        )}
        {bestSavings && (
          <Callout
            label="Best Savings"
            month={formatMonthFull(bestSavings.date)}
            amount={bestSavings.income - bestSavings.expenses}
            currency={baseCurrency}
          />
        )}
      </div>
    </div>
  );
}
