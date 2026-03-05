/**
 * budget.store.ts
 *
 * Zustand store for the Budgets module.
 * Follows the pattern from reports.store.ts / transaction.store.ts.
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { UUID, ISODateString } from '@/shared/types/common.types';
import type {
  Budget,
  BudgetCycleUtilization,
  EnrichedBudget,
  SpendingVelocity,
} from '@/shared/types/budget.types';
import {
  getCycleDates,
  getAdjacentCycle,
  getBudgetUtilizationForCycle,
  ensureBudgetsForCycle,
} from '@/services/budgets/budget.service';
import { useSessionStore } from '@/app/stores/session.store';
import { usePreferencesStore } from '@/app/preferences.store';

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

type BudgetState = {
  cycleUtilization: BudgetCycleUtilization | null;
  viewingCycleStart: ISODateString;
  currentCycleStart: ISODateString;
  isLoading: boolean;
  isCurrentCycle: boolean;
  editingBudgetId: UUID | null;
  isPanelOpen: boolean;
  panelMode: 'add' | 'edit';
  activeBudget: Budget | null;
};

type BudgetActions = {
  initBudgets: (userId: UUID, cycleStartDay: number) => Promise<void>;
  loadCycle: (userId: UUID, cycleStart: ISODateString) => Promise<void>;
  navigateToCycle: (userId: UUID, direction: 'prev' | 'next') => Promise<void>;
  navigateToCurrentCycle: (userId: UUID) => Promise<void>;
  setEditingBudget: (budgetId: UUID | null) => void;
  openPanel: (mode: 'add' | 'edit', budget?: Budget) => void;
  closePanel: () => void;
  updateBudgetInList: (budget: Budget) => void;
  removeBudgetFromList: (budgetId: UUID) => void;
  addBudgetToList: (enriched: EnrichedBudget) => void;
};

const TODAY_ISO = new Date().toISOString() as ISODateString;

const DEFAULTS: BudgetState = {
  cycleUtilization: null,
  viewingCycleStart: TODAY_ISO,
  currentCycleStart: TODAY_ISO,
  isLoading: false,
  isCurrentCycle: true,
  editingBudgetId: null,
  isPanelOpen: false,
  panelMode: 'add',
  activeBudget: null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useBudgetStore = create<BudgetState & BudgetActions>((set, get) => ({
  ...DEFAULTS,

  async initBudgets(userId, cycleStartDay) {
    const today = new Date().toISOString() as ISODateString;
    const cycleDates = getCycleDates(today, cycleStartDay);
    const currentCycleStart = cycleDates.cycleStart;

    set({
      currentCycleStart,
      viewingCycleStart: currentCycleStart,
      isCurrentCycle: true,
    });

    const key = useSessionStore.getState().derivedKey;
    if (!key) return;

    await ensureBudgetsForCycle(userId, currentCycleStart, cycleStartDay, key);
    await get().loadCycle(userId, currentCycleStart);
  },

  async loadCycle(userId, cycleStart) {
    const key = useSessionStore.getState().derivedKey;
    const { baseCurrency, budgetCycleStartDay } = usePreferencesStore.getState();
    if (!key) return;

    set({ isLoading: true });

    const cycleDates = getCycleDates(cycleStart, budgetCycleStartDay);
    const result = await getBudgetUtilizationForCycle(
      userId,
      cycleDates.cycleStart,
      cycleDates.cycleEnd,
      key,
      baseCurrency
    );

    const { currentCycleStart } = get();
    set({
      isLoading: false,
      viewingCycleStart: cycleStart,
      isCurrentCycle: cycleStart === currentCycleStart,
    });

    if (result.success) {
      set({ cycleUtilization: result.data });
    }
  },

  async navigateToCycle(userId, direction) {
    const { viewingCycleStart } = get();
    const { budgetCycleStartDay } = usePreferencesStore.getState();
    const adjacent = getAdjacentCycle(viewingCycleStart, direction, budgetCycleStartDay);
    await get().loadCycle(userId, adjacent.cycleStart);
  },

  async navigateToCurrentCycle(userId) {
    const { currentCycleStart } = get();
    await get().loadCycle(userId, currentCycleStart);
  },

  setEditingBudget(budgetId) {
    set({ editingBudgetId: budgetId });
  },

  openPanel(mode, budget) {
    set({
      isPanelOpen: true,
      panelMode: mode,
      activeBudget: budget ?? null,
      editingBudgetId: null,
    });
  },

  closePanel() {
    set({ isPanelOpen: false, activeBudget: null });
  },

  updateBudgetInList(budget) {
    set((state) => {
      if (!state.cycleUtilization) return state;
      const updatedBudgets = state.cycleUtilization.budgets.map((eb): EnrichedBudget => {
        if (eb.budget.id !== budget.id) return eb;
        const effectiveAmount = budget.amount + eb.carryForwardAmount;
        const remaining = effectiveAmount - eb.spent;
        const percentUsed = effectiveAmount > 0 ? (eb.spent / effectiveAmount) * 100 : 0;
        const isOverBudget = eb.spent > effectiveAmount;
        const isAlertTriggered = !isOverBudget && percentUsed >= budget.alertThreshold;
        const projectedPercentUsed =
          effectiveAmount > 0 ? (eb.velocity.projectedTotal / effectiveAmount) * 100 : 0;
        const velocity: SpendingVelocity = {
          ...eb.velocity,
          projectedPercentUsed,
          isOnTrack: eb.velocity.projectedTotal <= effectiveAmount,
        };
        return {
          ...eb,
          budget,
          effectiveAmount,
          remaining,
          percentUsed,
          isOverBudget,
          isAlertTriggered,
          velocity,
        };
      });
      const totalAllocated = updatedBudgets.reduce((s, b) => s + b.effectiveAmount, 0);
      const totalSpent = updatedBudgets.reduce((s, b) => s + b.spent, 0);
      const totalRemaining = totalAllocated - totalSpent;
      const overallUtilization = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;
      const hasOverspend = updatedBudgets.some((b) => b.isOverBudget);
      return {
        cycleUtilization: {
          ...state.cycleUtilization,
          budgets: updatedBudgets,
          totalAllocated,
          totalSpent,
          totalRemaining,
          overallUtilization,
          hasOverspend,
        },
      };
    });
  },

  removeBudgetFromList(budgetId) {
    set((state) => {
      if (!state.cycleUtilization) return state;
      const updatedBudgets = state.cycleUtilization.budgets.filter(
        (eb) => eb.budget.id !== budgetId
      );
      const totalAllocated = updatedBudgets.reduce((s, b) => s + b.effectiveAmount, 0);
      const totalSpent = updatedBudgets.reduce((s, b) => s + b.spent, 0);
      const totalRemaining = totalAllocated - totalSpent;
      const overallUtilization = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;
      const hasOverspend = updatedBudgets.some((b) => b.isOverBudget);
      return {
        cycleUtilization: {
          ...state.cycleUtilization,
          budgets: updatedBudgets,
          totalAllocated,
          totalSpent,
          totalRemaining,
          overallUtilization,
          hasOverspend,
        },
      };
    });
  },

  addBudgetToList(enriched) {
    set((state) => {
      if (!state.cycleUtilization) return state;
      const updatedBudgets = [...state.cycleUtilization.budgets, enriched];
      const totalAllocated = updatedBudgets.reduce((s, b) => s + b.effectiveAmount, 0);
      const totalSpent = updatedBudgets.reduce((s, b) => s + b.spent, 0);
      const totalRemaining = totalAllocated - totalSpent;
      const overallUtilization = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;
      const hasOverspend = updatedBudgets.some((b) => b.isOverBudget);
      return {
        cycleUtilization: {
          ...state.cycleUtilization,
          budgets: updatedBudgets,
          totalAllocated,
          totalSpent,
          totalRemaining,
          overallUtilization,
          hasOverspend,
        },
      };
    });
  },
}));

// ---------------------------------------------------------------------------
// Selector hooks
// ---------------------------------------------------------------------------

export function useBudgetCycle() {
  return useBudgetStore(
    useShallow((s) => ({
      cycleUtilization: s.cycleUtilization,
      isLoading: s.isLoading,
      isCurrentCycle: s.isCurrentCycle,
    }))
  );
}

export function useBudgetNavigation() {
  return useBudgetStore(
    useShallow((s) => ({
      viewingCycleStart: s.viewingCycleStart,
      navigateToCycle: s.navigateToCycle,
      navigateToCurrentCycle: s.navigateToCurrentCycle,
    }))
  );
}

export function useBudgetPanel() {
  return useBudgetStore(
    useShallow((s) => ({
      isPanelOpen: s.isPanelOpen,
      panelMode: s.panelMode,
      activeBudget: s.activeBudget,
      openPanel: s.openPanel,
      closePanel: s.closePanel,
    }))
  );
}

export function useInlineEdit() {
  return useBudgetStore(
    useShallow((s) => ({
      editingBudgetId: s.editingBudgetId,
      setEditingBudget: s.setEditingBudget,
    }))
  );
}
