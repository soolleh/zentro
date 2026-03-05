import type { UUID, ISODateString } from './common.types';

// ---------------------------------------------------------------------------
// Report filter types
// ---------------------------------------------------------------------------

export type ReportFilters = {
  dateFrom: ISODateString;
  dateTo: ISODateString;
  accountIds: UUID[]; // empty = all accounts
  categoryIds: UUID[]; // empty = all categories
  compareEnabled: boolean;
  compareDateFrom: ISODateString;
  compareDateTo: ISODateString;
};

// ---------------------------------------------------------------------------
// Category breakdown
// ---------------------------------------------------------------------------

export type CategoryBreakdownItem = {
  categoryId: UUID;
  categoryName: string;
  categoryColor: string;
  amount: number;
  percentage: number; // of total expenses or income
  transactionCount: number;
};

// ---------------------------------------------------------------------------
// Monthly breakdown
// ---------------------------------------------------------------------------

export type MonthlyBreakdown = {
  month: ISODateString; // first day of the month
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number;
  categoryBreakdown: CategoryBreakdownItem[];
};

// ---------------------------------------------------------------------------
// Yearly overview
// ---------------------------------------------------------------------------

export type YearlyOverview = {
  year: number;
  months: MonthlyBreakdown[];
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  averageSavingsRate: number;
};

// ---------------------------------------------------------------------------
// Trends
// ---------------------------------------------------------------------------

export type TrendPoint = {
  date: ISODateString; // first day of month
  value: number;
  compareValue?: number; // populated when period comparison active
};

// ---------------------------------------------------------------------------
// Anomalies
// ---------------------------------------------------------------------------

export type AnomalyFlag = {
  transactionId: UUID;
  categoryId: UUID;
  categoryName: string;
  amount: number;
  date: ISODateString;
  rollingAverage: number;
  deviationPercent: number;
  severity: 'moderate' | 'high'; // moderate: 50–100% above avg, high: >100%
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export type ReportExportData = {
  generatedAt: ISODateString;
  filters: ReportFilters;
  monthlyBreakdown: MonthlyBreakdown[];
  categoryDistribution: CategoryBreakdownItem[];
  trends: TrendPoint[];
};
