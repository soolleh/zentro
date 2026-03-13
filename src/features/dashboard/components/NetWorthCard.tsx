/**
 * NetWorthCard.tsx
 *
 * Gamified net worth card — living milestone arc gauge, level-aware visual
 * styling, MoM delta, sparkline, and shortcuts to Trophy Room & Journey.
 */

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUp,
  ArrowDown,
  Map,
} from 'lucide-react';
import { useDashboardSummary, useNetWorthHistory } from '@/app/stores/dashboard.store';
import { formatCurrency } from '@/shared/utils/currency.utils';
import {
  useMilestones,
  useMilestoneProgress,
  useTrophyRoom,
  useJourney,
} from '@/app/stores/milestone.store';
import {
  BADGE_LEVEL_STYLES,
  MILESTONE_CONFIG,
  formatINR,
  type BadgeLevel,
} from '@/services/milestones/milestone-config';
import { MilestoneBadge } from '@/features/milestones/components/MilestoneBadge';

// ---------------------------------------------------------------------------
// Style maps keyed by badge level
// ---------------------------------------------------------------------------

const CARD_BG: Record<BadgeLevel, string> = {
  1: 'bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800',
  2: 'bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-100 dark:from-indigo-950 dark:to-blue-950',
  3: 'bg-gradient-to-br from-slate-100 via-gray-200 to-slate-300 dark:from-slate-800 dark:to-slate-700',
  4: 'bg-gradient-to-br from-amber-50 via-yellow-100 to-orange-100 dark:from-amber-950 dark:to-orange-950',
  5: 'bg-gradient-to-br from-purple-950 via-indigo-900 to-violet-950',
};

const ARC_COLOR: Record<BadgeLevel, string> = {
  1: '#6366f1',
  2: '#8b5cf6',
  3: '#94a3b8',
  4: '#f59e0b',
  5: '#a855f7',
};

const AMOUNT_GRADIENT: Record<BadgeLevel, string | undefined> = {
  1: undefined,
  2: undefined,
  3: 'bg-gradient-to-r from-slate-400 via-white to-slate-300 bg-clip-text text-transparent',
  4: 'bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 bg-clip-text text-transparent',
  5: 'bg-gradient-to-r from-purple-400 via-pink-300 to-violet-400 bg-clip-text text-transparent',
};

// ---------------------------------------------------------------------------
// Arc SVG helpers (semicircle gauge, left→top→right)
// ---------------------------------------------------------------------------

const RADIUS = 80;
const CX = 100;
const CY = 100;

/**
 * Returns the SVG (x, y) coordinate on the semicircle arc at the given ratio.
 *  ratio=0 → left point (20, 100)
 *  ratio=0.5 → top point (100, 20)
 *  ratio=1 → right point (180, 100)
 */
function getArcPoint(ratio: number): { x: number; y: number } {
  const angle = Math.PI * (1 - Math.min(1, Math.max(0, ratio)));
  return {
    x: CX + RADIUS * Math.cos(angle),
    y: CY - RADIUS * Math.sin(angle),
  };
}

/** Builds an SVG path string for the progress arc. Returns '' if no progress.
 *  sweep-flag=1 traces the UPPER semicircle (increasing SVG angle from 180°→360°).
 *  The full span is exactly 180°, so large-arc-flag is always 0.
 */
