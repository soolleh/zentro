/**
 * IncomeExpenseCard.tsx
 *
 * Dashboard widget — income vs expenses bar chart for the current month.
 */

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { DashboardCard } from './DashboardCard';
import { useDashboardSummary } from '@/app/stores/dashboard.store';
import { formatCurrency } from '@/shared/utils/currency.utils';

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

type BarPayload = { value?: number; payload?: Record<string, unknown> };
type BarTooltipProps = { active?: boolean; payload?: BarPayload[] };

function BarTooltip({ payload }: BarTooltipProps) {
  if (!payload?.length) return null;
  const entry = payload[0];
  const raw = entry.payload ?? {};
  const name = typeof raw.name === 'string' ? raw.name : '';
  return (
    <div className="bg-card border border-border rounded-lg px-2.5 py-1.5 shadow-md">
      <p className="text-xs text-muted-foreground">{name}</p>
      <p className="text-xs font-semibold text-foreground">
        {typeof entry.value === 'number' ? entry.value.toLocaleString() : '—'}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function IncomeExpenseSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="h-6 w-20 rounded animate-pulse bg-muted" />
        <div className="h-6 w-20 rounded animate-pulse bg-muted" />
      </div>
      <div className="h-[120px] w-full rounded-xl animate-pulse bg-muted mt-3" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export function IncomeExpenseCard() {
  const { summary, isLoading } = useDashboardSummary();

  const current = summary?.currentMonth;
  const currency = summary?.netWorth.currency ?? 'USD';
  const income = current?.income ?? 0;
  const expenses = current?.expenses ?? 0;
  const netSavings = income - expenses;

  const now = new Date();
  const subtitle = `${MONTHS[now.getMonth()]} ${String(now.getFullYear())}`;

  const chartData = [
    { name: 'Income', value: income, fill: 'hsl(var(--chart-4))' },
    { name: 'Expenses', value: expenses, fill: 'hsl(var(--destructive))' },
  ];

  return (
    <DashboardCard
      title="This Month"
      subtitle={subtitle}
      action={{ label: 'View transactions', href: '/transactions' }}
      isLoading={isLoading}
      skeleton={<IncomeExpenseSkeleton />}
    >
      <div className="flex flex-col gap-4">
        {/* Summary row */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Income</span>
            <span className="text-lg font-bold text-[hsl(var(--chart-4))] tabular-nums">
              {formatCurrency(income, currency)}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 items-end">
            <span className="text-xs text-muted-foreground">Expenses</span>
            <span className="text-lg font-bold text-destructive tabular-nums">
              {formatCurrency(expenses, currency)}
            </span>
          </div>
        </div>

        {/* Bar chart */}
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <CartesianGrid
              vertical={false}
              stroke="hsl(var(--border))"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<BarTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.5)' }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>

        {/* Net savings row */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">Net savings</span>
          <span
            className={`text-sm font-semibold tabular-nums ${netSavings >= 0 ? 'text-[hsl(var(--chart-4))]' : 'text-destructive'
              }`}
          >
            {netSavings >= 0 ? '+' : ''}
            {formatCurrency(netSavings, currency)}
          </span>
        </div>
      </div>
    </DashboardCard>
  );
}
