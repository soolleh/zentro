import type { UUID, ISODateString, Currency } from './common.types';

export type TransactionType = 'Income' | 'Expense' | 'Transfer';

export type RecurringFrequency = 'Daily' | 'Weekly' | 'Biweekly' | 'Monthly' | 'Yearly';

export type Transaction = {
  readonly id: UUID;
  readonly accountId: UUID;
  readonly userId: UUID;
  readonly type: TransactionType;
  readonly amount: number;
  readonly currency: Currency;
  readonly categoryId: UUID;
  readonly date: ISODateString;
  readonly notes?: string;
  readonly receiptBlob?: ArrayBuffer;
  readonly recurringRuleId?: UUID;
  readonly isReconciled: boolean;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
};

export type RecurringRule = {
  readonly id: UUID;
  readonly userId: UUID;
  readonly frequency: RecurringFrequency;
  readonly interval: number;
  readonly startDate: ISODateString;
  readonly endDate?: ISODateString;
  readonly lastGeneratedDate?: ISODateString;
};
