/**
 * NetWorthCard.tsx
 *
 * Dashboard widget — net worth with sparkline chart, month-over-month delta,
 * and milestone progress bar + badge strip.
 */

import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown, Trophy, ChevronDown, ChevronUp } from 'lucide-react';
import { DashboardCard } from './DashboardCard';
import { useDashboardSummary, useNetWorthHistory } from '@/app/stores/dashboard.store';
import { formatCurrency } from '@/shared/utils/currency.utils';
import {
  useMilestones,
  useMilestoneProgress,
  useCelebration,
  useMilestoneStore,
} from '@/app/stores/milestone.store';
import { useCurrentUser } from '@/app/stores/session.store';
import { MilestoneHistory } from '@/features/milestones/components/MilestoneHistory';
import type { MilestoneTier } from '@/shared/types/milestone.types';
import type { UUID } from '@/shared/types/common.types';

// ---------------------------------------------------------------------------
// Tier fill colors for progress bar
// ---------------------------------------------------------------------------

const TIER_FILL: Record<MilestoneTier, string> = {
  bronze: 'bg-primary',
  silver: 'bg-primary',
  gold: 'bg-[#ffd700]',
  platinum: 'bg-slate-300',
  diamond: 'bg-gradient-to-r from-blue-400 to-purple-500',
};

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

  // Milestone data
  const currentUser = useCurrentUser();
  const { milestones, unacknowledgedMilestones } = useMilestones();
  const { milestoneProgress } = useMilestoneProgress();
  const { isCelebrating } = useCelebration();
  const openHistory = useMilestoneStore((s) => s.openHistory);
  const loadNextMilestone = useMilestoneStore((s) => s.loadNextMilestone);

  const [showMilestones, setShowMilestones] = useState(false);

  const netWorth = summary?.netWorth;
  const currency = netWorth?.currency ?? 'USD';
  const currentNetWorth = netWorth?.netWorth ?? 0;

  // Keep milestone progress in sync when net worth changes
  useEffect(() => {
    if (currentUser?.id && !isLoading) {
      void loadNextMilestone(currentUser.id as UUID, currentNetWorth);
    }
  }, [currentUser?.id, currentNetWorth, isLoading, loadNextMilestone]);

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

  // Pulsing dot — unacknowledged milestones but overlay not yet showing
  const showPulsingDot = unacknowledgedMilestones.length > 0 && !isCelebrating;

  // Recent milestones for badge strip (3 most recent)
  const recentMilestones = milestones.slice(0, 3);
  const milestoneCount = milestones.length;

  return (
    <>
      <DashboardCard
        title="Net Worth"
        subtitle={currency}
        action={{ label: 'View accounts', href: '/accounts' }}
        isLoading={isLoading}
        skeleton={<NetWorthSkeleton />}
        titleExtra={
          showPulsingDot ? (
            <span
              className="w-2 h-2 rounded-full bg-[#ffd700] animate-pulse"
              aria-label={`${unacknowledgedMilestones.length} unacknowledged milestone${unacknowledgedMilestones.length !== 1 ? 's' : ''}`}
              role="status"
            />
          ) : undefined
        }
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

          {/* Milestone progress bar */}
          {milestoneProgress && milestoneProgress.next && (
            <div className="flex flex-col gap-1.5 pt-3 border-t border-border/50">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Next milestone</span>
                <span className="text-xs font-medium text-foreground">
                  {milestoneProgress.next.emoji} {milestoneProgress.next.label}
                  {'  ·  '}
                  <span className="text-muted-foreground">
                    {formatCurrency(milestoneProgress.amountRemaining, currency)} away
                  </span>
                </span>
              </div>
              <div
                className="h-1.5 w-full rounded-full bg-muted overflow-hidden"
                role="progressbar"
                aria-label={`Progress to ${milestoneProgress.next.label}`}
                aria-valuenow={Math.round(milestoneProgress.progressPercent)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={`h-full rounded-full transition-all duration-700 ${TIER_FILL[milestoneProgress.next.tier]}`}
                  style={{ width: `${milestoneProgress.progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Milestone badge strip + toggle */}
          {milestoneCount > 0 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowMilestones((v) => !v)}
                className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors group"
                aria-expanded={showMilestones}
                aria-label={showMilestones ? 'Hide milestones' : `See ${milestoneCount} milestone${milestoneCount !== 1 ? 's' : ''} achieved`}
              >
                <span className="flex items-center gap-1.5">
                  {recentMilestones.map((m) => (
                    <span key={m.id} className="text-base leading-none" aria-hidden="true">
                      {m.emoji}
                    </span>
                  ))}
                  {milestoneCount > 3 && (
                    <span className="text-[10px] text-muted-foreground">+{milestoneCount - 3}</span>
                  )}
                  <span className="ml-1">
                    {milestoneCount} milestone{milestoneCount !== 1 ? 's' : ''} achieved
                  </span>
                </span>
                {showMilestones ? (
                  <ChevronUp className="w-3.5 h-3.5" aria-hidden />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" aria-hidden />
                )}
              </button>

              {showMilestones && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={openHistory}
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline underline-offset-4"
                  >
                    <Trophy className="w-3.5 h-3.5" aria-hidden />
                    View milestone history
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </DashboardCard>

      {/* Milestone history slide panel */}
      <MilestoneHistory />
    </>
  );
}
