import type { Result, UUID, ISODateString } from '@/shared/types/common.types';
import type { BillEntry, BillStatus } from '@/shared/types/bill.types';
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

export const billEntryStorage = {
  async createBillEntry(
    entry: Omit<BillEntry, 'id'>,
    key: CryptoKey
  ): Promise<Result<BillEntry>> {
    try {
      const full: BillEntry = { ...entry, id: generateUUID() };
      const encrypted = await encryptData(key, full);
      if (!encrypted.success) return encrypted;
      const db = await getDB();
      await db.put('bill_entries', {
        id: full.id,
        billId: full.billId,
        dueDate: full.dueDate,
        status: full.status,
        data: encrypted.data.data,
      });
      return { success: true, data: full };
    } catch (err) {
      return makeError('BILL_ENTRY_CREATE_FAILED', 'Failed to create bill entry.', err);
    }
  },

  async getBillEntryById(id: UUID, key: CryptoKey): Promise<Result<BillEntry | null>> {
    try {
      const db = await getDB();
      const record = await db.get('bill_entries', id);
      if (!record) return { success: true, data: null };
      return await decryptData<BillEntry>(key, { data: record.data });
    } catch (err) {
      return makeError('BILL_ENTRY_READ_FAILED', 'Failed to read bill entry.', err);
    }
  },

  async listEntriesByBill(billId: UUID, key: CryptoKey): Promise<Result<BillEntry[]>> {
    try {
      const db = await getDB();
      const records = await db.getAllFromIndex('bill_entries', 'billId', billId);
      const entries: BillEntry[] = [];
      for (const record of records) {
        const result = await decryptData<BillEntry>(key, { data: record.data });
        if (!result.success) return result;
        entries.push(result.data);
      }
      entries.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      return { success: true, data: entries };
    } catch (err) {
      return makeError('BILL_ENTRY_LIST_FAILED', 'Failed to list bill entries.', err);
    }
  },

  // billIds must be fetched by caller from billStorage to enforce userId scoping
  async listEntriesByDateRange(
    billIds: UUID[],
    from: ISODateString,
    to: ISODateString,
    key: CryptoKey
  ): Promise<Result<BillEntry[]>> {
    try {
      if (billIds.length === 0) return { success: true, data: [] };
      const db = await getDB();
      const allowed = new Set<string>(billIds);
      const range = IDBKeyRange.bound(from, to);
      const records = await db.getAllFromIndex('bill_entries', 'dueDate', range);
      const entries: BillEntry[] = [];
      for (const record of records) {
        if (!allowed.has(record.billId)) continue;
        const result = await decryptData<BillEntry>(key, { data: record.data });
        if (!result.success) return result;
        entries.push(result.data);
      }
      entries.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      return { success: true, data: entries };
    } catch (err) {
      return makeError('BILL_ENTRY_DATE_RANGE_FAILED', 'Failed to list entries by date.', err);
    }
  },

  // billIds must be fetched by caller from billStorage to enforce userId scoping
  async listPendingEntries(billIds: UUID[], key: CryptoKey): Promise<Result<BillEntry[]>> {
    try {
      if (billIds.length === 0) return { success: true, data: [] };
      const db = await getDB();
      const allowed = new Set<string>(billIds);
      const pendingRecords = await db.getAllFromIndex('bill_entries', 'status', 'pending');
      const snoozedRecords = await db.getAllFromIndex('bill_entries', 'status', 'snoozed');
      const records = [...pendingRecords, ...snoozedRecords];
      const entries: BillEntry[] = [];
      for (const record of records) {
        if (!allowed.has(record.billId)) continue;
        const result = await decryptData<BillEntry>(key, { data: record.data });
        if (!result.success) return result;
        entries.push(result.data);
      }
      entries.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      return { success: true, data: entries };
    } catch (err) {
      return makeError('BILL_ENTRY_PENDING_FAILED', 'Failed to list pending entries.', err);
    }
  },

  async updateBillEntry(
    id: UUID,
    updates: Partial<Omit<BillEntry, 'id' | 'billId'>>,
    key: CryptoKey
  ): Promise<Result<BillEntry>> {
    try {
      const db = await getDB();
      const record = await db.get('bill_entries', id);
      if (!record) {
        return makeError('BILL_ENTRY_NOT_FOUND', `No bill entry found with id: ${id}`);
      }
      const decrypted = await decryptData<BillEntry>(key, { data: record.data });
      if (!decrypted.success) return decrypted;
      const updated: BillEntry = {
        ...decrypted.data,
        ...updates,
        id: decrypted.data.id,
        billId: decrypted.data.billId,
      };
      const encrypted = await encryptData(key, updated);
      if (!encrypted.success) return encrypted;
      await db.put('bill_entries', {
        id: updated.id,
        billId: updated.billId,
        dueDate: updated.dueDate,
        status: updated.status as BillStatus,
        data: encrypted.data.data,
      });
      return { success: true, data: updated };
    } catch (err) {
      return makeError('BILL_ENTRY_UPDATE_FAILED', 'Failed to update bill entry.', err);
    }
  },

  async deleteBillEntry(id: UUID): Promise<Result<void>> {
    try {
      const db = await getDB();
      await db.delete('bill_entries', id);
      return { success: true, data: undefined };
    } catch (err) {
      return makeError('BILL_ENTRY_DELETE_FAILED', 'Failed to delete bill entry.', err);
    }
  },

  async deleteAllEntriesForBill(billId: UUID): Promise<Result<void>> {
    try {
      const db = await getDB();
      const records = await db.getAllFromIndex('bill_entries', 'billId', billId);
      const tx = db.transaction('bill_entries', 'readwrite');
      for (const record of records) {
        await tx.store.delete(record.id);
      }
      await tx.done;
      return { success: true, data: undefined };
    } catch (err) {
      return makeError(
        'BILL_ENTRY_DELETE_ALL_FAILED',
        'Failed to delete all entries for bill.',
        err
      );
    }
  },
};
