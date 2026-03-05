/**
 * useGoalEnrichment.ts
 *
 * Convenience hook exposing sorted goal lists from the goal store.
 */

import { useGoalStore, useIncompleteGoals, useCompleteGoals } from '@/app/stores/goal.store';
import type { EnrichedGoal } from '@/shared/types/goal.types';

export type GoalEnrichmentReturn = {
  readonly allGoals: EnrichedGoal[];
  readonly incompleteGoals: EnrichedGoal[];
  readonly completeGoals: EnrichedGoal[];
  readonly isEmpty: boolean;
  readonly hasIncomplete: boolean;
};

export function useGoalEnrichment(): GoalEnrichmentReturn {
  const allGoals = useGoalStore((s) => s.goals);
  const incompleteGoals = useIncompleteGoals();
  const completeGoals = useCompleteGoals();

  return {
    allGoals,
    incompleteGoals,
    completeGoals,
    isEmpty: allGoals.length === 0,
    hasIncomplete: incompleteGoals.length > 0,
  };
}
