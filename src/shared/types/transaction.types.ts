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
  readonly accountId: UUID;
  readonly categoryId: UUID;
  readonly type: TransactionType;
  readonly amount: number;
  readonly currency: Currency;
  readonly frequency: RecurringFrequency;
  readonly interval: number;
  readonly startDate: ISODateString;
  readonly endDate?: ISODateString;
  readonly lastGeneratedDate?: ISODateString;
  readonly notes?: string;
};

export type TransactionQueryOptions = {
  userId: UUID;
  cursor?: UUID;
  limit: number;
  dateFrom?: ISODateString;
  dateTo?: ISODateString;
  accountIds?: UUID[];
  categoryIds?: UUID[];
  types?: TransactionType[];
  search?: string;
  amountMin?: number;
  amountMax?: number;
  sortBy?: 'date' | 'amount';
  sortOrder?: 'asc' | 'desc';
};

export type TransactionPage = {
  transactions: Transaction[];
  nextCursor: UUID | null;
  totalCount: number;
};

export type CSVColumnMapping = {
  date: string;
  amount: string;
  type?: string;
  category?: string;
  notes?: string;
};

export type CSVImportResult = {
  total: number;
  created: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
};

export type AutofillSuggestion = {
  categoryId: UUID;
  notes: string;
};

export type CSVImportParams = {
  userId: UUID;
  accountId: UUID;
  csvString: string;
  columnMapping: CSVColumnMapping;
};
