import type { Result, UUID, ISODateString } from '@/shared/types/common.types';
import type {
  Bill,
  BillEntry,
  BillsSummary,
  EnrichedBillEntry,
  CreateBillInput,
  UpdateBillInput,
  PayBillParams,
  SnoozeParams,
} from '@/shared/types/bill.types';
import { billStorage } from '@/services/storage/bill.storage';
import { billEntryStorage } from '@/services/storage/bill-entry.storage';
import { transactionStorage } from '@/services/storage/transaction.storage';
import {
  addMonths,
  setDate,
  startOfMonth,
  endOfMonth,
  isAfter,
  isBefore,
  parseISO,
  format,
  getYear,
  getMonth,
} from 'date-fns';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Build the canonical due-date ISO string for a bill in a given year+month. */
function buildDueDate(year: number, month: number, dueDayOfMonth: number): ISODateString {
  const ref = new Date(year, month, 1);
  const lastDay = endOfMonth(ref).getDate();
  const day = Math.min(dueDayOfMonth, lastDay);
  return new Date(Date.UTC(year, month, day)).toISOString() as ISODateString;
}

/** Get today as an ISODateString at start-of-day UTC. */
function todayISO(): ISODateString {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString() as ISODateString;
}

// ---------------------------------------------------------------------------
// Bill CRUD
// ---------------------------------------------------------------------------

export async function createBill(
  input: CreateBillInput,
  key: CryptoKey
): Promise<Result<Bill>> {
  const result = await billStorage.createBill(input, key);
  if (!result.success) return result;
  // Eagerly generate upcoming entries for the new bill
  void generateEntriesForBill(result.data, key, 90);
  return result;
}

export async function updateBill(
  id: UUID,
  updates: UpdateBillInput,
  key: CryptoKey
): Promise<Result<Bill>> {
  return billStorage.updateBill(id, updates, key);
}

export async function deleteBill(id: UUID, _key?: CryptoKey): Promise<Result<void>> {
  const deleteEntries = await billEntryStorage.deleteAllEntriesForBill(id);
  if (!deleteEntries.success) return deleteEntries;
  return billStorage.deleteBill(id);
}

export async function getBillsByUser(userId: UUID, key: CryptoKey): Promise<Result<Bill[]>> {
  return billStorage.listBillsByUser(userId, key);
}

// ---------------------------------------------------------------------------
// Entry generation (idempotent)
// ---------------------------------------------------------------------------

export async function generateEntriesForBill(
  bill: Bill,
  key: CryptoKey,
  daysAhead = 90
): Promise<Result<BillEntry[]>> {
  if (!bill.isActive) return { success: true, data: [] };

  // Fetch existing entries to know which months already have an entry
  const existingResult = await billEntryStorage.listEntriesByBill(bill.id, key);
  if (!existingResult.success) return existingResult;

  const existingMonthKeys = new Set<string>(
    existingResult.data.map((e) => {
      const d = parseISO(e.dueDate);
      return `${String(getYear(d))}-${String(getMonth(d))}`; // 0-indexed month
    })
  );

  const today = new Date();
  const cutoff = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const created: BillEntry[] = [];
  // Walk each month from now until cutoff
  let cursor = startOfMonth(today);
  while (isBefore(cursor, cutoff)) {
    const year = getYear(cursor);
    const month = getMonth(cursor); // 0-indexed
    const key2 = `${String(year)}-${String(month)}`;
    if (!existingMonthKeys.has(key2)) {
      const dueDate = buildDueDate(year, month, bill.dueDayOfMonth);
      const entryResult = await billEntryStorage.createBillEntry(
        {
          billId: bill.id,
          dueDate,
          status: 'pending',
          paidDate: null,
          paidAmount: null,
          transactionId: null,
          snoozeUntil: null,
        },
        key
      );
      if (!entryResult.success) return entryResult;
      created.push(entryResult.data);
      existingMonthKeys.add(key2); // prevent duplicates within same run
    }
    cursor = addMonths(cursor, 1);
  }

  return { success: true, data: created };
}

