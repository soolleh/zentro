/**
 * SavingsRateTrendReport.tsx
 *
 * Report 6 — Savings rate over time with reference zones.
 */

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea,
  Tooltip,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ReportSectionHeader } from './ReportSectionHeader';
import { useTrends, useReportFilters } from '@/app/stores/reports.store';
import type { TooltipContentProps } from 'recharts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function getDotColor(value: number): string {
  if (value >= 20) return 'hsl(var(--chart-4))';
  if (value >= 0) return 'hsl(var(--primary))';
  return 'hsl(var(--destructive))';
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

type ChartRow = {
  date?: string;
  value?: number;
  compareValue?: number;
};

function SavingsRateTooltip({ active, payload }: TooltipContentProps<number, string>) {
  if (!active || !payload.length) return null;
  const item = payload[0] as { payload: ChartRow } | undefined;
  const row = item?.payload ?? {} as ChartRow;
  const value = row.value ?? 0;
  const date = row.date ? formatMonthFull(row.date) : '';

  return (
    <div className="bg-card border border-border rounded-xl shadow-md px-4 py-3 min-w-[150px]">
      <p className="text-xs font-semibold text-foreground mb-2">{date}</p>
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: getDotColor(value) }}
        />
        <span className="text-xs text-muted-foreground">Savings rate:</span>
        <span
          className="text-xs font-bold ml-auto tabular-nums"
          style={{ color: getDotColor(value) }}
        >
          {value.toFixed(1)}%
        </span>
      </div>
      {row.compareValue !== undefined && (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">Previous:</span>
          <span className="text-xs tabular-nums text-muted-foreground ml-auto">
            {row.compareValue.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom dot renderer
// ---------------------------------------------------------------------------

type DotProps = {
  cx: number;
  cy: number;
  payload: { value: number };
};

function ColoredDot({ cx, cy, payload }: DotProps) {
  const color = getDotColor(payload.value);
  return <circle cx={cx} cy={cy} r={3} fill={color} stroke="none" />;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SavingsRateTrendReport() {
  const { savingsRateTrend } = useTrends();
  const { filters } = useReportFilters();

  const chartData = savingsRateTrend.map((pt) => ({
    date: pt.date,
    label: formatMonthLabel(pt.date),
    value: pt.value,
    compareValue: pt.compareValue,
  }));

  return (
    <div className="flex flex-col gap-4">
      <ReportSectionHeader title="Savings Rate" />

      <div className="rounded-2xl border border-border bg-card px-5 pt-5 pb-4 relative">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData}>
            {/* Reference zones */}
            <ReferenceArea
              y1={20}
              y2={100}
              fill="hsl(var(--chart-4))"
              fillOpacity={0.05}
              ifOverflow="extendDomain"
            />
            <ReferenceArea
              y1={0}
              y2={20}
              fill="hsl(var(--primary))"
              fillOpacity={0.03}
              ifOverflow="extendDomain"
            />
            <ReferenceArea
              y1={-100}
              y2={0}
              fill="hsl(var(--destructive))"
              fillOpacity={0.05}
              ifOverflow="extendDomain"
            />
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
              tickFormatter={(v: number) => `${String(v)}%`}
              domain={['auto', 'auto']}
              width={40}
            />
            <ReferenceLine
              y={0}
              stroke="hsl(var(--border))"
              strokeWidth={1}
            />
            <ReferenceLine
              y={20}
              stroke="hsl(var(--chart-4))"
              strokeDasharray="3 3"
              strokeOpacity={0.4}
            />
            <Tooltip<number, string> content={SavingsRateTooltip} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={(props: unknown) => {
                const p = props as { cx: number; cy: number; payload: { value: number } };
                return <ColoredDot key={`dot-${String(p.cx)}`} cx={p.cx} cy={p.cy} payload={p.payload} />;
              }}
              activeDot={{ r: 5, strokeWidth: 0 }}
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
          </LineChart>
        </ResponsiveContainer>

        {/* Zone labels */}
        <div className="absolute right-3 top-5 flex flex-col gap-8 pointer-events-none">
          <span className="text-[10px] text-[hsl(var(--chart-4)/0.6)]">Great (≥20%)</span>
          <span className="text-[10px] text-muted-foreground">Good</span>
          <span className="text-[10px] text-destructive/50">Negative</span>
        </div>
      </div>
    </div>
  );
}
