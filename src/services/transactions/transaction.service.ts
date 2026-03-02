import type { Result, UUID, ISODateString } from '@/shared/types/common.types';
import type {
  Transaction,
  CSVImportParams,
  CSVImportResult,
  AutofillSuggestion,
} from '@/shared/types/transaction.types';
import { transactionStorage } from '@/services/storage/transaction.storage';
import { recurringRuleStorage } from '@/services/storage/recurring-rule.storage';
import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  parseISO,
  formatISO,
  isAfter,
  isBefore,
} from 'date-fns';
import Papa from 'papaparse';

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

function getNextDate(current: Date, frequency: string, interval: number): Date {
  switch (frequency) {
    case 'Daily':
      return addDays(current, interval);
    case 'Weekly':
      return addWeeks(current, interval);
    case 'Biweekly':
      return addWeeks(current, 2);
    case 'Monthly':
      return addMonths(current, interval);
    case 'Yearly':
      return addYears(current, interval);
    default:
      return addMonths(current, interval);
  }
}

export async function generateRecurringTransactions(
  userId: UUID,
  key: CryptoKey
): Promise<Result<{ generated: number }>> {
  try {
    const rulesResult = await recurringRuleStorage.listRulesByUser(userId, key);
    if (!rulesResult.success) return rulesResult;

    const horizon = addDays(new Date(), 90);
    let generated = 0;

    for (const rule of rulesResult.data) {
      const startDate = rule.lastGeneratedDate
        ? getNextDate(parseISO(rule.lastGeneratedDate), rule.frequency, rule.interval)
        : parseISO(rule.startDate);

      const endLimit = rule.endDate
        ? isBefore(parseISO(rule.endDate), horizon)
          ? parseISO(rule.endDate)
          : horizon
        : horizon;

      let current = startDate;
      let lastGenerated: Date | null = null;

      while (!isAfter(current, endLimit)) {
        const txDate = formatISO(current, { representation: 'date' }) as ISODateString;
        const txResult = await transactionStorage.createTransaction(
          {
            userId: rule.userId,
            accountId: rule.accountId,
            type: rule.type,
            amount: rule.amount,
            currency: rule.currency,
            categoryId: rule.categoryId,
            date: txDate,
            notes: rule.notes,
            recurringRuleId: rule.id,
            isReconciled: false,
          },
          key
        );
        if (txResult.success) {
          generated++;
          lastGenerated = current;
        }
        current = getNextDate(current, rule.frequency, rule.interval);
      }

      if (lastGenerated !== null) {
        const lastDateStr = formatISO(lastGenerated, { representation: 'date' }) as ISODateString;
        await recurringRuleStorage.updateLastGeneratedDate(rule.id, lastDateStr, key);
      }
    }

    return { success: true, data: { generated } };
  } catch (err) {
    return makeError(
      'RECURRING_GENERATION_FAILED',
      'Failed to generate recurring transactions.',
      err
    );
  }
}

