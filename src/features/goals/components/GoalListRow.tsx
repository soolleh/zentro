import { Calendar, Plus, ChevronRight, Target } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { GoalProgressRing } from './GoalProgressRing';
import { useGoalPanel } from '@/app/stores/goal.store';
import { useDateFormat } from '@/app/preferences.store';
import { formatCurrency } from '@/shared/utils/currency.utils';
import type { EnrichedGoal } from '@/shared/types/goal.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GoalListRowProps = {
  readonly enriched: EnrichedGoal;
};

// ---------------------------------------------------------------------------
// Helpers
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

export function GoalListRow({ enriched }: GoalListRowProps) {
  const { openPanel } = useGoalPanel();
  const { dateFormat } = useDateFormat();

  const { goal, percentComplete, totalContributed, isComplete, projection, milestones } = enriched;

  const showOnTrackBadge = !isComplete && !!goal.targetDate;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => { openPanel('detail', enriched); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openPanel('detail', enriched); }}
      className="rounded-xl border border-border bg-card px-4 py-3.5 flex items-center gap-4 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all duration-150 active:scale-[0.995] outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Mini progress ring */}
      <div className="relative shrink-0">
        <GoalProgressRing
          percentComplete={percentComplete}
          goalColor={goal.color}
          milestones={milestones}
          size="sm"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {/* Top row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground truncate">{goal.name}</span>
          {isComplete && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 bg-[hsl(var(--chart-4)/0.1)] text-[hsl(var(--chart-4))]">
              Complete
            </span>
          )}
          {showOnTrackBadge && projection.projectedCompletionDate && (
            projection.isOnTrack ? (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 bg-[hsl(var(--chart-4)/0.1)] text-[hsl(var(--chart-4))]">
                On track
              </span>
            ) : (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 bg-amber-100 dark:bg-amber-900/20 text-amber-700">
                Behind
              </span>
            )
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mt-1.5">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${percentComplete.toString()}%`, backgroundColor: goal.color }}
          />
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted-foreground">
            {formatCurrency(totalContributed, goal.currency)} of{' '}
            {formatCurrency(goal.targetAmount, goal.currency)}
          </span>
          {goal.targetDate && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(goal.targetDate, dateFormat)}
            </span>
          )}
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1 shrink-0">
        {!isComplete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openPanel('contribute', enriched);
            }}
            className="w-7 h-7 rounded-lg border border-border bg-background flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-all duration-150"
            aria-label={`Contribute to ${goal.name}`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Goal emoji helper
// ---------------------------------------------------------------------------

export function GoalEmoji({ emoji, color, size = 'md' }: { emoji?: string; color: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-base',
    md: 'w-10 h-10 text-xl',
    lg: 'w-12 h-12 text-2xl',
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-2xl flex items-center justify-center shrink-0`}
      style={{ backgroundColor: `${color}26` }}
    >
      {emoji ? (
        <span>{emoji}</span>
      ) : (
        <Target className="w-5 h-5" style={{ color }} />
      )}
    </div>
  );
}
