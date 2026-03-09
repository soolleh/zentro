/**
 * YearlyOverviewReport.tsx
 *
 * Report 2 — Yearly income vs expenses bar chart with year selector.
 */

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { ReportSectionHeader } from './ReportSectionHeader';
import { useYearlyOverview } from '@/app/stores/reports.store';
import { useBaseCurrency } from '@/app/preferences.store';
import { formatCurrency } from '@/shared/utils/currency.utils';
import type { TooltipContentProps } from 'recharts';

// ---------------------------------------------------------------------------
// Y axis number abbreviation
// ---------------------------------------------------------------------------

function abbreviate(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(Math.round(value));
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

type TooltipPayloadItem = {
  name: string;
  value: number;
  color: string;
};

function YearlyChartTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  if (!active || !payload.length) return null;

  const items = payload as unknown as TooltipPayloadItem[];
  const income = items.find((p) => p.name === 'income')?.value ?? 0;
  const expenses = items.find((p) => p.name === 'expenses')?.value ?? 0;
  const net = income - expenses;

  return (
    <div className="bg-card border border-border rounded-xl shadow-md px-4 py-3 min-w-[160px]">
      <p className="text-xs font-semibold text-foreground mb-2">{String(label)}</p>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full bg-[hsl(var(--chart-4))] shrink-0" />
        <span className="text-xs text-muted-foreground">Income:</span>
        <span className="text-xs font-medium text-foreground ml-auto tabular-nums">
          {income.toLocaleString()}
        </span>
      </div>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full bg-destructive shrink-0" />
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
          {net.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom Legend
// ---------------------------------------------------------------------------

function YearlyLegend() {
  return (
    <div className="flex items-center justify-center gap-6 mt-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="w-3 h-3 rounded-sm bg-[hsl(var(--chart-4))]" />
        Income
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="w-3 h-3 rounded-sm bg-destructive" />
        Expenses
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

type StatCardProps = {
  label: string;
  value: number;
  currency: string;
  color: string;
};

function StatCard({ label, value, currency, color }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xl font-bold tabular-nums ${color}`}>
        {formatCurrency(value, currency)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function YearlyOverviewReport() {
  const { yearlyOverview, selectedYear, isYearlyLoading, setSelectedYear } = useYearlyOverview();
  const { baseCurrency } = useBaseCurrency();
  const currentYear = new Date().getFullYear();

  const chartData = yearlyOverview
    ? yearlyOverview.months.map((m, idx) => ({
      monthLabel: MONTH_LABELS[idx] ?? String(idx + 1),
      income: m.income,
      expenses: m.expenses,
    }))
    : [];

  return (
    <div className="flex flex-col gap-4">
      <ReportSectionHeader
        title="Yearly Overview"
        right={
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="p-1 rounded-lg hover:bg-muted/60 transition-colors duration-100 disabled:opacity-40"
              onClick={() => { setSelectedYear(selectedYear - 1); }}
              aria-label="Previous year"
            >
              <ChevronLeft className="w-4 h-4 text-foreground" />
            </button>
            <span className="text-sm font-semibold text-foreground w-12 text-center tabular-nums">
              {selectedYear}
            </span>
            <button
              type="button"
              className="p-1 rounded-lg hover:bg-muted/60 transition-colors duration-100 disabled:opacity-40"
              onClick={() => { setSelectedYear(selectedYear + 1); }}
              disabled={selectedYear >= currentYear}
              aria-label="Next year"
            >
              <ChevronRight className="w-4 h-4 text-foreground" />
            </button>
          </div>
        }
      />

      {/* Summary cards */}
      {yearlyOverview && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Total Income"
            value={yearlyOverview.totalIncome}
            currency={baseCurrency}
            color="text-[hsl(var(--chart-4))]"
          />
          <StatCard
            label="Total Expenses"
            value={yearlyOverview.totalExpenses}
            currency={baseCurrency}
            color="text-destructive"
          />
          <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Net Savings</span>
            <span
              className={`text-xl font-bold tabular-nums ${yearlyOverview.totalSavings >= 0
                ? 'text-[hsl(var(--chart-4))]'
                : 'text-destructive'
                }`}
            >
              {formatCurrency(yearlyOverview.totalSavings, baseCurrency)}
            </span>
            <span className="text-xs text-muted-foreground">
              Avg rate: {yearlyOverview.averageSavingsRate.toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      {/* Bar chart */}
      <div className="rounded-2xl border border-border bg-card px-5 pt-5 pb-4">
        {isYearlyLoading ? (
          <div className="flex items-center justify-center h-[240px] gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Computing yearly data…</span>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} barCategoryGap="30%">
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  opacity={0.5}
                />
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={abbreviate}
                  width={40}
                />
                <Tooltip<number, string> content={YearlyChartTooltip} />
                <Bar
                  dataKey="income"
                  fill="hsl(var(--chart-4))"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                />
                <Bar
                  dataKey="expenses"
                  fill="hsl(var(--destructive))"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
            <YearlyLegend />
          </>
        )}
      </div>
    </div>
  );
}
