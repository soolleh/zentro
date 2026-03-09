import type { UUID, ISODateString, Currency } from './common.types';
import type { TransactionType, RecurringFrequency } from './transaction.types';

// ---------------------------------------------------------------------------
// Core template type
// ---------------------------------------------------------------------------

export type TransactionTemplate = {
  readonly id: UUID;
  readonly userId: UUID;
  /** User-given display name. Max 50 chars. */
  name: string;
  /** Optional description. Max 100 chars. */
  description: string;
  type: TransactionType;
  /** null = prompt user on replay */
  amount: number | null;
  currency: Currency;
  /** null = prompt user on replay */
  accountId: UUID | null;
  /** Transfer type only. null = prompt user on replay */
  toAccountId: UUID | null;
  categoryId: UUID | null;
  tagIds: UUID[];
  notes: string;
  isRecurring: boolean;
  recurringFrequency: RecurringFrequency | null;
  /** Emoji icon. Defaults based on transaction type. */
  emoji: string;
  /** Hex color. Auto-assigned from TEMPLATE_COLORS cycle. */
  color: string;
  /** Incremented each time this template is replayed. */
  useCount: number;
  lastUsedAt: ISODateString | null;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
};

// ---------------------------------------------------------------------------
// Create params
// ---------------------------------------------------------------------------

export type CreateTemplateParams = {
  name: string;
  description?: string;
  type: TransactionType;
  amount?: number | null;
  currency: Currency;
  accountId?: UUID | null;
  toAccountId?: UUID | null;
  categoryId?: UUID | null;
  tagIds?: UUID[];
  notes?: string;
  isRecurring?: boolean;
  recurringFrequency?: RecurringFrequency | null;
  emoji?: string;
  color?: string;
};

// ---------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------

export type ReplayOverrides = {
  /** Always required — templates never store a date. */
  date: ISODateString;
  /** Required if template.amount === null */
  amount?: number;
  /** Required if template.accountId === null */
  accountId?: UUID;
  /** Required if template.toAccountId === null (Transfer only) */
  toAccountId?: UUID;
  /** Replaces template notes if provided */
  notes?: string;
};
