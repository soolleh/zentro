import { ChevronRight } from 'lucide-react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import type { BudgetVsActual } from '@/shared/types/budget.types';
import type { UUID, ISODateString } from '@/shared/types/common.types';
import { formatCurrency } from '@/shared/utils/currency.utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function abbreviateCurrency(value: number, currency: string): string {
  if (value >= 1_000_000) return `${currency}${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${currency}${(value / 1_000).toFixed(1)}k`;
  return `${currency}${String(Math.round(value))}`;
}

function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function BudgetVsActualSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-[260px] rounded-2xl animate-pulse bg-muted" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse bg-muted rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------
type ChartRow = {
  name: string;
  allocated: number;
  spent: number;
  color: string;
  variance: number;
};

type BvsATooltipProps = { active?: boolean; payload?: ReadonlyArray<{ payload: ChartRow }>; currency: string };
function BvsATooltip({ active, payload, currency }: BvsATooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  const under = row.variance >= 0;
  return (
    <div className="bg-card border border-border rounded-xl shadow-md px-4 py-3 min-w-[180px]">
      <p className="text-xs font-semibold text-foreground mb-2">{row.name}</p>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-sm bg-muted shrink-0" />
          <span className="text-muted-foreground">Allocated:</span>
          <span className="font-medium text-foreground ml-auto">{formatCurrency(row.allocated, currency)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: row.color }} />
          <span className="text-muted-foreground">Spent:</span>
          <span className="font-medium text-foreground ml-auto">{formatCurrency(row.spent, currency)}</span>
        </div>
        <div className={`text-xs mt-1 ${under ? 'text-[hsl(var(--chart-4))]' : 'text-destructive'}`}>
          {formatCurrency(Math.abs(row.variance), currency)} {under ? 'under budget' : 'over budget'}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type BudgetVsActualChartProps = {
  readonly data: BudgetVsActual[];
  readonly isLoading: boolean;
  readonly currency: string;
  readonly cycleLabel: string;
  readonly userId: UUID;
  readonly cycleStart: ISODateString;
  readonly onOpenDrillDown: (categoryId: UUID) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function BudgetVsActualChart({
  data,
  isLoading,
  currency,
  cycleLabel,
  onOpenDrillDown,
}: BudgetVsActualChartProps) {
  if (isLoading) return <BudgetVsActualSkeleton />;

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm">
        No budget data available for this cycle.
      </div>
    );
  }

  const chartData: ChartRow[] = data.map((d) => ({
    name: truncate(d.categoryName, 12),
    allocated: d.allocated,
    spent: d.spent,
    color: d.categoryColor,
    variance: d.variance,
  }));

  const currencySymbol = currency.length === 3 ? currency : '$';

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Budget vs Actual</span>
        <span className="text-xs text-muted-foreground">{cycleLabel}</span>
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-border bg-card px-5 pt-5 pb-4">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => abbreviateCurrency(v, currencySymbol)}
            />
            <YAxis
              dataKey="name"
              type="category"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              width={90}
            />
            <Tooltip
              content={<BvsATooltip currency={currency} />}
              cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
            />
            <Bar dataKey="allocated" fill="hsl(var(--muted))" radius={[0, 4, 4, 0]} maxBarSize={12} />
            <Bar dataKey="spent" radius={[0, 4, 4, 0]} maxBarSize={12}>
              {chartData.map((entry, index) => (
                // eslint-disable-next-line @typescript-eslint/no-deprecated
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Variance summary table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-3 sm:grid-cols-4 px-4 py-2.5 bg-muted/40 border-b border-border">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Allocated</span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Spent</span>
          <span className="hidden sm:block text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Variance</span>
        </div>
        {data.map((row) => {
          const under = row.variance >= 0;
          return (
            <button
              key={row.categoryId}
              type="button"
              onClick={() => { onOpenDrillDown(row.categoryId); }}
              className="group grid grid-cols-3 sm:grid-cols-4 w-full px-4 py-3 border-b border-border/50 last:border-0 hover:bg-muted/20 cursor-pointer transition-colors duration-100 text-left items-center"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: row.categoryColor }}
                />
                <span className="text-sm font-medium text-foreground truncate">{row.categoryName}</span>
              </div>
              <span className="text-sm tabular-nums text-muted-foreground text-right">
                {formatCurrency(row.allocated, currency)}
              </span>
              <div className="flex items-center justify-end gap-1">
                <span className={`text-sm tabular-nums ${row.spent > row.allocated ? 'text-destructive font-semibold' : 'text-foreground'}`}>
                  {formatCurrency(row.spent, currency)}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0" />
              </div>
              <span className={`hidden sm:block text-sm tabular-nums font-medium text-right ${under ? 'text-[hsl(var(--chart-4))]' : 'text-destructive'}`}>
                {under ? '+' : '-'}{formatCurrency(Math.abs(row.variance), currency)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
