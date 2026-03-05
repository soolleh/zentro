import { useState } from 'react';
import { ArrowDownLeft, CheckCircle2 } from 'lucide-react';
import { format, parseISO, differenceInHours } from 'date-fns';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { formatCurrency } from '@/shared/utils/currency.utils';
import { undoContribution } from '@/services/goals/goal.service';
import { useGoalStore } from '@/app/stores/goal.store';
import { useCurrentUser } from '@/app/stores/session.store';
import { useUIStore } from '@/app/ui.store';
import { useDateFormat } from '@/app/preferences.store';
import type { GoalContribution, GoalMilestone } from '@/shared/types/goal.types';
import type { UUID } from '@/shared/types/common.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ContributionTimelineProps = {
  readonly contributions: GoalContribution[];
  readonly milestones: GoalMilestone[];
  readonly goalColor: string;
  readonly goalEmoji?: string;
  readonly goalId: UUID;
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

// Which milestone (if any) was crossed at this contribution?
function getMilestoneForContribution(
  contribution: GoalContribution,
  milestones: GoalMilestone[]
): GoalMilestone | null {
  return (
    milestones.find(
      (m) => m.isReached && m.reachedAt === contribution.date
    ) ?? null
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MAX_VISIBLE = 10;

export function ContributionTimeline({
  contributions,
  milestones,
  goalColor,
  goalEmoji,
  goalId,
  currency,
}: ContributionTimelineProps) {
  const [showAll, setShowAll] = useState(false);
  const [undoTarget, setUndoTarget] = useState<GoalContribution | null>(null);
  const currentUser = useCurrentUser();
  const refreshGoal = useGoalStore((s) => s.refreshGoal);
  const addToast = useUIStore((s) => s.addToast);
  const { dateFormat } = useDateFormat();

  const mostRecent: GoalContribution | null = contributions.length > 0 ? contributions[0] : null;
  const canUndo =
    mostRecent !== null &&
    differenceInHours(new Date(), parseISO(mostRecent.date)) < 24;

  const visible = showAll ? contributions : contributions.slice(0, MAX_VISIBLE);

  async function handleUndo() {
    if (!undoTarget || !currentUser) return;
    const result = await undoContribution(undoTarget.id, undoTarget.transactionId);
    if (result.success) {
      setUndoTarget(null);
      await refreshGoal(currentUser.id, goalId);
      addToast({ type: 'success', message: 'Contribution removed.', duration: 3000 });
    } else {
      addToast({ type: 'error', message: result.error.message, duration: 5000 });
    }
  }

  if (contributions.length === 0) {
    return (
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Contribution history
        </p>
        <p className="text-xs text-muted-foreground py-4">
          No contributions yet. Add your first!
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Contribution history
      </p>

      <div className="flex flex-col relative">
        {/* Left timeline line */}
        <div className="absolute left-[15px] top-0 bottom-0 w-px bg-border" />

        {visible.map((contribution, idx) => {
          const crossedMilestone = getMilestoneForContribution(contribution, milestones);
          const isNewest = idx === 0;
          const showUndoBtn = isNewest && canUndo;

          return (
            <div key={contribution.id} className="flex items-start gap-3 pb-4 last:pb-0 relative">
              {/* Timeline dot */}
              <div
                className={`w-[30px] h-[30px] rounded-full border-2 flex items-center justify-center shrink-0 z-10 ${crossedMilestone
                  ? 'border-opacity-100 bg-card'
                  : 'border-border bg-card'
                  }`}
                style={
                  crossedMilestone
                    ? { borderColor: goalColor, backgroundColor: `${goalColor}1a` }
                    : undefined
                }
              >
                {crossedMilestone ? (
                  goalEmoji ? (
                    <span className="text-xs">{goalEmoji}</span>
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" style={{ color: goalColor }} />
                  )
                ) : (
                  <ArrowDownLeft className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    +{formatCurrency(contribution.amount, currency)}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDate(contribution.date, dateFormat)}
                  </span>
                </div>

                <div className="flex items-center flex-wrap gap-x-1 mt-0.5">
                  {contribution.notes && (
                    <span className="text-xs text-muted-foreground italic">
                      {contribution.notes}
                    </span>
                  )}
                  {crossedMilestone && (
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `${goalColor}1a`,
                        color: goalColor,
                      }}
                    >
                      {crossedMilestone.percent}% reached!
                    </span>
                  )}
                  {showUndoBtn && (
                    <button
                      type="button"
                      onClick={() => { setUndoTarget(contribution); }}
                      className="text-[10px] text-destructive hover:underline cursor-pointer ml-auto"
                    >
                      Undo
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {contributions.length > MAX_VISIBLE && !showAll && (
        <button
          type="button"
          onClick={() => { setShowAll(true); }}
          className="text-xs text-primary hover:underline mt-2"
        >
          Show all {contributions.length} contributions
        </button>
      )}

      {/* Undo confirm dialog */}
      <ConfirmDialog
        open={undoTarget !== null}
        onOpenChange={(open) => { if (!open) setUndoTarget(null); }}
        title="Undo contribution?"
        description={`This will remove the contribution of ${undoTarget ? formatCurrency(undoTarget.amount, currency) : ''} and delete the linked transaction.`}
        confirmLabel="Remove"
        destructive
        onConfirm={() => void handleUndo()}
      />
    </div>
  );
}
