/**
 * GoalProgressRing.tsx
 *
 * Reusable circular progress ring for a single goal.
 * Used inside GoalProgressCard.
 */

import { ResponsiveContainer, PieChart, Pie } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/shared/utils/currency.utils';
import type { GoalProgressSummary } from '@/shared/types/dashboard.types';

type GoalProgressRingProps = {
  summary: GoalProgressSummary;
};

export function GoalProgressRing({ summary }: GoalProgressRingProps) {
  const { goal, totalContributed, percentComplete, isOnTrack, isComplete } = summary;

  const chartData = [
    { name: 'completed', value: percentComplete, fill: goal.color || 'hsl(var(--primary))' },
    { name: 'remaining', value: Math.max(0, 100 - percentComplete), fill: 'hsl(var(--muted))' },
  ];

  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl border border-border bg-muted/20 min-w-[200px] flex-shrink-0 sm:min-w-0">
      {/* Top row */}
      <div className="flex items-start justify-between">
        <p className="text-sm font-semibold text-foreground line-clamp-1 flex-1 mr-2">
          {goal.name}
        </p>
        {isComplete && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[hsl(var(--chart-4)/0.1)] text-[hsl(var(--chart-4))] shrink-0">
            Complete
          </span>
        )}
      </div>

      {/* Progress ring */}
      <div className="relative" style={{ height: 80 }}>
        <ResponsiveContainer width="100%" height={80}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={28}
              outerRadius={36}
              startAngle={90}
              endAngle={-270}
              strokeWidth={0}
              cornerRadius={3}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          aria-hidden
        >
          <span className="text-sm font-bold text-foreground">
            {Math.round(percentComplete)}%
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex justify-between">
        <div className="flex flex-col gap-0">
          <span className="text-[10px] text-muted-foreground">Saved</span>
          <span className="text-xs font-semibold text-foreground">
            {formatCurrency(totalContributed, goal.currency)}
          </span>
        </div>
        <div className="flex flex-col gap-0 items-end">
          <span className="text-[10px] text-muted-foreground">Target</span>
          <span className="text-xs font-semibold text-foreground">
            {formatCurrency(goal.targetAmount, goal.currency)}
          </span>
        </div>
      </div>

      {/* On-track indicator */}
      {!isComplete && (
        <div className="flex items-center gap-1">
          {isOnTrack ? (
            <>
              <TrendingUp className="w-3 h-3 text-[hsl(var(--chart-4))]" aria-hidden />
              <span className="text-[10px] text-[hsl(var(--chart-4))]">On track</span>
            </>
          ) : (
            <>
              <TrendingDown className="w-3 h-3 text-muted-foreground" aria-hidden />
              <span className="text-[10px] text-muted-foreground">Behind target</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
