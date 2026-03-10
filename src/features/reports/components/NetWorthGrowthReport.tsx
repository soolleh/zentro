/**
 * NetWorthGrowthReport.tsx
 *
 * Report 5 — Net worth growth area chart with assets vs liabilities.
 */

import {
  ResponsiveContainer,
  Area,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { ArrowRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ReportSectionHeader } from './ReportSectionHeader';
import { useTrends, useReportFilters } from '@/app/stores/reports.store';
import { useBaseCurrency } from '@/app/preferences.store';
import { formatCurrency } from '@/shared/utils/currency.utils';
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
// Custom Tooltip
// ---------------------------------------------------------------------------

type ChartRow = {
  date?: string;
  netWorth?: number;
  compareValue?: number;
};

function NetWorthTooltip({ active, payload }: TooltipContentProps<RVT, RNT>) {
  if (!active || !payload.length) return null;
  const item = payload[0] as { payload: ChartRow } | undefined;
  const row = item?.payload ?? {} as ChartRow;
  const netWorth = row.netWorth ?? 0;
  const date = row.date ? formatMonthFull(row.date) : '';

  return (
    <div className="bg-card border border-border rounded-xl shadow-md px-4 py-3 min-w-[160px]">
      <p className="text-xs font-semibold text-foreground mb-2">{date}</p>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
        <span className="text-xs text-muted-foreground">Net Worth:</span>
        <span
          className={`text-xs font-bold ml-auto tabular-nums ${netWorth >= 0 ? 'text-[hsl(var(--chart-4))]' : 'text-destructive'
            }`}
        >
          {netWorth.toLocaleString()}
        </span>
      </div>
      {row.compareValue !== undefined && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Compare:</span>
          <span className="text-xs tabular-nums text-muted-foreground ml-auto">
            {row.compareValue.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function NetWorthGrowthReport() {
  const { netWorthTrend } = useTrends();
  const { filters } = useReportFilters();
  const { baseCurrency } = useBaseCurrency();

  const chartData = netWorthTrend.map((pt) => ({
    date: pt.date,
    label: formatMonthLabel(pt.date),
    netWorth: pt.value,
    compareValue: pt.compareValue,
  }));

  const startNetWorth = netWorthTrend[0]?.value ?? 0;
  const endNetWorth = netWorthTrend[netWorthTrend.length - 1]?.value ?? 0;
  const growthAbs = endNetWorth - startNetWorth;
  const growthPct =
    startNetWorth !== 0 ? ((growthAbs / Math.abs(startNetWorth)) * 100) : 0;

  const isPositive = growthAbs >= 0;

  return (
    <div className="flex flex-col gap-4">
      <ReportSectionHeader title="Net Worth Growth" />

      <div className="rounded-2xl border border-border bg-card px-5 pt-5 pb-4">
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData}>
            <defs>
              <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
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
            <Tooltip content={NetWorthTooltip} />
            <Area
              type="monotone"
              dataKey="netWorth"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              fill="url(#netWorthGradient)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: 'hsl(var(--primary))' }}
            />
            {filters.compareEnabled && (
              <Line
                type="monotone"
                dataKey="compareValue"
                stroke="hsl(var(--primary))"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                dot={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>

        {/* Delta summary */}
        <div className="flex items-center justify-between px-1 mt-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Period start</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {formatCurrency(startNetWorth, baseCurrency)}
            </span>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <div className="flex flex-col gap-0.5 items-end">
            <span className="text-xs text-muted-foreground">Period end</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {formatCurrency(endNetWorth, baseCurrency)}
            </span>
          </div>
          <div
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full ${isPositive
              ? 'bg-[hsl(var(--chart-4)/0.1)] text-[hsl(var(--chart-4))]'
              : 'bg-destructive/10 text-destructive'
              }`}
          >
            <span className="text-sm font-bold tabular-nums">
              {isPositive ? '+' : ''}{growthPct.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
