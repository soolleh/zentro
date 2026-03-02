/**
 * dashboard.types.ts
 *
 * Shared types for the Dashboard module.
 */

import type { ISODateString, Currency } from './common.types';
import type { Account, NetWorthSummary } from './account.types';
import type { Budget } from './budget.types';
import type { Category } from './category.types';
import type { Bill, BillEntry } from './bill.types';
import type { Goal } from './goal.types';

// ---------------------------------------------------------------------------
// Summary types
// ---------------------------------------------------------------------------

export type MonthSummary = {
  readonly income: number;
  readonly expenses: number;
  /** (income - expenses) / income * 100, clamped 0–100. 0 when income is 0. */
  readonly savingsRate: number;
  readonly transactionCount: number;
  /** ISO date string for the first day of this month. */
  readonly month: ISODateString;
};

export type DashboardSummary = {
  readonly netWorth: NetWorthSummary;
  readonly currentMonth: MonthSummary;
  readonly lastMonth: MonthSummary;
  readonly lastUpdatedAt: ISODateString;
};

// ---------------------------------------------------------------------------
// Net worth history
// ---------------------------------------------------------------------------

export type NetWorthHistoryPoint = {
  /** ISO date string for the first day of the month. */
  readonly date: ISODateString;
  readonly netWorth: number;
  readonly assets: number;
  readonly liabilities: number;
};

// ---------------------------------------------------------------------------
// Budget utilization
// ---------------------------------------------------------------------------

export type BudgetUtilizationSummary = {
  readonly budget: Budget;
  readonly category: Category;
  readonly spent: number;
  readonly percentUsed: number;
  readonly isOverBudget: boolean;
  readonly isAlertTriggered: boolean;
  readonly daysRemainingInCycle: number;
};

// ---------------------------------------------------------------------------
// Upcoming bills
// ---------------------------------------------------------------------------

export type UpcomingBill = {
  readonly bill: Bill;
  readonly entry: BillEntry;
  readonly account: Account;
  /** Negative if overdue. */
  readonly daysUntilDue: number;
  readonly isOverdue: boolean;
};

// ---------------------------------------------------------------------------
// Goal progress
// ---------------------------------------------------------------------------

export type GoalProgressSummary = {
  readonly goal: Goal;
  readonly totalContributed: number;
  /** Clamped 0–100. */
  readonly percentComplete: number;
  readonly remainingAmount: number;
  /** null when contribution rate is 0. */
  readonly projectedCompletionDate: ISODateString | null;
  readonly isOnTrack: boolean;
  readonly isComplete: boolean;
};

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

export type InsightType =
  | 'BudgetNearLimit'
  | 'BudgetExceeded'
  | 'UnusualSpending'
  | 'SavingsRateHigh'
  | 'SavingsRateLow'
  | 'BillDueSoon'
  | 'GoalBehindTarget'
  | 'GoalComplete'
  | 'NoTransactionsRecorded'
  | 'PositiveNetWorth'
  | 'NegativeNetWorth';

export type InsightSeverity = 'info' | 'warning' | 'positive';

export type Insight = {
  readonly id: string;
  readonly type: InsightType;
  readonly title: string;
  readonly description: string;
  readonly severity: InsightSeverity;
  readonly actionLabel?: string;
  readonly actionRoute?: string;
};

/** Input posted to the insights Web Worker. */
export type InsightWorkerInput = {
  readonly budgetUtilization: BudgetUtilizationSummary[];
  readonly upcomingBills: UpcomingBill[];
  readonly goalProgress: GoalProgressSummary[];
  readonly currentMonthSavingsRate: number;
  readonly hasRecentTransactions: boolean;
  readonly baseCurrency: Currency;
};
