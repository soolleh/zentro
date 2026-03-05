import type { UUID, ISODateString, Currency } from './common.types';

export type BillStatus = 'pending' | 'paid' | 'snoozed' | 'skipped';

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
  readonly color: string;
  readonly emoji: string;
  readonly notes?: string;
  readonly recurringRuleId: UUID | null;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
};

export type BillEntry = {
  readonly id: UUID;
  readonly billId: UUID;
  readonly dueDate: ISODateString;
  readonly status: BillStatus;
  readonly paidDate: ISODateString | null;
  readonly paidAmount: number | null;
  readonly transactionId: UUID | null;
  readonly snoozeUntil: ISODateString | null;
  readonly notes?: string;
};

// Enriched entry for UI — carries the parent bill context
export type EnrichedBillEntry = BillEntry & {
  readonly bill: Bill;
};

export type BillsSummary = {
  readonly totalDueThisMonth: number;
  readonly totalPaidThisMonth: number;
  readonly overdueCount: number;
  readonly pendingCount: number;
  readonly paidCount: number;
};

export type PayBillParams = {
  readonly entryId: UUID;
  readonly paidAmount: number;
  readonly paidDate: ISODateString;
  readonly notes?: string;
};

export type SnoozeParams = {
  readonly entryId: UUID;
  readonly snoozeUntil: ISODateString;
};

// Input types (omit auto-generated fields)
export type CreateBillInput = Omit<Bill, 'id' | 'createdAt' | 'updatedAt' | 'recurringRuleId'> & {
  readonly recurringRuleId?: UUID | null;
};

export type UpdateBillInput = Partial<Omit<Bill, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>;
