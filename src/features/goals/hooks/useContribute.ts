/**
 * useContribute.ts
 *
 * Thin wrapper hook for goal contribution submission.
 * Encapsulates loading state and error handling for
 * components that manage their own form state.
 */

import { useState, useCallback } from 'react';
import { contribute } from '@/services/goals/goal.service';
import { useShallow } from 'zustand/react/shallow';
import { useGoalStore } from '@/app/stores/goal.store';
import { useCurrentUser } from '@/app/stores/session.store';
import { useUIStore } from '@/app/ui.store';
import { formatCurrency } from '@/shared/utils/currency.utils';
import type { Currency } from '@/shared/types/common.types';
import type { ContributeParams } from '@/shared/types/goal.types';

export type ContributeSubmitParams = ContributeParams;

export type UseContributeReturn = {
  readonly isSubmitting: boolean;
  readonly submit: (params: ContributeSubmitParams, currency: Currency) => Promise<boolean>;
};

export function useContribute(): UseContributeReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentUser = useCurrentUser();
  const { refreshGoal, setCelebrating } = useGoalStore(
    useShallow((s) => ({ refreshGoal: s.refreshGoal, setCelebrating: s.setCelebrating }))
  );
  const addToast = useUIStore((s) => s.addToast);

  const submit = useCallback(
    async (params: ContributeSubmitParams, currency: Currency): Promise<boolean> => {
      if (!currentUser) return false;
      setIsSubmitting(true);
      try {
        const result = await contribute(currentUser.id, params);
        if (!result.success) {
          addToast({ message: result.error.message, type: 'error' });
          return false;
        }

        const { milestonesReached } = result.data;
        milestonesReached.forEach((m) => {
          addToast({
            message: `Milestone: ${String(m.percent)}% reached – ${formatCurrency(m.amount, currency)}!`,
            type: 'success',
          });
        });

        await refreshGoal(currentUser.id, params.goalId);

        if (milestonesReached.some((m) => m.percent === 100)) {
          setCelebrating(params.goalId);
        }

        return true;
      } finally {
        setIsSubmitting(false);
      }
    },
    [currentUser, refreshGoal, setCelebrating, addToast]
  );

  return { isSubmitting, submit };
}
