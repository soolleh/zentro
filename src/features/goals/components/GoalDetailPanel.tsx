import { X, Plus, Pencil, Target, Wallet } from 'lucide-react';
import { SlidePanel } from '@/shared/components/SlidePanel';
import { GoalProgressRing } from './GoalProgressRing';
import { MilestoneTracker } from './MilestoneTracker';
import { ContributionTimeline } from './ContributionTimeline';
import { GoalProjectionCard } from './GoalProjectionCard';
import { useGoalPanel } from '@/app/stores/goal.store';
import { formatCurrency } from '@/shared/utils/currency.utils';

export function GoalDetailPanel() {
  const { isPanelOpen, panelMode, activeGoal, openPanel, closePanel } = useGoalPanel();
  const isOpen = isPanelOpen && panelMode === 'detail';

  const goal = activeGoal?.goal;
  const enriched = activeGoal;

  if (!goal || !enriched) return null;

  const {
    totalContributed,
    percentComplete,
    remainingAmount,
    isComplete,
    milestones,
    projection,
    linkedAccount,
    contributions,
  } = enriched;

  return (
    <SlidePanel open={isOpen} onClose={closePanel} size="lg">
      {/* Sticky custom header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-card border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
            style={{ backgroundColor: `${goal.color}26` }}
          >
            {goal.emoji ? (
              <span>{goal.emoji}</span>
            ) : (
              <Target className="w-5 h-5" style={{ color: goal.color }} />
            )}
          </div>
          <p className="font-semibold text-base text-foreground truncate">{goal.name}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isComplete && (
            <button
              type="button"
              onClick={() => { openPanel('contribute', enriched); }}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 active:scale-[0.98] transition-all duration-150"
            >
              <Plus className="w-3.5 h-3.5" />
              Contribute
            </button>
          )}
          <button
            type="button"
            onClick={() => { openPanel('edit', enriched); }}
            className="p-2 rounded-lg hover:bg-muted/60 transition-colors duration-150"
            aria-label="Edit goal"
          >
            <Pencil className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={closePanel}
            className="p-2 rounded-lg hover:bg-muted/60 transition-colors duration-150"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-6 px-6 py-6 overflow-y-auto">
        {/* Section 1: ring + summary stats */}
        <div className="flex flex-col items-center gap-4 py-2">
          <GoalProgressRing
            percentComplete={percentComplete}
            goalColor={goal.color}
            milestones={milestones}
            size="md"
          />
          <div className="grid grid-cols-3 gap-3 w-full">
            <div className="rounded-xl bg-muted/40 px-3 py-3 text-center">
              <p className="text-[11px] text-muted-foreground mb-1">Saved</p>
              <p className="text-sm font-bold tabular-nums text-foreground">
                {formatCurrency(totalContributed, goal.currency)}
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 px-3 py-3 text-center">
              <p className="text-[11px] text-muted-foreground mb-1">Remaining</p>
              <p className="text-sm font-bold tabular-nums text-foreground">
                {isComplete ? '—' : formatCurrency(remainingAmount, goal.currency)}
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 px-3 py-3 text-center">
              <p className="text-[11px] text-muted-foreground mb-1">Progress</p>
              <p className="text-sm font-bold tabular-nums text-foreground">
                {percentComplete.toFixed(0)}%
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Milestones */}
        <div>
          <p className="text-sm font-semibold text-foreground mb-3">Milestones</p>
          <MilestoneTracker
            milestones={milestones}
            goalColor={goal.color}
            currency={goal.currency}
          />
        </div>

        {/* Section 3: Projection */}
        {!isComplete && (
          <div>
            <p className="text-sm font-semibold text-foreground mb-3">Projection</p>
            <GoalProjectionCard
              projection={projection}
              goalColor={goal.color}
              currency={goal.currency}
              targetDate={goal.targetDate}
              isComplete={isComplete}
            />
          </div>
        )}

        {/* Section 4: Linked account */}
        {linkedAccount && (
          <div className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 bg-muted/20">
            <Wallet className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Linked savings account</p>
              <p className="text-sm font-medium text-foreground">{linkedAccount.name}</p>
            </div>
          </div>
        )}

        {/* Section 5: Contribution timeline */}
        <div>
          <p className="text-sm font-semibold text-foreground mb-3">Contributions</p>
          <ContributionTimeline
            contributions={contributions}
            milestones={milestones}
            goalColor={goal.color}
            goalEmoji={goal.emoji}
            goalId={goal.id}
            currency={goal.currency}
          />
        </div>
      </div>
    </SlidePanel>
  );
}
