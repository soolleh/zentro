import type { UUID, ISODateString, Currency } from './common.types';

export type Goal = {
  readonly id: UUID;
  readonly userId: UUID;
  readonly name: string;
  readonly targetAmount: number;
  readonly currency: Currency;
  readonly targetDate: ISODateString;
  readonly linkedAccountIds: readonly UUID[];
  readonly icon: string;
  readonly color: string;
  readonly createdAt: ISODateString;
};

export type GoalContribution = {
  readonly id: UUID;
  readonly goalId: UUID;
  readonly fromAccountId: UUID;
  readonly amount: number;
  readonly date: ISODateString;
  readonly transactionId?: UUID;
};
