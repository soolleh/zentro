/**
 * bulk-transaction.service.ts
 *
 * Batched update/delete operations for the Bulk Editing feature.
 * All methods snapshot current values before modification to enable undo.
 * Individual item failures never abort the batch — partial success is returned.
 */

import type { Result, UUID, ISODateString } from '@/shared/types/common.types';
import type { Transaction } from '@/shared/types/transaction.types';
import { transactionStorage } from '@/services/storage/transaction.storage';
import { addDays, parseISO, formatISO } from 'date-fns';
import type { BulkOperationRecord } from '@/app/stores/transaction.store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BulkEditField = 'categoryId' | 'accountId' | 'type' | 'notes' | 'tagIds';

export type BulkUpdateResult = {
  updated: number;
  errors: number;
  previousValues: Record<UUID, Partial<Transaction>>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
// bulkUpdateField
// ---------------------------------------------------------------------------

export async function bulkUpdateField(
  transactionIds: UUID[],
  field: BulkEditField,
  value: unknown,
  key: CryptoKey
): Promise<Result<BulkUpdateResult>> {
  if (field === 'tagIds') {
    // Tag infrastructure not yet implemented on Transaction — no-op
    return {
      success: true,
      data: { updated: 0, errors: 0, previousValues: {} },
    };
  }

  const previousValues: Record<UUID, Partial<Transaction>> = {};
  let updated = 0;
  let errors = 0;

  for (const id of transactionIds) {
    try {
      // 1. Fetch current value to snapshot
      const current = await transactionStorage.getTransactionById(id, key);
      if (!current.success || !current.data) {
        errors++;
        continue;
      }

      // 2. Snapshot only the specific field
      const tx = current.data;
      previousValues[id] = { [field]: tx[field as keyof Transaction] } as Partial<Transaction>;

      // 3. Apply update
      const result = await transactionStorage.updateTransaction(
        id,
        { [field]: value } as Partial<Omit<Transaction, 'id' | 'createdAt'>>,
        key
      );

      if (result.success) {
        updated++;
      } else {
        errors++;
      }
    } catch {
      errors++;
    }
  }

  return { success: true, data: { updated, errors, previousValues } };
}

// ---------------------------------------------------------------------------
// bulkDeleteTransactions
// ---------------------------------------------------------------------------

export async function bulkDeleteTransactions(
  transactionIds: UUID[],
  key: CryptoKey
): Promise<
  Result<{ deleted: number; errors: number; previousValues: Record<UUID, Partial<Transaction>> }>
> {
  const previousValues: Record<UUID, Partial<Transaction>> = {};
  let deleted = 0;
  let errors = 0;

  for (const id of transactionIds) {
    try {
      // 1. Snapshot the full transaction for undo-restore
      const current = await transactionStorage.getTransactionById(id, key);
      if (!current.success || !current.data) {
        errors++;
        continue;
      }
      previousValues[id] = current.data;

      // 2. Delete
      const result = await transactionStorage.deleteTransaction(id);
      if (result.success) {
        deleted++;
      } else {
        errors++;
      }
    } catch {
      errors++;
    }
  }

  return { success: true, data: { deleted, errors, previousValues } };
}

// ---------------------------------------------------------------------------
// bulkShiftDates
// ---------------------------------------------------------------------------

export async function bulkShiftDates(
  transactionIds: UUID[],
  shiftDays: number,
  key: CryptoKey
): Promise<Result<BulkUpdateResult>> {
  if (shiftDays === 0) {
    return { success: true, data: { updated: 0, errors: 0, previousValues: {} } };
  }

  const previousValues: Record<UUID, Partial<Transaction>> = {};
  let updated = 0;
  let errors = 0;

  for (const id of transactionIds) {
    try {
      const current = await transactionStorage.getTransactionById(id, key);
      if (!current.success || !current.data) {
        errors++;
        continue;
      }

      const tx = current.data;
      previousValues[id] = { date: tx.date };

      const shifted = addDays(parseISO(tx.date), shiftDays);
      const newDate = formatISO(shifted) as ISODateString;

      const result = await transactionStorage.updateTransaction(id, { date: newDate }, key);
      if (result.success) {
        updated++;
      } else {
        errors++;
      }
    } catch {
      errors++;
    }
  }

  return { success: true, data: { updated, errors, previousValues } };
}

// ---------------------------------------------------------------------------
// undoBulkOperation (service-level helper)
// ---------------------------------------------------------------------------

export async function undoBulkOperationService(
  record: BulkOperationRecord,
  key: CryptoKey
): Promise<Result<void>> {
  try {
    if (record.type === 'delete') {
      for (const [, tx] of Object.entries(record.previousValues)) {
        const full = tx as Transaction;
        await transactionStorage.createTransaction(
          {
            userId: full.userId,
            accountId: full.accountId,
            type: full.type,
            amount: full.amount,
            currency: full.currency,
            categoryId: full.categoryId,
            date: full.date,
            notes: full.notes,
            isReconciled: full.isReconciled,
          },
          key
        );
      }
    } else {
      for (const [id, prev] of Object.entries(record.previousValues)) {
        await transactionStorage.updateTransaction(
          id as UUID,
          prev as Partial<Omit<Transaction, 'id' | 'createdAt'>>,
          key
        );
      }
    }
    return { success: true, data: undefined };
  } catch (err) {
    return makeError('UNDO_FAILED', 'Failed to undo bulk operation.', err);
  }
}
