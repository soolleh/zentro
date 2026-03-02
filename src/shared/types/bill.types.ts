import type { UUID, ISODateString, Currency } from './common.types';

export type BillStatus = 'Pending' | 'Paid' | 'Skipped';

export type Bill = {
  readonly id: UUID;
  readonly userId: UUID;
  readonly name: string;
  readonly amount: number;
  readonly currency: Currency;
  readonly dueDayOfMonth: number;
  readonly categoryId: UUID;
  readonly accountId: UUID;
  readonly isActive: boolean;
  readonly createdAt: ISODateString;
};

export type BillEntry = {
  readonly id: UUID;
  readonly billId: UUID;
  readonly dueDate: ISODateString;
  readonly status: BillStatus;
  readonly paidTransactionId?: UUID;
};
