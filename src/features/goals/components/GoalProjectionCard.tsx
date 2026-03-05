import { CheckCircle2, AlertCircle } from 'lucide-react';
import { format, parseISO, differenceInMonths } from 'date-fns';
import { formatCurrency } from '@/shared/utils/currency.utils';
import type { GoalProjection } from '@/shared/types/goal.types';
import { useDateFormat } from '@/app/preferences.store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GoalProjectionCardProps = {
  readonly projection: GoalProjection;
  readonly goalColor: string;
  readonly currency: string;
  readonly targetDate?: string;
  readonly isComplete: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateStr(dateStr: string, dateFormat: string): string {
  try {
    const d = parseISO(dateStr);
    switch (dateFormat) {
      case 'MM/DD/YYYY': return format(d, 'MMM d, yyyy');
      case 'YYYY-MM-DD': return format(d, 'yyyy-MM-dd');
      default: return format(d, 'd MMM yyyy');
    }
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GoalProjectionCard({
  projection,
  goalColor,
  currency,
  targetDate,
  isComplete,
}: GoalProjectionCardProps) {
  const { dateFormat } = useDateFormat();

  const monthsUntilTarget = targetDate
    ? Math.max(0, differenceInMonths(parseISO(targetDate), new Date()))
    : null;

  const projectedDateDisplay = projection.projectedCompletionDate
    ? formatDateStr(projection.projectedCompletionDate, dateFormat)
    : null;

  const targetDateDisplay = targetDate ? formatDateStr(targetDate, dateFormat) : null;

  // Progress bar: show projected % toward target
  const projBarPercent = isComplete
    ? 100
    : !projection.projectedCompletionDate || !targetDate
      ? 0
      : Math.min(
        100,
        projection.isOnTrack
          ? 70 + (projection.monthlyContributionRate > 0 ? 20 : 0)
          : 30
      );

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Projection</span>
        {isComplete ? (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[hsl(var(--chart-4)/0.1)] text-[hsl(var(--chart-4))]">
            Complete
          </span>
        ) : projection.projectedCompletionDate ? (
          projection.isOnTrack ? (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-1 bg-[hsl(var(--chart-4)/0.1)] text-[hsl(var(--chart-4))]">
              <CheckCircle2 className="w-2.5 h-2.5" />
              On track
            </span>
          ) : (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-1 bg-amber-100 dark:bg-amber-900/20 text-amber-700">
              <AlertCircle className="w-2.5 h-2.5" />
              Behind
            </span>
          )
        ) : null}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Monthly rate */}
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Monthly rate</span>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {projection.monthlyContributionRate > 0
              ? formatCurrency(projection.monthlyContributionRate, currency) + '/mo'
              : 'No data'}
          </span>
        </div>

        {/* Required */}
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Required</span>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {isComplete
              ? '—'
              : projection.requiredMonthlyAmount !== null
                ? formatCurrency(projection.requiredMonthlyAmount, currency) + '/mo'
                : 'No deadline'}
          </span>
        </div>

        {/* Projected date */}
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Projected</span>
          <span
            className="text-sm font-semibold tabular-nums"
            style={
              projectedDateDisplay && !isComplete
                ? { color: projection.isOnTrack ? 'hsl(var(--chart-4))' : 'hsl(var(--chart-3))' }
                : undefined
            }
          >
            {isComplete
              ? 'Goal complete!'
              : projectedDateDisplay ?? 'Add more to project'}
          </span>
        </div>

        {/* Time remaining */}
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Time remaining</span>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {isComplete
              ? 'Goal complete!'
              : targetDate && targetDateDisplay
                ? monthsUntilTarget !== null && monthsUntilTarget > 0
                  ? `${String(monthsUntilTarget)} months`
                  : 'Due this month'
                : '—'}
          </span>
        </div>
      </div>

      {/* Progress comparison */}
      {!isComplete && (projection.projectedCompletionDate ?? false) && (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">At this rate:</span>
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${projBarPercent.toString()}%`,
                backgroundColor: projection.isOnTrack ? goalColor : 'hsl(35 90% 55%)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
