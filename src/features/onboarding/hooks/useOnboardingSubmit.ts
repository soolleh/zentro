import { useCallback } from 'react';
import { useOnboardingStatus } from '@/app/stores/onboarding.store';
import type { Result } from '@/shared/types/common.types';

/**
 * Shared submit wrapper for all onboarding steps.
 *
 * Handles the setSubmitting / setStepError lifecycle so
 * each step only needs to invoke its business-logic callback.
 *
 * Returns `true` if the operation succeeded, `false` otherwise.
 */
export function useOnboardingSubmit() {
  const { setSubmitting, setStepError } = useOnboardingStatus();

  const submit = useCallback(
    async (fn: () => Promise<Result<unknown>>): Promise<boolean> => {
      setSubmitting(true);
      setStepError(null);
      try {
        const result = await fn();
        if (!result.success) {
          setStepError(result.error.message);
          return false;
        }
        return true;
      } finally {
        setSubmitting(false);
      }
    },
    [setSubmitting, setStepError]
  );

  return { submit };
}