export async function generateAllUserEntries(
  userId: UUID,
  key: CryptoKey
): Promise<Result<void>> {
  const billsResult = await billStorage.listBillsByUser(userId, key);
  if (!billsResult.success) return billsResult;

  for (const bill of billsResult.data) {
    const r = await generateEntriesForBill(bill, key, 90);
    if (!r.success) return r;
  }
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Entry actions
// ---------------------------------------------------------------------------

export async function payBill(
  params: PayBillParams,
  bill: Bill,
  userId: UUID,
  key: CryptoKey
): Promise<Result<BillEntry>> {
  // 1. Create an expense transaction
  const txResult = await transactionStorage.createTransaction(
    {
      userId,
      accountId: bill.accountId,
      type: 'Expense',
      amount: params.paidAmount,
      currency: bill.currency,
      categoryId: bill.categoryId,
      date: params.paidDate,
      notes: params.notes ?? `Bill payment: ${bill.name}`,
      isReconciled: false,
    },
    key
  );
  if (!txResult.success) return txResult;

  // 2. Update the entry
  return billEntryStorage.updateBillEntry(
    params.entryId,
    {
      status: 'paid',
      paidDate: params.paidDate,
      paidAmount: params.paidAmount,
      transactionId: txResult.data.id,
      notes: params.notes,
    },
    key
  );
}

export async function snoozeBill(params: SnoozeParams, key: CryptoKey): Promise<Result<BillEntry>> {
  return billEntryStorage.updateBillEntry(
    params.entryId,
    { status: 'snoozed', snoozeUntil: params.snoozeUntil },
    key
  );
}

export async function skipBill(entryId: UUID, key: CryptoKey): Promise<Result<BillEntry>> {
  return billEntryStorage.updateBillEntry(entryId, { status: 'skipped' }, key);
}

export async function undoPayBill(entryId: UUID, key: CryptoKey): Promise<Result<BillEntry>> {
  return billEntryStorage.updateBillEntry(
    entryId,
    {
      status: 'pending',
      paidDate: null,
      paidAmount: null,
      transactionId: null,
    },
    key
  );
}

// ---------------------------------------------------------------------------
// Bulk operations
// ---------------------------------------------------------------------------

export async function bulkPayBills(
  entries: BillEntry[],
  bills: Map<UUID, Bill>,
  userId: UUID,
  paidDate: ISODateString,
  key: CryptoKey
): Promise<Result<BillEntry[]>> {
  const updated: BillEntry[] = [];
  for (const entry of entries) {
    const bill = bills.get(entry.billId);
    if (!bill) continue;
    const result = await payBill(
      { entryId: entry.id, paidAmount: entry.paidAmount ?? bill.amount, paidDate },
      bill,
      userId,
      key
    );
    if (!result.success) return result;
    updated.push(result.data);
  }
  return { success: true, data: updated };
}

// ---------------------------------------------------------------------------
// Read / query helpers
// ---------------------------------------------------------------------------

export async function getEnrichedEntriesForRange(
  userId: UUID,
  from: ISODateString,
  to: ISODateString,
  key: CryptoKey
): Promise<Result<EnrichedBillEntry[]>> {
  const billsResult = await billStorage.listBillsByUser(userId, key);
  if (!billsResult.success) return billsResult;

  const billMap = new Map<UUID, Bill>(billsResult.data.map((b) => [b.id, b]));
  const billIds = billsResult.data.map((b) => b.id);

  const entriesResult = await billEntryStorage.listEntriesByDateRange(billIds, from, to, key);
  if (!entriesResult.success) return entriesResult;

  const enriched: EnrichedBillEntry[] = [];
  for (const entry of entriesResult.data) {
    const bill = billMap.get(entry.billId);
    if (!bill) continue;
    enriched.push({ ...entry, bill });
  }
  enriched.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return { success: true, data: enriched };
}

export async function getUpcomingBills(
  userId: UUID,
  key: CryptoKey,
  days = 7
): Promise<Result<EnrichedBillEntry[]>> {
  const today = todayISO();
  const cutoff = format(
    new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    "yyyy-MM-dd'T'23:59:59.999'Z'"
  ) as ISODateString;
  return getEnrichedEntriesForRange(userId, today, cutoff, key);
}

export async function getBillsSummary(
  userId: UUID,
  key: CryptoKey
): Promise<Result<BillsSummary>> {
  const now = new Date();
  const from = format(startOfMonth(now), "yyyy-MM-dd'T'00:00:00.000'Z'") as ISODateString;
  const to = format(endOfMonth(now), "yyyy-MM-dd'T'23:59:59.999'Z'") as ISODateString;

  const result = await getEnrichedEntriesForRange(userId, from, to, key);
  if (!result.success) return result;

  const today = new Date();
  let totalDueThisMonth = 0;
  let totalPaidThisMonth = 0;
  let overdueCount = 0;
  let pendingCount = 0;
  let paidCount = 0;

  for (const entry of result.data) {
    const amount = entry.bill.amount;
    totalDueThisMonth += amount;

    if (entry.status === 'paid') {
      totalPaidThisMonth += entry.paidAmount ?? amount;
      paidCount++;
    } else if (entry.status === 'pending' || entry.status === 'snoozed') {
      pendingCount++;
      const due = parseISO(entry.dueDate);
      if (isAfter(today, setDate(due, due.getDate()))) {
        overdueCount++;
      }
    }
  }

  return {
    success: true,
    data: {
      totalDueThisMonth,
      totalPaidThisMonth,
      overdueCount,
      pendingCount,
      paidCount,
    },
  };
}

/** Return all entries for current month  + next N days, enriched. */
export async function getMonthEntriesEnriched(
  userId: UUID,
  key: CryptoKey,
  monthOffset = 0
): Promise<Result<EnrichedBillEntry[]>> {
  const ref = addMonths(new Date(), monthOffset);
  const from = format(startOfMonth(ref), "yyyy-MM-dd'T'00:00:00.000'Z'") as ISODateString;
  const to = format(endOfMonth(ref), "yyyy-MM-dd'T'23:59:59.999'Z'") as ISODateString;
  return getEnrichedEntriesForRange(userId, from, to, key);
}

/** Check if a bill entry is overdue (past due date and not paid/skipped). */
export function isOverdue(entry: BillEntry): boolean {
  if (entry.status === 'paid' || entry.status === 'skipped') return false;
  const due = parseISO(entry.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return isBefore(due, today);
}
