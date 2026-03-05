import { useEffect, useState } from 'react';
import { Plus, ChevronDown, ChevronUp, Target } from 'lucide-react';
import { FeaturedGoalCard } from '../components/FeaturedGoalCard';
import { GoalSelectorStrip } from '../components/GoalSelectorStrip';
import { GoalListRow } from '../components/GoalListRow';
import { GoalDetailPanel } from '../components/GoalDetailPanel';
import { ContributePanel } from '../components/ContributePanel';
import { GoalForm } from '../components/GoalForm';
import { GoalCelebrationOverlay } from '../components/GoalCelebrationOverlay';
import {
  useGoalStore,
  useGoals,
  useFeaturedGoal,
  useIncompleteGoals,
  useCompleteGoals,
  useGoalPanel,
} from '@/app/stores/goal.store';
import { useCurrentUser } from '@/app/stores/session.store';

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export function GoalsPage() {
  const currentUser = useCurrentUser();
  const loadGoals = useGoalStore((s) => s.loadGoals);
  const { goals, isLoading } = useGoals();
  const { featuredGoal } = useFeaturedGoal();
  const incompleteGoals = useIncompleteGoals();
  const completeGoals = useCompleteGoals();
  const { openPanel } = useGoalPanel();

  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    void loadGoals(currentUser.id);
  }, [currentUser, loadGoals]);

  // Goals excluding the featured one
  const otherIncompleteGoals = incompleteGoals.filter(
    (g) => g.goal.id !== featuredGoal?.goal.id
  );

  return (
    <div className="min-h-full px-4 pt-6 pb-24 sm:px-6 sm:py-6 lg:px-8 lg:py-8 lg:max-w-4xl lg:mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Goals</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track and grow your savings targets
          </p>
        </div>
        {/* Desktop new goal button */}
        <button
          type="button"
          onClick={() => { openPanel('add'); }}
          className="hidden sm:flex items-center gap-2 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.98] transition-all duration-150"
        >
          <Plus className="w-4 h-4" />
          New goal
        </button>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-48 rounded-2xl bg-muted/50 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && goals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <Target className="w-8 h-8 text-muted-foreground/60" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">No goals yet</h2>
          <p className="text-sm text-muted-foreground max-w-xs mb-6">
            Create your first savings goal to start tracking progress toward what matters most.
          </p>
          <button
            type="button"
            onClick={() => { openPanel('add'); }}
            className="flex items-center gap-2 h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all duration-150"
          >
            <Plus className="w-4 h-4" />
            Create a goal
          </button>
        </div>
      )}

      {/* Goal content */}
      {!isLoading && goals.length > 0 && (
        <div className="flex flex-col gap-5">
          {/* Featured goal */}
          {featuredGoal && <FeaturedGoalCard enriched={featuredGoal} />}

          {/* Goal selector strip (only if 2+ incomplete) */}
          {incompleteGoals.length >= 2 && <GoalSelectorStrip incompleteGoals={incompleteGoals} />}

          {/* Other incomplete goals */}
          {otherIncompleteGoals.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
                Other goals
              </p>
              <div className="flex flex-col gap-2">
                {otherIncompleteGoals.map((enriched) => (
                  <GoalListRow key={enriched.goal.id} enriched={enriched} />
                ))}
              </div>
            </div>
          )}

          {/* Completed goals section */}
          {completeGoals.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => { setShowCompleted((v) => !v); }}
                className="flex items-center gap-2 w-full text-left py-2 px-1 rounded-lg hover:bg-muted/40 transition-colors duration-150"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Completed
                </span>
                <span className="text-xs font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full">
                  {completeGoals.length}
                </span>
                {showCompleted ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground ml-auto" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />
                )}
              </button>
              {showCompleted && (
                <div className="flex flex-col gap-2 mt-2">
                  {completeGoals.map((enriched) => (
                    <GoalListRow key={enriched.goal.id} enriched={enriched} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mobile FAB */}
      <button
        type="button"
        onClick={() => { openPanel('add'); }}
        className="sm:hidden fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-[0.97] transition-all duration-150 z-30"
        aria-label="Create new goal"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Panels */}
      <GoalDetailPanel />
      <ContributePanel />
      <GoalForm />
      <GoalCelebrationOverlay />
    </div>
  );
}
