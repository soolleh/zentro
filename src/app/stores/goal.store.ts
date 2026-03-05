/**
 * goal.store.ts
 *
 * Zustand store for the Goals module.
 * Follows the pattern from account.store.ts.
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { UUID } from '@/shared/types/common.types';
import type { EnrichedGoal } from '@/shared/types/goal.types';
import { getAllEnrichedGoals, refreshEnrichedGoal } from '@/services/goals/goal.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PanelMode = 'detail' | 'add' | 'edit' | 'contribute';

type GoalState = {
  goals: EnrichedGoal[];
  isLoading: boolean;
  featuredGoalId: UUID | null;
  activeGoal: EnrichedGoal | null;
  isPanelOpen: boolean;
  panelMode: PanelMode;
  isSubmitting: boolean;
  celebratingGoalId: UUID | null;
};

type GoalActions = {
  loadGoals: (userId: UUID) => Promise<void>;
  openPanel: (mode: PanelMode, goal?: EnrichedGoal) => void;
  closePanel: () => void;
  setFeaturedGoal: (goalId: UUID) => void;
  addGoalToList: (enriched: EnrichedGoal) => void;
  updateGoalInList: (enriched: EnrichedGoal) => void;
  removeGoalFromList: (goalId: UUID) => void;
  setCelebrating: (goalId: UUID | null) => void;
  refreshGoal: (userId: UUID, goalId: UUID) => Promise<void>;
  setSubmitting: (submitting: boolean) => void;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULTS: GoalState = {
  goals: [],
  isLoading: false,
  featuredGoalId: null,
  activeGoal: null,
  isPanelOpen: false,
  panelMode: 'detail',
  isSubmitting: false,
  celebratingGoalId: null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useGoalStore = create<GoalState & GoalActions>((set, get) => ({
  ...DEFAULTS,

  async loadGoals(userId) {
    set({ isLoading: true });
    const result = await getAllEnrichedGoals(userId);
    if (result.success) {
      const incompleteGoals = result.data.filter((g) => !g.isComplete);
      const featuredGoalId = incompleteGoals.length > 0 ? incompleteGoals[0].goal.id : null;
      set({ goals: result.data, isLoading: false, featuredGoalId });
    } else {
      set({ isLoading: false });
    }
  },

  openPanel(mode, goal) {
    set({
      isPanelOpen: true,
      panelMode: mode,
      activeGoal: goal ?? null,
    });
  },

  closePanel() {
    set({ isPanelOpen: false, activeGoal: null });
  },

  setFeaturedGoal(goalId) {
    set({ featuredGoalId: goalId });
  },

  addGoalToList(enriched) {
    set((state) => ({ goals: [enriched, ...state.goals] }));
  },

  updateGoalInList(enriched) {
    set((state) => ({
      goals: state.goals.map((g) => (g.goal.id === enriched.goal.id ? enriched : g)),
      activeGoal: state.activeGoal?.goal.id === enriched.goal.id ? enriched : state.activeGoal,
    }));
  },

  removeGoalFromList(goalId) {
    set((state) => {
      const filtered = state.goals.filter((g) => g.goal.id !== goalId);
      const incompleteGoals = filtered.filter((g) => !g.isComplete);
      const newFeaturedId =
        state.featuredGoalId === goalId
          ? incompleteGoals.length > 0
            ? incompleteGoals[0].goal.id
            : null
          : state.featuredGoalId;
      return {
        goals: filtered,
        featuredGoalId: newFeaturedId,
        activeGoal: state.activeGoal?.goal.id === goalId ? null : state.activeGoal,
        isPanelOpen: state.activeGoal?.goal.id === goalId ? false : state.isPanelOpen,
      };
    });
  },

  setCelebrating(goalId) {
    set({ celebratingGoalId: goalId });
  },

  async refreshGoal(userId, goalId) {
    const result = await refreshEnrichedGoal(userId, goalId);
    if (result.success) {
      get().updateGoalInList(result.data);
    }
  },

  setSubmitting(submitting) {
    set({ isSubmitting: submitting });
  },
}));

// ---------------------------------------------------------------------------
// Selector hooks
// ---------------------------------------------------------------------------

export function useGoals() {
  return useGoalStore(useShallow((s) => ({ goals: s.goals, isLoading: s.isLoading })));
}

export function useFeaturedGoal() {
  return useGoalStore(
    useShallow((s) => ({
      featuredGoal: s.goals.find((g) => g.goal.id === s.featuredGoalId) ?? null,
      setFeaturedGoal: s.setFeaturedGoal,
    }))
  );
}

export function useGoalPanel() {
  return useGoalStore(
    useShallow((s) => ({
      isPanelOpen: s.isPanelOpen,
      panelMode: s.panelMode,
      activeGoal: s.activeGoal,
      openPanel: s.openPanel,
      closePanel: s.closePanel,
    }))
  );
}

export function useIncompleteGoals(): EnrichedGoal[] {
  return useGoalStore((s) => s.goals.filter((g) => !g.isComplete));
}

export function useCompleteGoals(): EnrichedGoal[] {
  return useGoalStore((s) => s.goals.filter((g) => g.isComplete));
}

export function useCelebrating() {
  return useGoalStore(
    useShallow((s) => ({
      celebratingGoalId: s.celebratingGoalId,
      setCelebrating: s.setCelebrating,
    }))
  );
}
