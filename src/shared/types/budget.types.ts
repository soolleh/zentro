import type { UUID, ISODateString, Currency } from './common.types';
import type { Category } from './category.types';
import type { Transaction } from './transaction.types';

export type Budget = {
  readonly id: UUID;
  readonly userId: UUID;
  readonly categoryId: UUID;
  readonly amount: number;
  readonly currency: Currency;
  readonly cycleStart: ISODateString;
  readonly cycleEnd: ISODateString;
  readonly carryForward: boolean;
  readonly alertThreshold: number;
  readonly createdAt: ISODateString;
};

export type BudgetUtilization = {
  readonly budgetId: UUID;
  readonly categoryId: UUID;
  readonly allocated: number;
  readonly spent: number;
  readonly remaining: number;
  readonly percentUsed: number;
  readonly isOverBudget: boolean;
  readonly isAlertTriggered: boolean;
};

export type CycleDates = {
  readonly cycleStart: ISODateString;
  readonly cycleEnd: ISODateString;
};

export type SpendingVelocity = {
  readonly dailyAverage: number;
  readonly projectedTotal: number;
  readonly projectedPercentUsed: number;
  readonly isOnTrack: boolean;
  readonly daysRemaining: number;
};

export type EnrichedBudget = {
  readonly budget: Budget;
  readonly category: Category;
  readonly spent: number;
  readonly remaining: number;
  readonly percentUsed: number;
  readonly isOverBudget: boolean;
  readonly isAlertTriggered: boolean;
  readonly carryForwardAmount: number;
  readonly effectiveAmount: number;
  readonly velocity: SpendingVelocity;
  readonly transactions: Transaction[];
};

export type BudgetCycleUtilization = {
  readonly cycleStart: ISODateString;
  readonly cycleEnd: ISODateString;
  readonly budgets: EnrichedBudget[];
  readonly totalAllocated: number;
  readonly totalSpent: number;
  readonly totalRemaining: number;
  readonly overallUtilization: number;
  readonly hasOverspend: boolean;
  readonly currency: Currency;
};

export type CreateBudgetParams = {
  readonly categoryId: UUID;
  readonly amount: number;
  readonly currency: Currency;
  readonly cycleStartDay: number;
  readonly carryForward: boolean;
  readonly alertThreshold: number;
  readonly referenceDate?: ISODateString;
};

// ---------------------------------------------------------------------------
// Analytics types
// ---------------------------------------------------------------------------

export type HealthScoreBreakdown = {
  readonly utilizationScore: number; // 0–40 pts
  readonly consistencyScore: number; // 0–30 pts
  readonly overspendPenalty: number; // 0–20 pts deducted
  readonly carryForwardBonus: number; // 0–10 pts
};

export type BudgetHealthScore = {
  readonly score: number;
  readonly grade: 'A' | 'B' | 'C' | 'D' | 'F';
  readonly label: string;
  readonly breakdown: HealthScoreBreakdown;
  readonly trend: 'improving' | 'stable' | 'declining';
  readonly previousScore: number | null;
};

export type BudgetVsActual = {
  readonly categoryId: UUID;
  readonly categoryName: string;
  readonly categoryColor: string;
  readonly allocated: number;
  readonly spent: number;
  readonly variance: number;
  readonly variancePercent: number;
};

export type CycleComparison = {
  readonly categoryId: UUID;
  readonly categoryName: string;
  readonly categoryColor: string;
  readonly currentCycleSpent: number;
  readonly previousCycleSpent: number;
  readonly threeMonthAverage: number;
  readonly trend: 'up' | 'down' | 'stable';
  readonly trendPercent: number;
};

export type SpendingTrendPoint = {
  readonly cycleStart: ISODateString;
  readonly spent: number;
  readonly allocated: number;
  readonly percentUsed: number;
};

export type CategorySpendingTrend = {
  readonly categoryId: UUID;
  readonly categoryName: string;
  readonly categoryColor: string;
  readonly points: SpendingTrendPoint[];
};

export type MerchantSummary = {
  readonly name: string;
  readonly totalSpent: number;
  readonly transactionCount: number;
  readonly lastTransactionDate: ISODateString;
};

export type CategoryDrillDown = {
  readonly category: Category;
  readonly currentCycle: EnrichedBudget;
  readonly historicalTrend: SpendingTrendPoint[];
  readonly transactions: Transaction[];
  readonly topMerchants: MerchantSummary[];
  readonly averageTransactionAmount: number;
  readonly transactionFrequency: number;
};
