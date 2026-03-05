import { Loader2, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { PieChart, Pie, ResponsiveContainer } from 'recharts';
import type { BudgetHealthScore } from '@/shared/types/budget.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type HealthScoreCardProps = {
  readonly score: BudgetHealthScore | null;
  readonly isLoading: boolean;
  readonly historicalCycleCount: number;
};

// ---------------------------------------------------------------------------
// Grade color helpers
// ---------------------------------------------------------------------------
function gradeTextColor(grade: BudgetHealthScore['grade']): string {
  switch (grade) {
    case 'A': return 'text-[hsl(var(--chart-4))]';
    case 'B': return 'text-[hsl(var(--primary))]';
    case 'C': return 'text-[hsl(var(--chart-3))]';
    case 'D': return 'text-amber-500';
    case 'F': return 'text-destructive';
  }
}

function gradeHslFill(grade: BudgetHealthScore['grade']): string {
  switch (grade) {
    case 'A': return 'hsl(155 65% 42%)';
    case 'B': return 'hsl(192 90% 38%)';
    case 'C': return 'hsl(35 90% 55%)';
    case 'D': return 'hsl(35 100% 50%)';
    case 'F': return 'hsl(0 72% 55%)';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function HealthScoreCard({ score, isLoading, historicalCycleCount }: HealthScoreCardProps) {
  if (isLoading || score === null) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Computing budget health…</span>
        </div>
      </div>
    );
  }

  const ringData = [
    { value: score.score, fill: gradeHslFill(score.grade) },
    { value: Math.max(0, 100 - score.score), fill: 'hsl(var(--muted))' },
  ];

  const colorClass = gradeTextColor(score.grade);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Left — score ring */}
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="relative w-full" style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie
                  data={ringData}
                  dataKey="value"
                  innerRadius={50}
                  outerRadius={64}
                  startAngle={90}
                  endAngle={-270}
                  strokeWidth={0}
                  cornerRadius={4}
                  paddingAngle={0}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 pointer-events-none">
              <span className="text-3xl font-bold text-foreground leading-none">
                {String(score.score)}
              </span>
              <span className={`text-sm font-bold leading-none ${colorClass}`}>
                {score.grade}
              </span>
            </div>
          </div>

          {/* Label + trend */}
          <div className="flex flex-col items-center gap-1">
            <span className={`text-sm font-semibold ${colorClass}`}>{score.label}</span>
            <div className="flex items-center gap-1">
              {score.trend === 'improving' && (
                <>
                  <TrendingUp className="w-3 h-3 text-[hsl(var(--chart-4))]" />
                  <span className="text-xs text-[hsl(var(--chart-4))]">Improving</span>
                </>
              )}
              {score.trend === 'declining' && (
                <>
                  <TrendingDown className="w-3 h-3 text-destructive" />
                  <span className="text-xs text-destructive">Declining</span>
                </>
              )}
              {score.trend === 'stable' && (
                <>
                  <Minus className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Stable</span>
                </>
              )}
            </div>
            {score.previousScore !== null && (
              <span className="text-xs text-muted-foreground">
                vs last cycle: {String(score.previousScore)}
              </span>
            )}
          </div>
        </div>

        {/* Right — breakdown (col-span-2) */}
        <div className="sm:col-span-2 flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Score breakdown
          </p>

          {/* Utilization score */}
          <BreakdownRow
            label="Budget utilization"
            points={score.breakdown.utilizationScore}
            maxPoints={40}
            displayPoints={`+${String(score.breakdown.utilizationScore)} pts`}
            barColor="bg-primary"
            positive
          />

          {/* Consistency score */}
          <BreakdownRow
            label="Spending consistency"
            points={score.breakdown.consistencyScore}
            maxPoints={30}
            displayPoints={`+${String(score.breakdown.consistencyScore)} pts`}
            barColor="bg-[hsl(var(--chart-2))]"
            positive
          />

          {/* Overspend penalty */}
          <BreakdownRow
            label="Overspend penalty"
            points={score.breakdown.overspendPenalty}
            maxPoints={20}
            displayPoints={`-${String(score.breakdown.overspendPenalty)} pts`}
            barColor="bg-destructive"
            positive={false}
          />

          {/* Carry-forward bonus */}
          <BreakdownRow
            label="Carry-forward discipline"
            points={score.breakdown.carryForwardBonus}
            maxPoints={10}
            displayPoints={`+${String(score.breakdown.carryForwardBonus)} pts`}
            barColor="bg-[hsl(var(--chart-4))]"
            positive
          />

          {/* Insufficient history notice */}
          {historicalCycleCount < 2 && (
            <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-muted/40 border border-border">
              <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Your health score will become more accurate as you track more budget cycles.
                Keep tracking for at least 2 months for full scoring.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: breakdown row
// ---------------------------------------------------------------------------
type BreakdownRowProps = {
  readonly label: string;
  readonly points: number;
  readonly maxPoints: number;
  readonly displayPoints: string;
  readonly barColor: string;
  readonly positive: boolean;
};

function BreakdownRow({ label, points, maxPoints, displayPoints, barColor, positive }: BreakdownRowProps) {
  const widthPercent = maxPoints > 0 ? (points / maxPoints) * 100 : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className={`text-xs font-semibold ${positive ? 'text-[hsl(var(--chart-4))]' : 'text-destructive'}`}>
          {displayPoints}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${String(widthPercent)}%` }}
        />
      </div>
    </div>
  );
}
