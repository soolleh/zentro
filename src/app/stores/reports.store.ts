/**
 * reports.store.ts
 *
 * Zustand store for the Reports & Analytics module.
 * Follows the pattern from ui.store.ts.
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { UUID, ISODateString } from '@/shared/types/common.types';
import type {
  MonthlyBreakdown,
  YearlyOverview,
  CategoryBreakdownItem,
  TrendPoint,
  AnomalyFlag,
  ReportFilters,
} from '@/shared/types/reports.types';
import {
  getMonthlyBreakdown,
  getYearlyOverview,
  getCategoryDistribution,
  getIncomeExpenseTrend,
  getNetWorthTrend,
  getSavingsRateTrend,
  detectAnomalies,
} from '@/services/reports/reports.service';
import { useSessionStore } from '@/app/stores/session.store';

// ---------------------------------------------------------------------------
// Default filter values
// ---------------------------------------------------------------------------

function getDefaultFilters(): ReportFilters {
  const now = new Date();
  const year = now.getFullYear();
  const prevYear = year - 1;

  const today = now.toISOString().slice(0, 10);

  return {
    dateFrom: `${String(year)}-01-01T00:00:00.000Z` as ISODateString,
    dateTo: `${today}T23:59:59.999Z` as ISODateString,
    accountIds: [],
    categoryIds: [],
    compareEnabled: false,
    compareDateFrom: `${String(prevYear)}-01-01T00:00:00.000Z` as ISODateString,
    compareDateTo: `${String(prevYear)}-12-31T23:59:59.999Z` as ISODateString,
  };
}

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

type ReportsState = {
  filters: ReportFilters;
  monthlyBreakdown: MonthlyBreakdown[];
  yearlyOverview: YearlyOverview | null;
  selectedYear: number;
  categoryDistribution: CategoryBreakdownItem[];
  categoryDistributionType: 'expense' | 'income';
  incomeTrend: TrendPoint[];
  expenseTrend: TrendPoint[];
  netWorthTrend: TrendPoint[];
  savingsRateTrend: TrendPoint[];
  anomalies: AnomalyFlag[];
  isLoading: boolean;
  isYearlyLoading: boolean;
  isAnomalyLoading: boolean;
  errors: Record<string, string>;
};

type ReportsActions = {
  setFilters: (filters: Partial<ReportFilters>) => void;
  setSelectedYear: (year: number) => void;
  setCategoryDistributionType: (type: 'expense' | 'income') => void;
  loadAllReports: (userId: UUID) => Promise<void>;
  loadYearlyOverview: (userId: UUID) => Promise<void>;
  loadAnomalies: (userId: UUID) => Promise<void>;
  loadCategoryDistribution: (userId: UUID) => Promise<void>;
};

const DEFAULTS: ReportsState = {
  filters: getDefaultFilters(),
  monthlyBreakdown: [],
  yearlyOverview: null,
  selectedYear: new Date().getFullYear(),
  categoryDistribution: [],
  categoryDistributionType: 'expense',
  incomeTrend: [],
  expenseTrend: [],
  netWorthTrend: [],
  savingsRateTrend: [],
  anomalies: [],
  isLoading: false,
  isYearlyLoading: false,
  isAnomalyLoading: false,
  errors: {},
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useReportsStore = create<ReportsState & ReportsActions>((set, get) => ({
  ...DEFAULTS,

  setFilters(partial) {
    const next = { ...get().filters, ...partial };
    set({ filters: next });
    const userId = useSessionStore.getState().currentUser?.id;
    if (userId) {
      void get().loadAllReports(userId);
    }
  },

  setSelectedYear(year) {
    set({ selectedYear: year });
    const userId = useSessionStore.getState().currentUser?.id;
    if (userId) {
      void get().loadYearlyOverview(userId);
    }
  },

  setCategoryDistributionType(type) {
    set({ categoryDistributionType: type });
    const userId = useSessionStore.getState().currentUser?.id;
    if (userId) {
      void get().loadCategoryDistribution(userId);
    }
  },

  async loadAllReports(userId) {
    const { derivedKey } = useSessionStore.getState();
    if (!derivedKey) return;

    const { filters, categoryDistributionType } = get();
    set({ isLoading: true });

    // Fire all non-worker reports in parallel
    const [monthlyResult, categoryResult, trendResult, netWorthResult, savingsRateResult] =
      await Promise.all([
        getMonthlyBreakdown(userId, derivedKey, filters),
        getCategoryDistribution(userId, derivedKey, filters, categoryDistributionType),
        getIncomeExpenseTrend(userId, derivedKey, 12, filters),
        getNetWorthTrend(userId, derivedKey, 12, filters),
        getSavingsRateTrend(userId, derivedKey, 12, filters),
      ]);

    const newErrors: Record<string, string> = {};

    set({
      monthlyBreakdown: monthlyResult.success ? monthlyResult.data : get().monthlyBreakdown,
      categoryDistribution: categoryResult.success
        ? categoryResult.data
        : get().categoryDistribution,
      incomeTrend: trendResult.success ? trendResult.data.incomeTrend : get().incomeTrend,
      expenseTrend: trendResult.success ? trendResult.data.expenseTrend : get().expenseTrend,
      netWorthTrend: netWorthResult.success ? netWorthResult.data : get().netWorthTrend,
      savingsRateTrend: savingsRateResult.success ? savingsRateResult.data : get().savingsRateTrend,
      isLoading: false,
      errors: newErrors,
    });

    if (!monthlyResult.success) newErrors['monthly'] = monthlyResult.error.message;
    if (!categoryResult.success) newErrors['category'] = categoryResult.error.message;
    if (!trendResult.success) newErrors['trend'] = trendResult.error.message;
    if (!netWorthResult.success) newErrors['netWorth'] = netWorthResult.error.message;
    if (!savingsRateResult.success) newErrors['savingsRate'] = savingsRateResult.error.message;

    if (Object.keys(newErrors).length > 0) {
      set({ errors: newErrors });
    }

    // Fire worker reports independently
    void get().loadYearlyOverview(userId);
    void get().loadAnomalies(userId);
  },

  async loadYearlyOverview(userId) {
    const { derivedKey } = useSessionStore.getState();
    if (!derivedKey) return;

    const { selectedYear, filters } = get();
    set({ isYearlyLoading: true });

    const result = await getYearlyOverview(userId, derivedKey, selectedYear, filters);

    set({
      isYearlyLoading: false,
      yearlyOverview: result.success ? result.data : get().yearlyOverview,
      errors: result.success
        ? { ...get().errors }
        : { ...get().errors, yearly: result.error.message },
    });
  },

  async loadAnomalies(userId) {
    const { derivedKey } = useSessionStore.getState();
    if (!derivedKey) return;

    const { filters } = get();
    set({ isAnomalyLoading: true });

    const result = await detectAnomalies(userId, derivedKey, filters);

    set({
      isAnomalyLoading: false,
      anomalies: result.success ? result.data : get().anomalies,
      errors: result.success
        ? { ...get().errors }
        : { ...get().errors, anomalies: result.error.message },
    });
  },

  async loadCategoryDistribution(userId) {
    const { derivedKey } = useSessionStore.getState();
    if (!derivedKey) return;

    const { filters, categoryDistributionType } = get();

    const result = await getCategoryDistribution(
      userId,
      derivedKey,
      filters,
      categoryDistributionType
    );
    if (result.success) {
      set({ categoryDistribution: result.data });
    } else {
      set({ errors: { ...get().errors, category: result.error.message } });
    }
  },
}));

// ---------------------------------------------------------------------------
// Selector hooks
// ---------------------------------------------------------------------------

export function useReportFilters() {
  return useReportsStore(
    useShallow((s) => ({
      filters: s.filters,
      setFilters: s.setFilters,
    }))
  );
}

export function useMonthlyBreakdown() {
  return useReportsStore(
    useShallow((s) => ({
      monthlyBreakdown: s.monthlyBreakdown,
      isLoading: s.isLoading,
    }))
  );
}

export function useYearlyOverview() {
  return useReportsStore(
    useShallow((s) => ({
      yearlyOverview: s.yearlyOverview,
      selectedYear: s.selectedYear,
      isYearlyLoading: s.isYearlyLoading,
      setSelectedYear: s.setSelectedYear,
    }))
  );
}

export function useCategoryDistribution() {
  return useReportsStore(
    useShallow((s) => ({
      categoryDistribution: s.categoryDistribution,
      categoryDistributionType: s.categoryDistributionType,
      setCategoryDistributionType: s.setCategoryDistributionType,
    }))
  );
}

export function useTrends() {
  return useReportsStore(
    useShallow((s) => ({
      incomeTrend: s.incomeTrend,
      expenseTrend: s.expenseTrend,
      netWorthTrend: s.netWorthTrend,
      savingsRateTrend: s.savingsRateTrend,
    }))
  );
}

export function useAnomalies() {
  return useReportsStore(
    useShallow((s) => ({
      anomalies: s.anomalies,
      isAnomalyLoading: s.isAnomalyLoading,
    }))
  );
}

export function useReportErrors() {
  return useReportsStore(useShallow((s) => ({ errors: s.errors })));
}
