/**
 * NetWorthCard.tsx
 *
 * Dashboard widget — net worth with sparkline chart and month-over-month delta.
 */

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown } from 'lucide-react';
import { DashboardCard } from './DashboardCard';
import { useDashboardSummary, useNetWorthHistory } from '@/app/stores/dashboard.store';
import { formatCurrency } from '@/shared/utils/currency.utils';

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

type SparklinePayload = { value?: number; payload?: Record<string, unknown> };
type SparklineTooltipProps = { active?: boolean; payload?: SparklinePayload[] };

function SparklineTooltip({ payload }: SparklineTooltipProps) {
  if (!payload?.length) return null;
  const entry = payload[0];
  const raw = entry.payload ?? {};
  const dateStr = typeof raw.date === 'string' ? raw.date : '';
  const month = dateStr
    ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '';
  return (
    <div className="bg-card border border-border rounded-lg px-2.5 py-1.5 shadow-md">
      <p className="text-xs text-muted-foreground">{month}</p>
      <p className="text-xs font-semibold text-foreground">
        {typeof entry.value === 'number' ? entry.value.toLocaleString() : '—'}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function NetWorthSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="h-8 w-36 rounded-lg animate-pulse bg-muted" />
      <div className="h-4 w-24 rounded animate-pulse bg-muted" />
      <div className="h-20 w-full rounded-xl animate-pulse bg-muted mt-3" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NetWorthCard() {
  const { summary, isLoading } = useDashboardSummary();
  const { netWorthHistory } = useNetWorthHistory();

  const netWorth = summary?.netWorth;
  const currency = netWorth?.currency ?? 'USD';
  const currentNetWorth = netWorth?.netWorth ?? 0;

  // Month-over-month delta from history
  const prevPoint = netWorthHistory.length >= 2 ? netWorthHistory.at(-2) : null;
  const delta = prevPoint ? currentNetWorth - prevPoint.netWorth : 0;
  const deltaPercent = prevPoint && prevPoint.netWorth !== 0
    ? (delta / Math.abs(prevPoint.netWorth)) * 100
    : 0;

  const isPositiveDelta = delta > 0;
  const isNegativeDelta = delta < 0;

  const DeltaIcon = isPositiveDelta ? TrendingUp : isNegativeDelta ? TrendingDown : Minus;
  const deltaColor = isPositiveDelta
    ? 'text-[hsl(var(--chart-4))]'
    : isNegativeDelta
      ? 'text-destructive'
      : 'text-muted-foreground';

  return (
    <DashboardCard
      title="Net Worth"
      subtitle={currency}
      action={{ label: 'View accounts', href: '/accounts' }}
      isLoading={isLoading}
      skeleton={<NetWorthSkeleton />}
    >
      <div className="flex flex-col gap-4">
        {/* Top row */}
        <div className="flex items-start justify-between">
          {/* Left: amount + delta */}
          <div>
            <p
              className={`text-3xl font-bold tabular-nums tracking-tight ${currentNetWorth < 0 ? 'text-destructive' : 'text-foreground'
                }`}
            >
              {formatCurrency(currentNetWorth, currency)}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <DeltaIcon className={`w-3.5 h-3.5 ${deltaColor}`} aria-hidden />
              <span className={`text-sm font-medium ${deltaColor}`}>
                {delta !== 0 && (delta > 0 ? '+' : '')}
                {formatCurrency(delta, currency)}
              </span>
              <span className={`text-xs ${deltaColor}`}>
                ({deltaPercent > 0 ? '+' : ''}
                {deltaPercent.toFixed(1)}%)
              </span>
              <span className="text-xs text-muted-foreground">vs last month</span>
            </div>
          </div>

          {/* Right: asset / liability pills */}
          <div className="flex flex-col gap-1.5 items-end">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[hsl(var(--chart-4)/0.1)]">
              <ArrowUp className="w-3 h-3 text-[hsl(var(--chart-4))]" aria-hidden />
              <span className="text-xs font-medium text-[hsl(var(--chart-4))]">
                {formatCurrency(netWorth?.totalAssets ?? 0, currency)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10">
              <ArrowDown className="w-3 h-3 text-destructive" aria-hidden />
              <span className="text-xs font-medium text-destructive">
                {formatCurrency(netWorth?.totalLiabilities ?? 0, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Sparkline */}
        {netWorthHistory.length > 0 ? (
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart
              data={netWorthHistory}
              margin={{ top: 5, right: 0, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id="nwGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip content={<SparklineTooltip />} />
              <Area
                type="monotone"
                dataKey="netWorth"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#nwGradient)"
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-20 w-full rounded-xl bg-muted/30 flex items-center justify-center">
            <span className="text-xs text-muted-foreground">No history available</span>
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
