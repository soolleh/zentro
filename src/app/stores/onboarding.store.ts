import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { Account } from '@/shared/types/account.types';
import type { Transaction } from '@/shared/types/transaction.types';
import type { Budget } from '@/shared/types/budget.types';

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

type OnboardingStep = 1 | 2 | 3 | 4;

type OnboardingState = {
  readonly currentStep: OnboardingStep;
  readonly direction: 'forward' | 'backward';
  readonly createdAccount: Account | null;
  readonly createdTransaction: Transaction | null;
  readonly createdBudget: Budget | null;
  readonly isSubmitting: boolean;
  readonly stepError: string | null;
};

type OnboardingActions = {
  goToStep: (step: OnboardingStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  setCreatedAccount: (account: Account) => void;
  setCreatedTransaction: (tx: Transaction) => void;
  setCreatedBudget: (budget: Budget) => void;
  setSubmitting: (value: boolean) => void;
  setStepError: (error: string | null) => void;
  reset: () => void;
};

const INITIAL: OnboardingState = {
  currentStep: 1,
  direction: 'forward',
  createdAccount: null,
  createdTransaction: null,
  createdBudget: null,
  isSubmitting: false,
  stepError: null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useOnboardingStore = create<OnboardingState & OnboardingActions>((set, get) => ({
  ...INITIAL,

  goToStep(step) {
    const current = get().currentStep;
    set({ currentStep: step, direction: step > current ? 'forward' : 'backward', stepError: null });
  },

  nextStep() {
    const current = get().currentStep;
    if (current >= 4) return;
    set({ currentStep: (current + 1) as OnboardingStep, direction: 'forward', stepError: null });
  },

  prevStep() {
    const current = get().currentStep;
    if (current <= 1) return;
    set({ currentStep: (current - 1) as OnboardingStep, direction: 'backward', stepError: null });
  },

  setCreatedAccount(account) {
    set({ createdAccount: account });
  },

  setCreatedTransaction(tx) {
    set({ createdTransaction: tx });
  },

  setCreatedBudget(budget) {
    set({ createdBudget: budget });
  },

  setSubmitting(value) {
    set({ isSubmitting: value });
  },

  setStepError(error) {
    set({ stepError: error });
  },

  reset() {
    set(INITIAL);
  },
}));

// ---------------------------------------------------------------------------
// Selector hooks
// ---------------------------------------------------------------------------

export function useOnboardingStep() {
  return useOnboardingStore(
    useShallow((s) => ({
      currentStep: s.currentStep,
      direction: s.direction,
      nextStep: s.nextStep,
      prevStep: s.prevStep,
      goToStep: s.goToStep,
    }))
  );
}

export function useOnboardingData() {
  return useOnboardingStore(
    useShallow((s) => ({
      createdAccount: s.createdAccount,
      createdTransaction: s.createdTransaction,
      createdBudget: s.createdBudget,
    }))
  );
}

export function useOnboardingStatus() {
  return useOnboardingStore(
    useShallow((s) => ({
      isSubmitting: s.isSubmitting,
      stepError: s.stepError,
      setSubmitting: s.setSubmitting,
      setStepError: s.setStepError,
    }))
  );
}