export async function importFromCSV(
  params: CSVImportParams,
  key: CryptoKey
): Promise<Result<CSVImportResult>> {
  try {
    const { userId, accountId, csvString, columnMapping } = params;

    const parseResult = Papa.parse<Record<string, string>>(csvString, {
      header: true,
      skipEmptyLines: true,
    });

    const rows = parseResult.data;
    const result: CSVImportResult = {
      total: rows.length,
      created: 0,
      skipped: 0,
      errors: [],
    };

    const validTxs: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const rawDate = row[columnMapping.date];
      const rawAmount = row[columnMapping.amount];

      if (!rawDate) {
        result.errors.push({ row: i + 1, reason: 'Missing date value' });
        continue;
      }
      if (!rawAmount) {
        result.errors.push({ row: i + 1, reason: 'Missing amount value' });
        continue;
      }

      let parsedDate: Date;
      try {
        parsedDate = new Date(rawDate);
        if (isNaN(parsedDate.getTime())) throw new Error('Invalid date');
      } catch {
        result.errors.push({ row: i + 1, reason: `Invalid date: ${rawDate}` });
        continue;
      }

      const parsedAmount = parseFloat(rawAmount.replace(/[^0-9.-]/g, ''));
      if (isNaN(parsedAmount)) {
        result.errors.push({ row: i + 1, reason: `Invalid amount: ${rawAmount}` });
        continue;
      }

      let txType: 'Income' | 'Expense' | 'Transfer' = parsedAmount >= 0 ? 'Income' : 'Expense';
      if (columnMapping.type) {
        const rawType = row[columnMapping.type].trim().toLowerCase();
        if (rawType === 'income') txType = 'Income';
        else if (rawType === 'expense') txType = 'Expense';
        else if (rawType === 'transfer') txType = 'Transfer';
        else if (rawType) {
          result.errors.push({
            row: i + 1,
            reason: `Invalid type: ${row[columnMapping.type] ?? ''}`,
          });
          continue;
        }
      }

      const txDate = formatISO(parsedDate, { representation: 'date' }) as ISODateString;
      const notes = columnMapping.notes ? (row[columnMapping.notes] ?? undefined) : undefined;
      // category matching handled by caller; store categoryId as empty for now
      // Category lookup is best-effort during import
      const categoryPlaceholder = '' as UUID;

      validTxs.push({
        userId,
        accountId,
        type: txType,
        amount: Math.abs(parsedAmount),
        currency: 'USD' as import('@/shared/types/common.types').Currency,
        categoryId: categoryPlaceholder,
        date: txDate,
        notes: notes ?? undefined,
        isReconciled: false,
      });
    }

    if (validTxs.length > 0) {
      const bulkResult = await transactionStorage.bulkCreateTransactions(validTxs, key);
      if (!bulkResult.success) return bulkResult;
      result.created = bulkResult.data.created;
      result.skipped = bulkResult.data.skipped;
      result.errors.push(
        ...Array.from({ length: bulkResult.data.errors }, (_, i) => ({
          row: validTxs.length - bulkResult.data.errors + i + 1,
          reason: 'Failed to save transaction',
        }))
      );
    }

    return { success: true, data: result };
  } catch (err) {
    return makeError('CSV_IMPORT_FAILED', 'Failed to import CSV.', err);
  }
}

export async function autofillSuggestion(
  userId: UUID,
  partialNotes: string,
  key: CryptoKey
): Promise<Result<AutofillSuggestion | null>> {
  try {
    if (partialNotes.length < 3) return { success: true, data: null };

    const listResult = await transactionStorage.listTransactionsByUser(
      userId,
      { userId, limit: 500, sortBy: 'date', sortOrder: 'desc' },
      key
    );
    if (!listResult.success) return listResult;

    const lower = partialNotes.toLowerCase();
    const match = listResult.data.transactions.find((tx) =>
      tx.notes?.toLowerCase().startsWith(lower)
    );

    if (!match || !match.notes) return { success: true, data: null };

    return {
      success: true,
      data: { categoryId: match.categoryId, notes: match.notes },
    };
  } catch (err) {
    return makeError('AUTOFILL_FAILED', 'Failed to generate autofill suggestion.', err);
  }
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_RECEIPT_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export async function attachReceipt(
  transactionId: UUID,
  imageFile: File,
  key: CryptoKey
): Promise<Result<Transaction>> {
  try {
    if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
      return makeError('INVALID_IMAGE_TYPE', 'Receipt must be a JPG, PNG, or WEBP image.');
    }
    if (imageFile.size > MAX_RECEIPT_SIZE_BYTES) {
      return makeError('RECEIPT_TOO_LARGE', 'Receipt image must be 2MB or smaller.');
    }

    const buffer = await imageFile.arrayBuffer();
    const result = await transactionStorage.updateTransaction(
      transactionId,
      { receiptBlob: buffer },
      key
    );
    return result;
  } catch (err) {
    return makeError('RECEIPT_ATTACH_FAILED', 'Failed to attach receipt.', err);
  }
}
