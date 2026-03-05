import { TrendingUp, TrendingDown } from 'lucide-react';
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

import type { CycleComparison } from '@/shared/types/budget.types';
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

function hexWithOpacity(color: string, opacity: number): string {
  // For hex colors, convert to rgba; for other format just append opacity
  if (color.startsWith('#') && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(opacity)})`;
  }
  return color;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function ComparisonSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-[240px] rounded-2xl animate-pulse bg-muted" />
      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-7 w-28 rounded-full animate-pulse bg-muted" />
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
  current: number;
  previous: number;
  avg: number;
  color: string;
  trendPercent: number;
};

type ComparisonTooltipProps = { active?: boolean; payload?: ReadonlyArray<{ payload: ChartRow }>; currency: string };
function ComparisonTooltip({ active, payload, currency }: ComparisonTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  const isUp = row.trendPercent > 0;
  return (
    <div className="bg-card border border-border rounded-xl shadow-md px-4 py-3 min-w-[200px]">
      <p className="text-xs font-semibold text-foreground mb-2">{row.name}</p>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: row.color }} />
          <span className="text-muted-foreground">This month:</span>
          <span className="font-medium text-foreground ml-auto">{formatCurrency(row.current, currency)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: hexWithOpacity(row.color, 0.4) }} />
          <span className="text-muted-foreground">Last month:</span>
          <span className="font-medium text-foreground ml-auto">{formatCurrency(row.previous, currency)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0 bg-muted-foreground/30" />
          <span className="text-muted-foreground">3-month avg:</span>
          <span className="font-medium text-foreground ml-auto">{formatCurrency(row.avg, currency)}</span>
        </div>
        {Math.abs(row.trendPercent) > 0.5 && (
          <div className={`text-xs mt-1.5 ${isUp ? 'text-destructive' : 'text-[hsl(var(--chart-4))]'}`}>
            {isUp ? '▲' : '▼'} {Math.abs(row.trendPercent).toFixed(1)}% vs last month
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type CycleComparisonChartProps = {
  readonly data: CycleComparison[];
  readonly isLoading: boolean;
  readonly currency: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function CycleComparisonChart({ data, isLoading, currency }: CycleComparisonChartProps) {
  if (isLoading) return <ComparisonSkeleton />;

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm">
        No comparison data available. Track at least 2 cycles to see comparisons.
      </div>
    );
  }

  const chartData: ChartRow[] = data.map((d) => ({
    name: truncate(d.categoryName, 8),
    current: d.currentCycleSpent,
    previous: d.previousCycleSpent,
    avg: d.threeMonthAverage,
    color: d.categoryColor,
    trendPercent: d.trendPercent,
  }));

  const currencySymbol = currency.length === 3 ? currency : '$';
  const notableChanges = data.filter((d) => Math.abs(d.trendPercent) > 10);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Month-over-Month Comparison</span>
        <span className="text-xs text-muted-foreground">Current vs previous vs 3-month avg</span>
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-border bg-card px-5 pt-5 pb-4">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={(v: number) => abbreviateCurrency(v, currencySymbol)}
            />
            <Tooltip
              content={<ComparisonTooltip currency={currency} />}
              cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
            />
            {/* Current cycle bars — category color */}
            <Bar dataKey="current" radius={[4, 4, 0, 0]} maxBarSize={16}>
              {chartData.map((entry, index) => (
                // eslint-disable-next-line @typescript-eslint/no-deprecated
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
            {/* Previous cycle bars — 40% opacity */}
            <Bar dataKey="previous" radius={[4, 4, 0, 0]} maxBarSize={16}>
              {chartData.map((entry, index) => (
                // eslint-disable-next-line @typescript-eslint/no-deprecated
                <Cell key={index} fill={hexWithOpacity(entry.color, 0.4)} />
              ))}
            </Bar>
            {/* 3-month average bars — muted */}
            <Bar dataKey="avg" fill="hsl(var(--muted-foreground)/0.3)" radius={[4, 4, 0, 0]} maxBarSize={16} />
          </BarChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-sm bg-[hsl(var(--primary))]" />
            This month
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-sm bg-[hsl(var(--primary)/0.4)]" />
            Last month
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-sm bg-muted-foreground/30" />
            3-month avg
          </div>
        </div>
      </div>

      {/* Trend chips */}
      {notableChanges.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {notableChanges.map((d) => {
            const isUp = d.trendPercent > 0;
            return (
              <div
                key={d.categoryId}
                className={`flex items-center gap-1.5 h-7 px-3 rounded-full border text-xs font-medium ${isUp
                    ? 'border-destructive/30 bg-destructive/5 text-destructive'
                    : 'border-[hsl(155_65%_42%/0.3)] bg-[hsl(155_65%_42%/0.05)] text-[hsl(var(--chart-4))]'
                  }`}
              >
                {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {d.categoryName} {isUp ? '+' : ''}{d.trendPercent.toFixed(0)}%
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center w-full py-2">
          No significant changes vs last month.
        </p>
      )}
    </div>
  );
}
