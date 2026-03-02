import type { Result, UUID, ISODateString } from '@/shared/types/common.types';
import type {
  Transaction,
  TransactionQueryOptions,
  TransactionPage,
} from '@/shared/types/transaction.types';
import { getDB } from './storage.db';
import { encryptData, decryptData } from '@/services/crypto/crypto.service';
import { generateUUID } from '@/services/crypto/crypto.utils';

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

export const transactionStorage = {
  async createTransaction(
    tx: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>,
    key: CryptoKey
  ): Promise<Result<Transaction>> {
    try {
      const now = new Date().toISOString() as ISODateString;
      const transaction: Transaction = {
        ...tx,
        id: generateUUID(),
        createdAt: now,
        updatedAt: now,
      };
      const encrypted = await encryptData(key, transaction);
      if (!encrypted.success) return encrypted;
      const db = await getDB();
      await db.put('transactions', {
        id: transaction.id,
        userId: transaction.userId,
        accountId: transaction.accountId,
        date: transaction.date,
        categoryId: transaction.categoryId,
        type: transaction.type,
        recurringRuleId: transaction.recurringRuleId,
        data: encrypted.data.data,
      });
      return { success: true, data: transaction };
    } catch (err) {
      return makeError('TRANSACTION_CREATE_FAILED', 'Failed to create transaction.', err);
    }
  },

  async getTransactionById(id: UUID, key: CryptoKey): Promise<Result<Transaction | null>> {
    try {
      const db = await getDB();
      const record = await db.get('transactions', id);
      if (!record) return { success: true, data: null };
      return await decryptData<Transaction>(key, { data: record.data });
    } catch (err) {
      return makeError('TRANSACTION_READ_FAILED', 'Failed to read transaction.', err);
    }
  },

  async listTransactionsByUser(
    userId: UUID,
    options: TransactionQueryOptions,
    key: CryptoKey
  ): Promise<Result<TransactionPage>> {
    try {
      const db = await getDB();
      const limit = options.limit;
      const sortOrder = options.sortOrder ?? 'desc';

      // Query using date index for range filtering
      let records;
      if (options.dateFrom !== undefined || options.dateTo !== undefined) {
        const lower = options.dateFrom ?? '0000-00-00T00:00:00.000Z';
        const upper = options.dateTo ?? '9999-12-31T23:59:59.999Z';
        const range = IDBKeyRange.bound(lower, upper);
        records = await db.getAllFromIndex('transactions', 'date', range);
        records = records.filter((r) => r.userId === userId);
      } else {
        records = await db.getAllFromIndex('transactions', 'userId', userId);
      }

      // Decrypt all candidate records
      const decrypted: Transaction[] = [];
      for (const record of records) {
        const result = await decryptData<Transaction>(key, { data: record.data });
        if (!result.success) return result;
        decrypted.push(result.data);
      }

      // Apply in-memory filters
      let filtered = decrypted.filter((tx) => {
        if (options.accountIds && options.accountIds.length > 0) {
          if (!options.accountIds.includes(tx.accountId)) return false;
        }
        if (options.categoryIds && options.categoryIds.length > 0) {
          if (!options.categoryIds.includes(tx.categoryId)) return false;
        }
        if (options.types && options.types.length > 0) {
          if (!options.types.includes(tx.type)) return false;
        }
        if (options.search) {
          const search = options.search.toLowerCase();
          if (!tx.notes?.toLowerCase().includes(search)) return false;
        }
        if (options.amountMin !== undefined) {
          if (tx.amount < options.amountMin) return false;
        }
        if (options.amountMax !== undefined) {
          if (tx.amount > options.amountMax) return false;
        }
        return true;
      });

      // Sort
      const sortBy = options.sortBy ?? 'date';
      filtered.sort((a, b) => {
        let cmp = 0;
        if (sortBy === 'date') {
          cmp = a.date.localeCompare(b.date);
        } else {
          cmp = a.amount - b.amount;
        }
        return sortOrder === 'desc' ? -cmp : cmp;
      });

      const totalCount = filtered.length;

      // Cursor-based pagination
      if (options.cursor) {
        const cursorIdx = filtered.findIndex((t) => t.id === options.cursor);
        if (cursorIdx !== -1) {
          filtered = filtered.slice(cursorIdx + 1);
        }
      }

      const page = filtered.slice(0, limit);
      const nextCursor = filtered.length > limit ? (page[page.length - 1]?.id ?? null) : null;

      return { success: true, data: { transactions: page, nextCursor, totalCount } };
    } catch (err) {
      return makeError('TRANSACTION_LIST_FAILED', 'Failed to list transactions.', err);
    }
  },

  async listTransactionsByAccount(
    accountId: UUID,
    options: Omit<TransactionQueryOptions, 'userId' | 'accountIds'>,
    key: CryptoKey
  ): Promise<Result<TransactionPage>> {
    try {
      const db = await getDB();
      const limit = options.limit;
      const sortOrder = options.sortOrder ?? 'desc';

      const records = await db.getAllFromIndex('transactions', 'accountId', accountId);
      const decrypted: Transaction[] = [];
      for (const record of records) {
        const result = await decryptData<Transaction>(key, { data: record.data });
        if (!result.success) return result;
        decrypted.push(result.data);
      }

      let filtered = decrypted.filter((tx) => {
        if (options.dateFrom && tx.date < options.dateFrom) return false;
        if (options.dateTo && tx.date > options.dateTo) return false;
        if (options.categoryIds && options.categoryIds.length > 0) {
          if (!options.categoryIds.includes(tx.categoryId)) return false;
        }
        if (options.types && options.types.length > 0) {
          if (!options.types.includes(tx.type)) return false;
        }
        if (options.search) {
          const search = options.search.toLowerCase();
          if (!tx.notes?.toLowerCase().includes(search)) return false;
        }
        if (options.amountMin !== undefined && tx.amount < options.amountMin) return false;
        if (options.amountMax !== undefined && tx.amount > options.amountMax) return false;
        return true;
      });

      const sortBy = options.sortBy ?? 'date';
      filtered.sort((a, b) => {
        let cmp = 0;
        if (sortBy === 'date') {
          cmp = a.date.localeCompare(b.date);
        } else {
          cmp = a.amount - b.amount;
        }
        return sortOrder === 'desc' ? -cmp : cmp;
      });

      const totalCount = filtered.length;

      if (options.cursor) {
        const cursorIdx = filtered.findIndex((t) => t.id === options.cursor);
        if (cursorIdx !== -1) filtered = filtered.slice(cursorIdx + 1);
      }

      const page = filtered.slice(0, limit);
      const nextCursor = filtered.length > limit ? (page[page.length - 1]?.id ?? null) : null;

      return { success: true, data: { transactions: page, nextCursor, totalCount } };
    } catch (err) {
      return makeError('TRANSACTION_LIST_FAILED', 'Failed to list transactions by account.', err);
    }
  },

  async listTransactionsByDateRange(
    userId: UUID,
    from: ISODateString,
    to: ISODateString,
    key: CryptoKey
  ): Promise<Result<Transaction[]>> {
    try {
      const db = await getDB();
      const range = IDBKeyRange.bound(from, to);
      const records = await db.getAllFromIndex('transactions', 'date', range);
      const userRecords = records.filter((r) => r.userId === userId);
      const transactions: Transaction[] = [];
      for (const record of userRecords) {
        const result = await decryptData<Transaction>(key, { data: record.data });
        if (!result.success) return result;
        transactions.push(result.data);
      }
      return { success: true, data: transactions };
    } catch (err) {
      return makeError(
        'TRANSACTION_LIST_FAILED',
        'Failed to list transactions by date range.',
        err
      );
    }
  },

  async updateTransaction(
    id: UUID,
    updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>,
    key: CryptoKey
  ): Promise<Result<Transaction>> {
    try {
      const db = await getDB();
      const record = await db.get('transactions', id);
      if (!record) return makeError('TRANSACTION_NOT_FOUND', `No transaction found with id: ${id}`);
      const existing = await decryptData<Transaction>(key, { data: record.data });
      if (!existing.success) return existing;
      const updated: Transaction = {
        ...existing.data,
        ...updates,
        id: existing.data.id,
        createdAt: existing.data.createdAt,
        updatedAt: new Date().toISOString() as ISODateString,
      };
      const encrypted = await encryptData(key, updated);
      if (!encrypted.success) return encrypted;
      await db.put('transactions', {
        id: updated.id,
        userId: updated.userId,
        accountId: updated.accountId,
        date: updated.date,
        categoryId: updated.categoryId,
        type: updated.type,
        recurringRuleId: updated.recurringRuleId,
        data: encrypted.data.data,
      });
      return { success: true, data: updated };
    } catch (err) {
      return makeError('TRANSACTION_UPDATE_FAILED', 'Failed to update transaction.', err);
    }
  },

  async deleteTransaction(id: UUID): Promise<Result<void>> {
    try {
      const db = await getDB();
      await db.delete('transactions', id);
      return { success: true, data: undefined };
    } catch (err) {
      return makeError('TRANSACTION_DELETE_FAILED', 'Failed to delete transaction.', err);
    }
  },

  async bulkCreateTransactions(
    txs: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[],
    key: CryptoKey
  ): Promise<Result<{ created: number; skipped: number; errors: number }>> {
    try {
      const db = await getDB();
      let created = 0;
      let skipped = 0;
      let errors = 0;

      const idbTx = db.transaction('transactions', 'readwrite');
      const store = idbTx.objectStore('transactions');

      for (const tx of txs) {
        try {
          // Duplicate detection: same date + amount + accountId
          const existing = await db.getAllFromIndex('transactions', 'accountId', tx.accountId);
          const isDuplicate = existing.some((r) => r.date === tx.date);
          if (isDuplicate) {
            // Check more precisely by decrypting and comparing amount
            const dupes = existing.filter((r) => r.date === tx.date);
            let found = false;
            for (const dupe of dupes) {
              const dec = await decryptData<Transaction>(key, { data: dupe.data });
              if (dec.success && dec.data.amount === tx.amount) {
                found = true;
                break;
              }
            }
            if (found) {
              skipped++;
              continue;
            }
          }

          const now = new Date().toISOString() as ISODateString;
          const transaction: Transaction = {
            ...tx,
            id: generateUUID(),
            createdAt: now,
            updatedAt: now,
          };
          const encrypted = await encryptData(key, transaction);
          if (!encrypted.success) {
            errors++;
            continue;
          }
          await store.put({
            id: transaction.id,
            userId: transaction.userId,
            accountId: transaction.accountId,
            date: transaction.date,
            categoryId: transaction.categoryId,
            type: transaction.type,
            recurringRuleId: transaction.recurringRuleId,
            data: encrypted.data.data,
          });
          created++;
        } catch {
          errors++;
        }
      }

      await idbTx.done;
      return { success: true, data: { created, skipped, errors } };
    } catch (err) {
      return makeError(
        'TRANSACTION_BULK_CREATE_FAILED',
        'Failed to bulk create transactions.',
        err
      );
    }
  },
};
