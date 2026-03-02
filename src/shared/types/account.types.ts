import type { UUID, ISODateString, Currency } from './common.types';

export type AccountType =
  | 'Cash'
  | 'Bank'
  | 'Checking'
  | 'Savings'
  | 'CreditCard'
  | 'Loan'
  | 'Investment';

export type Account = {
  readonly id: UUID;
  readonly userId: UUID;
  readonly name: string;
  readonly type: AccountType;
  readonly currency: Currency;
  readonly openingBalance: number;
  readonly openingDate: ISODateString;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
  // CreditCard-specific
  readonly creditLimit?: number;
  readonly minimumPaymentDue?: number;
  readonly paymentDueDate?: ISODateString;
  // Loan-specific
  readonly outstandingPrincipal?: number;
  readonly interestRate?: number;
};

export type AccountBalance = {
  readonly accountId: UUID;
  readonly balance: number;
  readonly currency: Currency;
  readonly computedAt: ISODateString;
};
