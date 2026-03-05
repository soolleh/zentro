import { useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { SegmentedControl } from '@/features/settings/components/SegmentedControl';
import type { CategorySpendingTrend } from '@/shared/types/budget.types';
import type { UUID } from '@/shared/types/common.types';
import { formatCurrency } from '@/shared/utils/currency.utils';
import { formatCycleLabel } from '@/services/budgets/budget-analytics.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function abbreviateCurrency(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function TrendsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-7 w-20 rounded-full animate-pulse bg-muted" />
        ))}
      </div>
      <div className="h-[260px] rounded-2xl animate-pulse bg-muted" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl animate-pulse bg-muted" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ShowMode = 'spent' | 'allocated' | 'both';
type MonthsOption = '3' | '6' | '12';

type SpendingTrendsChartProps = {
  readonly data: CategorySpendingTrend[];
  readonly isLoading: boolean;
  readonly currency: string;
  readonly userId: UUID;
  readonly onMonthsChange: (months: number) => void;
  readonly onOpenDrillDown: (categoryId: UUID) => void;
};

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------
type TrendPoint = Record<string, unknown> & { cycleLabel: string };

type TrendsTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: TrendPoint }>;
  trends: CategorySpendingTrend[];
  currency: string;
  showMode: ShowMode;
};
function TrendsTooltip({ active, payload, trends, currency, showMode }: TrendsTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;

  // Collect all visible values and sort by amount desc
  const entries: { name: string; color: string; spent: number; allocated: number }[] = [];
  for (const trend of trends) {
    const spentKey = `${trend.categoryId}_spent`;
    const allocKey = `${trend.categoryId}_alloc`;
    const spent = (point[spentKey] as number | undefined) ?? 0;
    const allocated = (point[allocKey] as number | undefined) ?? 0;
    if (spent > 0 || allocated > 0) {
      entries.push({ name: trend.categoryName, color: trend.categoryColor, spent, allocated });
    }
  }
  entries.sort((a, b) => b.spent - a.spent);

  const total = entries.reduce((s, e) => s + e.spent, 0);

  return (
    <div className="bg-card border border-border rounded-xl shadow-md px-4 py-3 min-w-[180px]">
      <p className="text-xs font-semibold mb-2 text-foreground">{point.cycleLabel}</p>
      <div className="flex flex-col gap-1">
        {entries.map((e) => (
          <div key={e.name} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
            <span className="text-muted-foreground flex-1 truncate">{e.name}</span>
            <span className="font-medium text-foreground">
              {showMode === 'allocated'
                ? formatCurrency(e.allocated, currency)
                : formatCurrency(e.spent, currency)}
            </span>
          </div>
        ))}
      </div>
      {entries.length > 0 && (
        <div className="flex justify-between text-xs font-semibold mt-1.5 pt-1.5 border-t border-border">
          <span className="text-muted-foreground">Total</span>
          <span className="text-foreground">{formatCurrency(total, currency)}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function SpendingTrendsChart({
  data,
  isLoading,
  currency,
  onMonthsChange,
  onOpenDrillDown,
}: SpendingTrendsChartProps) {
  const [selectedMonths, setSelectedMonths] = useState<MonthsOption>('6');
  const [hiddenCategories, setHiddenCategories] = useState<Set<UUID>>(new Set());
  const [showMode, setShowMode] = useState<ShowMode>('spent');
  const [showAllChips, setShowAllChips] = useState(false);

  const handleMonthsChange = (val: MonthsOption) => {
    setSelectedMonths(val);
    onMonthsChange(parseInt(val, 10));
  };

  const toggleCategory = (id: UUID) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (isLoading) return <TrendsSkeleton />;

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm">
        Not enough data yet. Track at least 2 cycles to see spending trends.
      </div>
    );
  }

  // Build flat chart data: array of { cycleLabel, [catId_spent]: n, [catId_alloc]: n }
  const allCycleStarts = Array.from(
    new Set(data.flatMap((t) => t.points.map((p) => p.cycleStart)))
  ).sort();

  type ChartDatum = Record<string, unknown> & { cycleLabel: string };

  const chartData: ChartDatum[] = allCycleStarts.map((cs) => {
    const row: ChartDatum = { cycleLabel: formatCycleLabel(cs) };
    for (const trend of data) {
      const pt = trend.points.find((p) => p.cycleStart === cs);
      row[`${trend.categoryId}_spent`] = pt?.spent ?? 0;
      row[`${trend.categoryId}_alloc`] = pt?.allocated ?? 0;
    }
    return row;
  });

  const visibleData = data.filter((t) => !hiddenCategories.has(t.categoryId));
  const CHIP_LIMIT = 6;
  const displayedChips = showAllChips ? data : data.slice(0, CHIP_LIMIT);

  const monthOptions = [
    { value: '3' as const, label: '3M' },
    { value: '6' as const, label: '6M' },
    { value: '12' as const, label: '12M' },
  ];

  const showModeOptions = [
    { value: 'spent' as const, label: 'Spent' },
    { value: 'allocated' as const, label: 'Allocated' },
    { value: 'both' as const, label: 'Both' },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Header + months selector */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Spending Trends</span>
        <SegmentedControl
          value={selectedMonths}
          onChange={handleMonthsChange}
          options={monthOptions}
          ariaLabel="Time range"
        />
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2">
        {displayedChips.map((trend) => {
          const isVisible = !hiddenCategories.has(trend.categoryId);
          return (
            <button
              key={trend.categoryId}
              type="button"
              onClick={() => { toggleCategory(trend.categoryId); }}
              className={`flex items-center gap-1.5 h-7 px-3 rounded-full border text-xs font-medium cursor-pointer transition-all duration-150 ${isVisible
                  ? 'border-current'
                  : 'border-border bg-muted/30 text-muted-foreground'
                }`}
              style={
                isVisible
                  ? {
                    borderColor: trend.categoryColor,
                    backgroundColor: `${trend.categoryColor}1A`,
                    color: trend.categoryColor,
                  }
                  : undefined
              }
            >
              {trend.categoryName}
            </button>
          );
        })}
        {data.length > CHIP_LIMIT && !showAllChips && (
          <button
            type="button"
            onClick={() => { setShowAllChips(true); }}
            className="flex items-center gap-1.5 h-7 px-3 rounded-full border border-border bg-muted/30 text-muted-foreground text-xs font-medium cursor-pointer hover:text-foreground transition-colors"
          >
            +{String(data.length - CHIP_LIMIT)} more
          </button>
        )}
      </div>

      {/* Multi-line chart */}
      <div className="rounded-2xl border border-border bg-card px-5 pt-5 pb-4">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="cycleLabel"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              width={45}
              tickFormatter={abbreviateCurrency}
            />
            <Tooltip
              content={
                <TrendsTooltip
                  trends={visibleData}
                  currency={currency}
                  showMode={showMode}
                />
              }
            />
            {visibleData.map((trend) => {
              const spentKey = `${trend.categoryId}_spent`;
              const allocKey = `${trend.categoryId}_alloc`;
              return [
                (showMode === 'spent' || showMode === 'both') && (
                  <Line
                    key={`${trend.categoryId}-spent`}
                    type="monotone"
                    dataKey={spentKey}
                    stroke={trend.categoryColor}
                    strokeWidth={2}
                    dot={{ r: 3, strokeWidth: 0, fill: trend.categoryColor }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                    name={trend.categoryName}
                  />
                ),
                (showMode === 'allocated' || showMode === 'both') && (
                  <Line
                    key={`${trend.categoryId}-alloc`}
                    type="monotone"
                    dataKey={allocKey}
                    stroke={trend.categoryColor}
                    strokeWidth={2}
                    strokeDasharray={showMode === 'both' ? '5 3' : undefined}
                    dot={false}
                    name={`${trend.categoryName} (allocated)`}
                  />
                ),
              ].filter(Boolean);
            }).flat()}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Allocated vs spent toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Show:</span>
        <SegmentedControl
          value={showMode}
          onChange={setShowMode}
          options={showModeOptions}
          ariaLabel="Show mode"
        />
      </div>

      {/* Mini category cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {data.map((trend) => {
          const pts = trend.points;
          const latest = pts.length > 0 ? pts[pts.length - 1].spent : 0;
          const previous = pts.length > 1 ? pts[pts.length - 2].spent : 0;
          const isUp = latest > previous;
          const isDown = latest < previous;
          const changePct =
            previous > 0 ? Math.abs(((latest - previous) / previous) * 100) : null;

          return (
            <button
              key={trend.categoryId}
              type="button"
              onClick={() => { onOpenDrillDown(trend.categoryId); }}
              className="rounded-xl border border-border bg-card p-3 flex flex-col gap-2 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all duration-150 text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: trend.categoryColor }}
                />
                <span className="text-xs font-semibold text-foreground truncate">
                  {trend.categoryName}
                </span>
              </div>

              {/* Sparkline */}
              <div style={{ height: 40 }}>
                <ResponsiveContainer width="100%" height={40}>
                  <AreaChart data={trend.points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id={`sg-${trend.categoryId}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={trend.categoryColor} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={trend.categoryColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="spent"
                      stroke={trend.categoryColor}
                      strokeWidth={1.5}
                      fill={`url(#sg-${trend.categoryId})`}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold tabular-nums text-foreground">
                  {formatCurrency(latest, currency)}
                </span>
                {changePct !== null && (
                  <span className={`flex items-center gap-0.5 text-[10px] ${isUp ? 'text-destructive' : isDown ? 'text-[hsl(var(--chart-4))]' : 'text-muted-foreground'}`}>
                    {isUp && <ArrowUp className="w-2.5 h-2.5" />}
                    {isDown && <ArrowDown className="w-2.5 h-2.5" />}
                    {changePct.toFixed(0)}%
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
