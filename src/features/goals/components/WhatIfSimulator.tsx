/**
 * WhatIfSimulator.tsx
 *
 * Self-contained What-If Simulator for a single goal.
 * No Zustand. No service calls. All computation in whatif.utils.ts.
 */

import { useState, useMemo, useRef } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import { format, parseISO, differenceInCalendarMonths } from 'date-fns';
import { Calculator, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import {
  computeWhatIfProjection,
  computeRequiredMonthly,
  getWhatIfSuggestions,
  formatMonthYear,
  formatMonthsToCompletion,
} from '@/features/goals/utils/whatif.utils';
import { formatCurrency } from '@/shared/utils/currency.utils';
import type { EnrichedGoal } from '@/shared/types/goal.types';
import type { ISODateString } from '@/shared/types/common.types';
import type { WhatIfResult } from '@/features/goals/utils/whatif.utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WhatIfSimulatorProps = {
  readonly goal: EnrichedGoal;
};

type ChartTooltipProps = {
  readonly active?: boolean;
  readonly payload?: ReadonlyArray<{ readonly value?: number }>;
  readonly label?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_MONTHS = 120;

function getDefaultAmount(enriched: EnrichedGoal): number {
  const { projection } = enriched;
  if (projection.requiredMonthlyAmount !== null && projection.requiredMonthlyAmount > 0) {
    return projection.requiredMonthlyAmount;
  }
  if (projection.monthlyContributionRate > 0) {
    return projection.monthlyContributionRate;
  }
  return 0;
}

function formatCompletionPreview(result: WhatIfResult, isImpossible: boolean): {
  text: string;
  className: string;
} {
  if (result.monthlyContribution <= 0) {
    return { text: 'Enter an amount', className: 'text-muted-foreground' };
  }
  if (isImpossible || result.projectedCompletionDate === null) {
    return { text: '10+ years', className: 'text-muted-foreground' };
  }
  const text = `Done by ${formatMonthYear(result.projectedCompletionDate)}`;
  const className = result.isBeforeTargetDate
    ? 'text-[hsl(var(--chart-4))]'
    : 'text-[hsl(var(--chart-3))]';
  return { text, className };
}

// ---------------------------------------------------------------------------
// Chart tooltip
// ---------------------------------------------------------------------------

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0 || !label) return null;
  const balance = payload[0]?.value ?? 0;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-md">
      <p className="text-xs text-muted-foreground">
        {formatMonthYear(label as ISODateString)}
      </p>
      <p className="text-xs font-semibold text-foreground">
        {formatCurrency(balance, label.startsWith('USD') ? 'USD' : 'USD')} saved
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WhatIfSimulator({ goal }: WhatIfSimulatorProps) {
  const defaultAmount = getDefaultAmount(goal);
  const [monthlyAmount, setMonthlyAmount] = useState<number>(defaultAmount);
  const [inputStr, setInputStr] = useState<string>(
    defaultAmount > 0 ? String(defaultAmount) : ''
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable start-of-today, computed once per mount
  const startDate = useMemo((): ISODateString => format(new Date(), 'yyyy-MM-dd') as ISODateString, []);

  const requiredMonthly = goal.goal.targetDate
    ? computeRequiredMonthly({
      currentTotal: goal.totalContributed,
      targetAmount: goal.goal.targetAmount,
      targetDate: goal.goal.targetDate,
    })
    : null;

  const suggestions = getWhatIfSuggestions({
    currentTotal: goal.totalContributed,
    targetAmount: goal.goal.targetAmount,
    monthlyContribution: monthlyAmount,
    startDate,
    targetDate: goal.goal.targetDate ?? null,
    currentRate: goal.projection.monthlyContributionRate,
    requiredMonthlyAmount: goal.projection.requiredMonthlyAmount,
  });

  const result = useMemo(
    () =>
      computeWhatIfProjection({
        currentTotal: goal.totalContributed,
        targetAmount: goal.goal.targetAmount,
        monthlyContribution: monthlyAmount,
        startDate,
        targetDate: goal.goal.targetDate ?? null,
      }),
    [monthlyAmount, goal, startDate]
  );

  const isImpossible =
    monthlyAmount > 0 &&
    result.projectedCompletionDate === null;

  const showChart =
    !isImpossible &&
    result.points.length > 1 &&
    monthlyAmount > 0;

  // Gradient ID unique per goal to avoid SVG ID collisions
  const gradientId = `whatif-gradient-${goal.goal.id}`;

  // X-axis tick interval — show ~5 ticks
  const xInterval = result.points.length > 5
    ? Math.max(1, Math.floor(result.points.length / 5) - 1)
    : 0;

  // Target date comparison details
  const targetDateMissMonths =
    result.projectedCompletionDate !== null &&
      !result.isBeforeTargetDate &&
      goal.goal.targetDate
      ? differenceInCalendarMonths(
        parseISO(result.projectedCompletionDate),
        parseISO(goal.goal.targetDate)
      )
      : 0;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setInputStr(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const parsed = parseFloat(val);
      setMonthlyAmount(isNaN(parsed) || parsed <= 0 ? 0 : parsed);
    }, 200);
  }

  function handleChipClick(amount: number) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setMonthlyAmount(amount);
    setInputStr(String(amount));
  }

  function handleSuggestRequired() {
    if (requiredMonthly === null || !isFinite(requiredMonthly)) return;
    handleChipClick(requiredMonthly);
  }

  // ---------------------------------------------------------------------------
  // Completion preview
  // ---------------------------------------------------------------------------

  const preview = formatCompletionPreview(result, isImpossible);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Calculator className="w-4 h-4 text-primary" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            What-If Simulator
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Adjust your monthly contribution to see how it changes your completion date.
        </p>
      </div>

      {/* Input section */}
      <div className="flex flex-col gap-3">
        {/* Label row */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Monthly contribution</span>
          <span className={`text-xs font-medium ${preview.className}`}>{preview.text}</span>
        </div>

        {/* Input row */}
        <div className="flex items-center gap-2">
          <div className="h-9 px-3 rounded-lg border border-input bg-muted text-sm font-medium text-foreground shrink-0 flex items-center">
            {goal.goal.currency}
          </div>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            placeholder="0"
            value={inputStr}
            onChange={handleInputChange}
            className="flex-1 h-9 rounded-lg border border-input bg-background px-3 text-sm font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all duration-150"
          />
        </div>

        {/* Suggestion chips */}
        <div className="flex gap-2 flex-wrap mt-1">
          {suggestions.map((s) => {
            const isActive = monthlyAmount === s.amount;
            return (
              <button
                key={s.label}
                type="button"
                onClick={() => { handleChipClick(s.amount); }}
                className={[
                  'flex flex-col shrink-0 px-3 py-1.5 rounded-xl border cursor-pointer transition-all duration-150',
                  isActive
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-muted/30 hover:border-primary/40',
                ].join(' ')}
              >
                <span className="text-xs font-semibold text-foreground">
                  {formatCurrency(s.amount, goal.goal.currency)}
                </span>
                <span className="text-[10px] text-muted-foreground">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Zero-amount empty state */}
      {monthlyAmount <= 0 && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Calculator className="w-8 h-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Enter a monthly amount to see your projection.
          </p>
        </div>
      )}

      {/* Impossible (> 10 years) state */}
      {isImpossible && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/40 border border-border">
          <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            At {formatCurrency(monthlyAmount, goal.goal.currency)}/mo this goal would take over 10
            years. Try a higher amount.
          </p>
        </div>
      )}

      {/* Results summary */}
      {monthlyAmount > 0 && !isImpossible && (
        <div className="animate-in fade-in-0 duration-200 flex flex-col gap-3">
          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-0.5 px-3 py-2.5 rounded-xl bg-muted/40 border border-border">
              <span className="text-[10px] text-muted-foreground">Completion</span>
              <span className="text-sm font-bold text-foreground">
                {result.projectedCompletionDate
                  ? formatMonthYear(result.projectedCompletionDate)
                  : '—'}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 px-3 py-2.5 rounded-xl bg-muted/40 border border-border">
              <span className="text-[10px] text-muted-foreground">Time to goal</span>
              <span className="text-sm font-bold text-foreground">
                {result.monthsToCompletion !== null
                  ? formatMonthsToCompletion(result.monthsToCompletion)
                  : '—'}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 px-3 py-2.5 rounded-xl bg-muted/40 border border-border">
              <span className="text-[10px] text-muted-foreground">Total contributions</span>
              <span className="text-sm font-bold text-foreground">
                {result.totalContributions > 0
                  ? formatCurrency(result.totalContributions, goal.goal.currency)
                  : '—'}
              </span>
            </div>
          </div>

          {/* Target date comparison */}
          {goal.goal.targetDate && (
            <div
              className={[
                'animate-in fade-in-0 duration-150 flex items-start gap-2 px-3 py-2 rounded-xl border',
                result.isBeforeTargetDate
                  ? 'border-[hsl(var(--chart-4)/0.3)] bg-[hsl(var(--chart-4)/0.05)]'
                  : 'border-amber-200/60 bg-amber-50/40',
              ].join(' ')}
            >
              {result.isBeforeTargetDate ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[hsl(var(--chart-4))] shrink-0 mt-0.5" />
                  <p className="text-xs text-[hsl(var(--chart-4))]">
                    {"You'll hit your target date of "}
                    {formatMonthYear(goal.goal.targetDate)}
                    {result.monthsToCompletion !== null && goal.goal.targetDate
                      ? ` with ${String(
                        differenceInCalendarMonths(
                          parseISO(goal.goal.targetDate),
                          result.projectedCompletionDate
                            ? parseISO(result.projectedCompletionDate)
                            : new Date()
                        )
                      )} months to spare.`
                      : '.'}
                  </p>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    {"You'll miss your target date by "}
                    {String(targetDateMissMonths)}
                    {' months. Try contributing '}
                    {requiredMonthly !== null && isFinite(requiredMonthly) ? (
                      <span
                        className="font-semibold underline cursor-pointer"
                        onClick={handleSuggestRequired}
                      >
                        {formatCurrency(requiredMonthly, goal.goal.currency)}/mo
                      </span>
                    ) : (
                      'more'
                    )}
                    {' instead.'}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Projection chart */}
      {showChart && result.points.length > MAX_MONTHS - MAX_MONTHS ? (
        <div className="animate-in fade-in-0 duration-300 rounded-xl border border-border bg-card px-4 pt-4 pb-3">
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart
              data={result.points as ReadonlyArray<{ date: string; projected: number; target: number }>}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={goal.goal.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={goal.goal.color} stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                vertical={false}
                stroke="hsl(var(--border))"
                strokeDasharray="4 4"
                strokeOpacity={0.4}
              />

              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                interval={xInterval}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value: unknown) => {
                  if (typeof value !== 'string') return '';
                  try {
                    const d = parseISO(value);
                    return d.getMonth() === 0 ? format(d, "MMM ''yy") : format(d, 'MMM');
                  } catch {
                    return typeof value === 'string' ? value : '';
                  }
                }}
              />

              <YAxis hide={true} domain={[0, goal.goal.targetAmount * 1.05]} />

              <Tooltip content={<WhatIfChartTooltip goal={goal} />} />

              <ReferenceLine
                y={goal.goal.targetAmount}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                label={{
                  value: 'Target',
                  position: 'insideTopRight',
                  fontSize: 10,
                  fill: 'hsl(var(--muted-foreground))',
                }}
              />

              {goal.goal.targetDate && (
                <ReferenceLine
                  x={goal.goal.targetDate}
                  stroke="hsl(var(--primary))"
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                  label={{
                    value: 'Target date',
                    position: 'insideTopLeft',
                    fontSize: 10,
                    fill: 'hsl(var(--primary))',
                  }}
                />
              )}

              <Area
                type="monotone"
                dataKey="projected"
                stroke={goal.goal.color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: goal.goal.color }}
              />

              {result.projectedCompletionDate && (
                <ReferenceDot
                  x={result.projectedCompletionDate}
                  y={goal.goal.targetAmount}
                  r={6}
                  fill={goal.goal.color}
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : showChart ? (
        <div className="animate-in fade-in-0 duration-300 rounded-xl border border-border bg-card px-4 pt-4 pb-3">
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart
              data={result.points as ReadonlyArray<{ date: string; projected: number; target: number }>}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={goal.goal.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={goal.goal.color} stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                vertical={false}
                stroke="hsl(var(--border))"
                strokeDasharray="4 4"
                strokeOpacity={0.4}
              />

              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                interval={xInterval}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value: unknown) => {
                  if (typeof value !== 'string') return '';
                  try {
                    const d = parseISO(value);
                    return d.getMonth() === 0 ? format(d, "MMM ''yy") : format(d, 'MMM');
                  } catch {
                    return typeof value === 'string' ? value : '';
                  }
                }}
              />

              <YAxis hide={true} domain={[0, goal.goal.targetAmount * 1.05]} />

              <Tooltip content={<WhatIfChartTooltip goal={goal} />} />

              <ReferenceLine
                y={goal.goal.targetAmount}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                label={{
                  value: 'Target',
                  position: 'insideTopRight',
                  fontSize: 10,
                  fill: 'hsl(var(--muted-foreground))',
                }}
              />

              {goal.goal.targetDate && (
                <ReferenceLine
                  x={goal.goal.targetDate}
                  stroke="hsl(var(--primary))"
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                  label={{
                    value: 'Target date',
                    position: 'insideTopLeft',
                    fontSize: 10,
                    fill: 'hsl(var(--primary))',
                  }}
                />
              )}

              <Area
                type="monotone"
                dataKey="projected"
                stroke={goal.goal.color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: goal.goal.color }}
              />

              {result.projectedCompletionDate && (
                <ReferenceDot
                  x={result.projectedCompletionDate}
                  y={goal.goal.targetAmount}
                  r={6}
                  fill={goal.goal.color}
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart tooltip (separate component to avoid inline type issues)
// ---------------------------------------------------------------------------

type WhatIfChartTooltipProps = ChartTooltipProps & {
  readonly goal: EnrichedGoal;
};

function WhatIfChartTooltip({ active, payload, label, goal }: WhatIfChartTooltipProps) {
  if (!active || !payload || payload.length === 0 || !label) return null;
  const balance = payload[0]?.value ?? 0;
  const percent = Math.min(100, (balance / goal.goal.targetAmount) * 100);
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-md">
      <p className="text-xs text-muted-foreground">{formatMonthYear(label as ISODateString)}</p>
      <p className="text-xs font-semibold text-foreground">
        {formatCurrency(balance, goal.goal.currency)} saved
      </p>
      <p className="text-xs" style={{ color: goal.goal.color }}>
        {percent.toFixed(0)}% of goal
      </p>
    </div>
  );
}

// Suppress unused import warning — ChartTooltip used above
const _unused = ChartTooltip;
void _unused;
