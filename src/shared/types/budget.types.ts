import type { UUID, ISODateString, Currency } from './common.types';

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