function buildProgressPath(ratio: number): string {
  if (ratio < 0.001) return '';
  const pt = getArcPoint(ratio);
  return `M 20 100 A ${RADIUS} ${RADIUS} 0 0 1 ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Sparkline tooltip
// ---------------------------------------------------------------------------

type SparkPayload = { value?: number; payload?: Record<string, unknown> };
type SparkTooltipProps = { active?: boolean; payload?: SparkPayload[] };

function SparklineTooltip({ payload }: SparkTooltipProps) {
  if (!payload?.length) return null;
  const entry = payload[0];
  const raw = entry.payload ?? {};
  const dateStr = typeof raw.date === 'string' ? raw.date : '';
  const month = dateStr
    ? new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : '';
  return (
    <div className="bg-card border border-border rounded-lg px-2.5 py-1.5 shadow-md">
      <p className="text-xs text-muted-foreground">{month}</p>
      <p className="text-xs font-semibold text-foreground">
        {typeof entry.value === 'number' ? formatINR(entry.value) : '—'}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function NetWorthSkeleton({ bg }: { bg: string }) {
  return (
    <div className={`rounded-3xl p-5 border border-border/20 ${bg}`}>
      <div className="flex flex-col gap-3 animate-pulse">
        <div className="h-6 w-28 rounded-full bg-muted/50" />
        <div className="h-10 w-44 rounded-lg bg-muted/50" />
        <div className="h-24 w-full rounded-xl bg-muted/30 mx-auto" style={{ maxWidth: 200 }} />
        <div className="h-12 w-full rounded-xl bg-muted/20" />
        <div className="h-14 w-full rounded-xl bg-muted/10" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NetWorthCard() {
  const { summary, isLoading } = useDashboardSummary();
  const { netWorthHistory } = useNetWorthHistory();
  const { achieved, unacknowledged } = useMilestones();
  const { openTrophyRoom } = useTrophyRoom();
  const { openJourney } = useJourney();

  const netWorthData = summary?.netWorth;
  const currency = netWorthData?.currency ?? 'INR';
  const currentNetWorth = netWorthData?.netWorth ?? 0;

  // Live milestone progress (pure, no IDB)
  const progress = useMilestoneProgress(currentNetWorth);
  const { current, next, progressPercent, amountRemaining, isMaxMilestone } = progress;
  const level = current.badgeLevel;
  const levelStyle = BADGE_LEVEL_STYLES[level];
  const arcColor = ARC_COLOR[level];
  const cardBg = CARD_BG[level];
  const amountGradient = AMOUNT_GRADIENT[level];

  // Month-over-month delta from the last two history points
  const prevPoint = netWorthHistory.length >= 2 ? netWorthHistory.at(-2) : null;
  const delta = prevPoint ? currentNetWorth - prevPoint.netWorth : 0;
  const deltaPercent =
    prevPoint && prevPoint.netWorth !== 0
      ? (delta / Math.abs(prevPoint.netWorth)) * 100
      : 0;
  const isPositive = delta > 0;
  const isNegative = delta < 0;
  const DeltaIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  const deltaColor = isPositive
    ? 'text-emerald-500'
    : isNegative
      ? 'text-red-400'
      : 'text-muted-foreground';

  // Arc path (memoised)
  const progressPath = useMemo(
    () => buildProgressPath(progressPercent / 100),
    [progressPercent],
  );

  // Tick marks: milestones between current and next threshold
  const tickMarks = useMemo(() => {
    if (!next) return [];
    const rangeMin = current.threshold;
    const rangeMax = next.threshold;
    return MILESTONE_CONFIG.filter(
      (m) => m.threshold > rangeMin && m.threshold < rangeMax,
    ).map((m) => {
      const subRatio = (m.threshold - rangeMin) / (rangeMax - rangeMin);
      const pt = getArcPoint(subRatio);
      return { id: m.id, pt };
    });
  }, [current.threshold, next]);

  const hasUnacked = unacknowledged.length > 0;

  // Stage badge inline style
  const badgeInlineStyle: React.CSSProperties = {};
  if (levelStyle.backgroundStyle) {
    badgeInlineStyle.background = levelStyle.backgroundStyle
      .replace('background: ', '')
      .trim();
  }
  if (levelStyle.glowClass !== 'none') {
    badgeInlineStyle.boxShadow = levelStyle.glowClass;
  }

  if (isLoading) {
    return <NetWorthSkeleton bg={cardBg} />;
  }

  // Glow dot position
  const glowPt = progressPercent > 0 ? getArcPoint(progressPercent / 100) : null;

  return (
    <div
      className={`rounded-3xl overflow-hidden relative border shadow-lg ${cardBg} ${levelStyle.borderClass} p-5 flex flex-col gap-4`}
    >
      {/* Level 5 shimmer overlay */}
      {level === 5 && (
        <div
          className="legendary-shimmer absolute inset-0 pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* ── Row 1: Stage badge + Journey button ── */}
      <div className="relative z-10 flex items-center justify-between">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${levelStyle.containerClass}`}
          style={badgeInlineStyle}
        >
          <span className="text-base leading-none" aria-hidden="true">
            {current.emoji}
          </span>
          <span className={levelStyle.textClass}>
            {levelStyle.label} ·{' '}
            {current.stage.charAt(0).toUpperCase() + current.stage.slice(1)}
          </span>
        </div>
        <button
          type="button"
          onClick={openJourney}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/30 hover:bg-background/50 transition-colors text-xs font-medium"
          aria-label="Open milestone journey timeline"
        >
          <Map className="w-3.5 h-3.5" aria-hidden="true" />
          Journey
        </button>
      </div>

      {/* ── Row 2: Net worth amount + MoM delta + assets/liabilities ── */}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider font-medium text-muted-foreground mb-1">
            Total Net Worth
          </p>
          <p
            className={`text-4xl font-black tabular-nums tracking-tight leading-none ${currentNetWorth < 0 ? 'text-red-400' : (amountGradient ?? 'text-foreground')
              }`}
          >
            {formatCurrency(currentNetWorth, currency)}
          </p>
          {delta !== 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <DeltaIcon className={`w-3.5 h-3.5 shrink-0 ${deltaColor}`} aria-hidden="true" />
              <span className={`text-sm font-medium ${deltaColor}`}>
                {delta > 0 ? '+' : ''}
                {formatCurrency(delta, currency)}
              </span>
              <span className={`text-xs ${deltaColor}`}>
                ({deltaPercent > 0 ? '+' : ''}
                {deltaPercent.toFixed(1)}%)
              </span>
              <span className="text-xs text-muted-foreground">vs last month</span>
            </div>
          )}
        </div>

        {/* Assets / liabilities pills */}
        <div className="flex flex-col gap-1.5 items-end shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10">
            <ArrowUp className="w-3 h-3 text-emerald-500" aria-hidden="true" />
            <span className="text-xs font-medium text-emerald-500">
              {formatCurrency(netWorthData?.totalAssets ?? 0, currency)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-400/10">
            <ArrowDown className="w-3 h-3 text-red-400" aria-hidden="true" />
            <span className="text-xs font-medium text-red-400">
              {formatCurrency(netWorthData?.totalLiabilities ?? 0, currency)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Row 3: Semicircle arc gauge ── */}
      {/* viewBox offset by 10 so the 10px stroke at the endpoints isn't clipped */}
      <div className="relative z-10 flex justify-center">
        <svg
          viewBox="10 10 180 100"
          width="220"
          height="122"
          role="img"
          aria-label={`Milestone progress: ${progressPercent.toFixed(0)}%`}
        >
          {/* Track — sweep=1 draws the UPPER semicircle */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.15}
            strokeWidth={10}
            strokeLinecap="round"
          />

          {/* Progress */}
          {progressPath && (
            <path
              d={progressPath}
              fill="none"
              stroke={arcColor}
              strokeWidth={10}
              strokeLinecap="round"
              style={
                level >= 3
                  ? { filter: `drop-shadow(0 0 6px ${arcColor})` }
                  : undefined
              }
            />
          )}

          {/* Sub-milestone tick marks */}
          {tickMarks.map((tm) => (
            <circle
              key={tm.id}
              cx={tm.pt.x}
              cy={tm.pt.y}
              r={4}
              fill={arcColor}
              opacity={0.45}
            />
          ))}

          {/* Glow dot at current progress position */}
          {glowPt && (
            <>
              <circle cx={glowPt.x} cy={glowPt.y} r={9} fill={arcColor} opacity={0.2} />
              <circle cx={glowPt.x} cy={glowPt.y} r={5} fill={arcColor} />
            </>
          )}

          {/* Centre: milestone emoji + name */}
          <text x="100" y="75" textAnchor="middle" fontSize="22" dominantBaseline="middle">
            {current.emoji}
          </text>
          <text
            x="100"
            y="93"
            textAnchor="middle"
            fontSize="9"
            fill="currentColor"
            fillOpacity={0.65}
            fontWeight="600"
          >
            {current.name}
          </text>
        </svg>
      </div>

      {/* ── Row 4: Stats grid ── */}
      <div className="relative z-10 grid grid-cols-3 gap-2">
        {/* Current net worth */}
        <div className="flex flex-col items-center bg-background/20 rounded-xl py-2 px-2 gap-0.5">
          <span className="text-xs text-muted-foreground">Current</span>
          <span className="text-sm font-bold tabular-nums leading-snug">
            {formatINR(currentNetWorth)}
          </span>
        </div>

        {/* Trophy Room button */}
        <button
          type="button"
          onClick={openTrophyRoom}
          className="relative flex flex-col items-center bg-background/20 rounded-xl py-2 px-2 hover:bg-background/40 transition-colors gap-0.5 cursor-pointer"
          aria-label={`Open trophy room — ${achieved.length} of 16 milestones earned`}
        >
          {hasUnacked && (
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 animate-pulse"
              role="status"
              aria-label={`${unacknowledged.length} new milestone${unacknowledged.length !== 1 ? 's' : ''}`}
            />
          )}
          <span className="text-lg leading-none" aria-hidden="true">🏆</span>
          <span className="text-xs font-medium">{achieved.length}/16</span>
        </button>

        {/* Next milestone */}
        <div className="flex flex-col items-center bg-background/20 rounded-xl py-2 px-2 gap-0.5">
          <span className="text-xs text-muted-foreground">Next</span>
          {next ? (
            <>
              <span className="text-xs font-bold text-center leading-snug line-clamp-1">
                {next.name}
              </span>
              <span className="text-xs text-muted-foreground">{formatINR(next.threshold)}</span>
            </>
          ) : (
            <span className="text-xs font-bold text-center">
              Legendary 🌟
            </span>
          )}
        </div>
      </div>

      {/* ── Row 5: "X away" remaining chip ── */}
      <div className="relative z-10">
        {isMaxMilestone ? (
          <div
            className="text-center text-xs font-semibold py-2.5 px-4 rounded-xl"
            style={{
              background: `linear-gradient(90deg, ${arcColor}22, ${arcColor}44)`,
              color: arcColor,
            }}
          >
            🌟 You've reached the pinnacle of wealth!
          </div>
        ) : (
          <div className="flex items-center justify-between bg-background/20 rounded-xl py-2 px-3 gap-2">
            <span className="text-xs text-muted-foreground shrink-0">To unlock</span>
            <div className="flex items-center gap-2 min-w-0">
              <MilestoneBadge milestoneId={next!.id} size="xs" locked />
              <span className="text-xs font-bold leading-snug truncate">
                {formatINR(amountRemaining)} · {next!.name}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Row 6: Sparkline ── */}
      {netWorthHistory.length > 0 && (
        <div className="relative z-10">
          <ResponsiveContainer width="100%" height={60}>
            <AreaChart
              data={netWorthHistory}
              margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id="nwSparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={arcColor} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={arcColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="netWorth"
                stroke={arcColor}
                strokeWidth={1.5}
                fill="url(#nwSparkGrad)"
                dot={false}
                isAnimationActive={false}
              />
              <Tooltip content={<SparklineTooltip />} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
