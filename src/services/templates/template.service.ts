/**
 * template.service.ts
 *
 * Business logic for transaction templates.
 * No React, no Zustand. All keys passed from the store layer.
 */

import type { Result, UUID } from '@/shared/types/common.types';
import type { Transaction } from '@/shared/types/transaction.types';
import type {
  TransactionTemplate,
  CreateTemplateParams,
  ReplayOverrides,
} from '@/shared/types/template.types';
import { templateStorage } from '@/services/storage/template.storage';
import { transactionStorage } from '@/services/storage/transaction.storage';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TEMPLATE_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f43f5e',
  '#a855f7',
] as const;

const DEFAULT_EMOJIS: Record<TransactionTemplate['type'], string> = {
  Income: '💰',
  Expense: '💸',
  Transfer: '🔄',
};

function makeError(code: string, message: string, cause?: unknown): Result<never> {
  return {
    success: false,
    error: {
      code,
      message,
      context: cause instanceof Error ? { cause: cause.message } : undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// Create from an existing transaction
// ---------------------------------------------------------------------------

export async function createTemplateFromTransaction(
  userId: UUID,
  transaction: Transaction,
  name: string,
  key: CryptoKey
): Promise<Result<TransactionTemplate>> {
  if (!name.trim()) {
    return makeError('TEMPLATE_NAME_REQUIRED', 'Template name is required.');
  }
  const colorIdx = Math.floor(Math.random() * TEMPLATE_COLORS.length);
  return templateStorage.createTemplate(
    {
      userId,
      name: name.trim(),
      description: '',
      type: transaction.type,
      amount: transaction.amount,
      currency: transaction.currency,
      accountId: transaction.accountId,
      toAccountId: null,
      categoryId: transaction.categoryId,
      tagIds: [],
      notes: transaction.notes ?? '',
      isRecurring: false,
      recurringFrequency: null,
      emoji: DEFAULT_EMOJIS[transaction.type],
      color: TEMPLATE_COLORS[colorIdx],
    },
    key
  );
}

// ---------------------------------------------------------------------------
// Create manually (from form)
// ---------------------------------------------------------------------------

export async function createTemplateManually(
  userId: UUID,
  params: CreateTemplateParams,
  key: CryptoKey
): Promise<Result<TransactionTemplate>> {
  if (!params.name?.trim()) {
    return makeError('TEMPLATE_NAME_REQUIRED', 'Template name is required.');
  }
  if (!params.type) {
    return makeError('TEMPLATE_TYPE_REQUIRED', 'Transaction type is required.');
  }
  if (!params.currency) {
    return makeError('TEMPLATE_CURRENCY_REQUIRED', 'Currency is required.');
  }

  // Auto-assign color if not provided
  const colorIdx = Math.floor(Math.random() * TEMPLATE_COLORS.length);
  const color = params.color ?? TEMPLATE_COLORS[colorIdx];
  const emoji = params.emoji ?? DEFAULT_EMOJIS[params.type];

  return templateStorage.createTemplate(
    {
      userId,
      name: params.name.trim(),
      description: params.description?.trim() ?? '',
      type: params.type,
      amount: params.amount ?? null,
      currency: params.currency,
      accountId: params.accountId ?? null,
      toAccountId: params.toAccountId ?? null,
      categoryId: params.categoryId ?? null,
      tagIds: params.tagIds ?? [],
      notes: params.notes ?? '',
      isRecurring: params.isRecurring ?? false,
      recurringFrequency: params.recurringFrequency ?? null,
      emoji,
      color,
    },
    key
  );
}

// ---------------------------------------------------------------------------
// Replay template → create a real transaction
// ---------------------------------------------------------------------------

export async function replayTemplate(
  userId: UUID,
  templateId: UUID,
  overrides: ReplayOverrides,
  key: CryptoKey
): Promise<Result<{ transaction: Transaction; template: TransactionTemplate }>> {
  // 1. Fetch template
  const templateResult = await templateStorage.getTemplateById(templateId, key);
  if (!templateResult.success) return templateResult;
  if (!templateResult.data) {
    return makeError('TEMPLATE_NOT_FOUND', `Template ${templateId} not found.`);
  }
  const tpl = templateResult.data;

  // 2. Resolve fields — template fields + overrides
  const amount = overrides.amount ?? tpl.amount;
  const accountId = overrides.accountId ?? tpl.accountId;
  // toAccountId (overrides.toAccountId ?? tpl.toAccountId) is not stored on Transaction in v1
  // It will be used when Transfer transactions gain a 'toAccountId' column.
  const notes = overrides.notes !== undefined ? overrides.notes : tpl.notes;

  // 3. Validate merged result
  if (amount === null || amount === undefined || amount <= 0) {
    return makeError('REPLAY_AMOUNT_REQUIRED', 'Amount is required and must be greater than 0.');
  }
  if (!accountId) {
    return makeError(
      'REPLAY_ACCOUNT_REQUIRED',
      'An account is required to record this transaction.'
    );
  }
  if (tpl.type === 'Expense' && !tpl.categoryId) {
    return makeError(
      'REPLAY_CATEGORY_REQUIRED',
      'A category is required for expense transactions.'
    );
  }

  // 4. Build transaction payload — use empty UUID for categoryId if none set
  const UNCATEGORIZED_ID = '00000000-0000-0000-0000-000000000000' as UUID;
  const txPayload: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> = {
    userId,
    type: tpl.type,
    amount,
    currency: tpl.currency,
    accountId,
    categoryId: tpl.categoryId ?? UNCATEGORIZED_ID,
    date: overrides.date,
    notes: notes || undefined,
    isReconciled: false,
  };

  // 5. Create transaction
  const txResult = await transactionStorage.createTransaction(txPayload, key);
  if (!txResult.success) return txResult;

  // 6. Increment use count (after successful transaction creation)
  const updatedTemplateResult = await templateStorage.incrementUseCount(templateId, key);
  if (!updatedTemplateResult.success) return updatedTemplateResult;

  return {
    success: true,
    data: { transaction: txResult.data, template: updatedTemplateResult.data },
  };
}

// ---------------------------------------------------------------------------
// Duplicate a template
// ---------------------------------------------------------------------------

export async function duplicateTemplate(
  userId: UUID,
  templateId: UUID,
  key: CryptoKey
): Promise<Result<TransactionTemplate>> {
  const templateResult = await templateStorage.getTemplateById(templateId, key);
  if (!templateResult.success) return templateResult;
  if (!templateResult.data) {
    return makeError('TEMPLATE_NOT_FOUND', `Template ${templateId} not found.`);
  }
  const tpl = templateResult.data;
  const { id: _id, createdAt: _c, updatedAt: _u, useCount: _uc, lastUsedAt: _la, ...rest } = tpl;
  return templateStorage.createTemplate(
    {
      ...rest,
      userId,
      name: `${tpl.name} (copy)`,
    },
    key
  );
}
