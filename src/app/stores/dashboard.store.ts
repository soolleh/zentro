/**
 * dashboard.store.ts
 *
 * Zustand store for dashboard data.
 * Loads all widgets in parallel. Insights load independently (slower).
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { UUID, ISODateString } from '@/shared/types/common.types';
import type {
  DashboardSummary,
  NetWorthHistoryPoint,
  BudgetUtilizationSummary,
  UpcomingBill,
  GoalProgressSummary,
  Insight,
  InsightWorkerInput,
} from '@/shared/types/dashboard.types';
import type { Transaction } from '@/shared/types/transaction.types';
import type { Category } from '@/shared/types/category.types';
import {
  getDashboardSummary,
  getNetWorthHistory,
  getBudgetUtilization,
  getUpcomingBills,
  getGoalProgress,
  getRecentTransactions,
  generateInsights,
} from '@/services/dashboard/dashboard.service';
import { categoryStorage } from '@/services/storage/category.storage';
import { useSessionStore } from '@/app/session.store';
import { usePreferencesStore } from '@/app/preferences.store';

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

type DashboardState = {
  summary: DashboardSummary | null;
  netWorthHistory: NetWorthHistoryPoint[];
  budgetUtilization: BudgetUtilizationSummary[];
  upcomingBills: UpcomingBill[];
  goalProgress: GoalProgressSummary[];
  recentTransactions: Transaction[];
  categories: Category[];
  insights: Insight[];
  isLoading: boolean;
  isInsightsLoading: boolean;
  lastRefreshedAt: ISODateString | null;
  error: string | null;
};

type DashboardActions = {
  loadDashboard: (userId: UUID) => Promise<void>;
  loadInsights: (userId: UUID) => Promise<void>;
  refresh: (userId: UUID) => Promise<void>;
  reset: () => void;
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const INITIAL_STATE: DashboardState = {
  summary: null,
  netWorthHistory: [],
  budgetUtilization: [],
  upcomingBills: [],
  goalProgress: [],
  recentTransactions: [],
  categories: [],
  insights: [],
  isLoading: false,
  isInsightsLoading: false,
  lastRefreshedAt: null,
  error: null,
};

export const useDashboardStore = create<DashboardState & DashboardActions>()((set, get) => ({
  ...INITIAL_STATE,

  // -------------------------------------------------------------------------
  // loadDashboard — fires all widget fetches in parallel
  // -------------------------------------------------------------------------
  async loadDashboard(userId: UUID): Promise<void> {
    const { derivedKey } = useSessionStore.getState();
    if (!derivedKey) {
      set({ error: 'No active session key. Please log in again.', isLoading: false });
      return;
    }

    const baseCurrency = usePreferencesStore.getState().baseCurrency;

    set({ isLoading: true, error: null });

    try {
      const [
        summaryResult,
        historyResult,
        budgetResult,
        billsResult,
        goalsResult,
        txResult,
        catsResult,
      ] = await Promise.all([
        getDashboardSummary(userId, derivedKey, baseCurrency),
        getNetWorthHistory(userId, derivedKey, 12),
        getBudgetUtilization(userId, derivedKey),
        getUpcomingBills(userId, derivedKey, 7),
        getGoalProgress(userId, derivedKey),
        getRecentTransactions(userId, derivedKey, 5),
        categoryStorage.listCategoriesByUser(userId, derivedKey),
      ]);

      set({
        summary: summaryResult.success ? summaryResult.data : null,
        netWorthHistory: historyResult.success ? historyResult.data : [],
        budgetUtilization: budgetResult.success ? budgetResult.data : [],
        upcomingBills: billsResult.success ? billsResult.data : [],
        goalProgress: goalsResult.success ? goalsResult.data : [],
        recentTransactions: txResult.success ? txResult.data : [],
        categories: catsResult.success ? catsResult.data : [],
        isLoading: false,
        lastRefreshedAt: new Date().toISOString() as ISODateString,
        error: !summaryResult.success ? summaryResult.error.message : null,
      });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load dashboard.',
      });
    }
  },

  // -------------------------------------------------------------------------
  // loadInsights — runs after main data is loaded, uses Web Worker
  // -------------------------------------------------------------------------
  async loadInsights(userId: UUID): Promise<void> {
    const { derivedKey } = useSessionStore.getState();
    if (!derivedKey) return;

    const baseCurrency = usePreferencesStore.getState().baseCurrency;
    const state = get();

    // Check if there were any transactions in the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const hasRecentTransactions = state.recentTransactions.some(
      (tx) => new Date(tx.date) >= sevenDaysAgo
    );

    const input: InsightWorkerInput = {
      budgetUtilization: state.budgetUtilization,
      upcomingBills: state.upcomingBills,
      goalProgress: state.goalProgress,
      currentMonthSavingsRate: state.summary?.currentMonth.savingsRate ?? 0,
      hasRecentTransactions,
      baseCurrency,
    };

    set({ isInsightsLoading: true });

    const result = await generateInsights(input);
    set({
      insights: result.success ? result.data : [],
      isInsightsLoading: false,
    });

    void userId; // suppress unused-variable warning
  },

  // -------------------------------------------------------------------------
  // refresh — clears and reloads everything
  // -------------------------------------------------------------------------
  async refresh(userId: UUID): Promise<void> {
    set({ ...INITIAL_STATE, isLoading: true });
    await get().loadDashboard(userId);
    await get().loadInsights(userId);
  },

  reset() {
    set(INITIAL_STATE);
  },
}));

// ---------------------------------------------------------------------------
// Selector hooks
// ---------------------------------------------------------------------------

export function useDashboardSummary() {
  return useDashboardStore(
    useShallow((s) => ({
      summary: s.summary,
      isLoading: s.isLoading,
      error: s.error,
    }))
  );
}

export function useNetWorthHistory() {
  return useDashboardStore(useShallow((s) => ({ netWorthHistory: s.netWorthHistory })));
}

export function useBudgetUtilization() {
  return useDashboardStore(useShallow((s) => ({ budgetUtilization: s.budgetUtilization })));
}

export function useUpcomingBills() {
  return useDashboardStore(useShallow((s) => ({ upcomingBills: s.upcomingBills })));
}

export function useGoalProgress() {
  return useDashboardStore(useShallow((s) => ({ goalProgress: s.goalProgress })));
}

export function useRecentTransactions() {
  return useDashboardStore(
    useShallow((s) => ({ recentTransactions: s.recentTransactions, categories: s.categories }))
  );
}

export function useInsights() {
  return useDashboardStore(
    useShallow((s) => ({ insights: s.insights, isInsightsLoading: s.isInsightsLoading }))
  );
}

export function useLastRefreshed() {
  return useDashboardStore(
    useShallow((s) => ({
      lastRefreshedAt: s.lastRefreshedAt,
      refresh: s.refresh,
    }))
  );
}
