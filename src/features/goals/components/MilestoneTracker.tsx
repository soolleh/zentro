import { CheckCircle2, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { formatCurrency } from '@/shared/utils/currency.utils';
import type { GoalMilestone } from '@/shared/types/goal.types';
import { useDateFormat } from '@/app/preferences.store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MilestoneTrackerProps = {
  readonly milestones: GoalMilestone[];
  readonly goalColor: string;
  readonly currency: string;
};

// ---------------------------------------------------------------------------
// Date formatter
// ---------------------------------------------------------------------------

function formatDate(dateStr: string, dateFormat: string): string {
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

export function MilestoneTracker({ milestones, goalColor, currency }: MilestoneTrackerProps) {
  const { dateFormat } = useDateFormat();

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Milestones
      </p>
      <div className="flex flex-col gap-0 rounded-xl border border-border overflow-hidden">
        {milestones.map((milestone) => {
          const remaining = milestone.amount - (milestone.isReached ? milestone.amount : milestone.amount);
          void remaining; // computed for display below
          return (
            <div
              key={milestone.percent}
              className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0"
            >
              {/* Icon */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${milestone.isReached ? '' : 'bg-muted'
                  }`}
                style={
                  milestone.isReached
                    ? { backgroundColor: `${goalColor}26` }
                    : undefined
                }
              >
                {milestone.isReached ? (
                  <CheckCircle2
                    className="w-4 h-4"
                    style={{ color: goalColor }}
                  />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-muted-foreground/20" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {milestone.percent}% milestone
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(milestone.amount, currency)}
                </p>
                {milestone.isReached && milestone.reachedAt && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    {formatDate(milestone.reachedAt, dateFormat)}
                  </p>
                )}
              </div>

              {/* Right badge */}
              {milestone.isReached ? (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 bg-[hsl(var(--chart-4)/0.1)] text-[hsl(var(--chart-4))]">
                  Reached
                </span>
              ) : (
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatCurrency(milestone.amount, currency)} to go
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
