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
