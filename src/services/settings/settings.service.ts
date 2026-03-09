/**
 * settings.service.ts
 *
 * Handles data export (CSV, encrypted backup, plain JSON),
 * backup import/restore, and account deletion.
 *
 * This service operates entirely client-side using the WebCrypto API and
 * IndexedDB. No data ever leaves the device.
 */

import { encryptData, decryptData } from '@/services/crypto/crypto.service';
import type { SerializedEncryptedPayload } from '@/services/crypto/crypto.types';
import { userStorage } from '@/services/storage/user.storage';
import { settingsStorage } from '@/services/storage/settings.storage';
import { categoryStorage } from '@/services/storage/category.storage';
import { transactionStorage } from '@/services/storage/transaction.storage';
import { accountStorage } from '@/services/storage/account.storage';
import { budgetStorage } from '@/services/storage/budget.storage';
import { goalStorage } from '@/services/storage/goal.storage';
import { goalContributionStorage } from '@/services/storage/goal-contribution.storage';
import { billStorage } from '@/services/storage/bill.storage';
import { billEntryStorage } from '@/services/storage/bill-entry.storage';
import { recurringRuleStorage } from '@/services/storage/recurring-rule.storage';
import { getDB } from '@/services/storage/storage.db';
import { unlockWithPassword } from '@/services/auth/auth.service';
import type { Result, UUID } from '@/shared/types/common.types';
import type { Transaction, RecurringRule } from '@/shared/types/transaction.types';
import type { Account } from '@/shared/types/account.types';
import type { Category } from '@/shared/types/category.types';
import type { Budget } from '@/shared/types/budget.types';
import type { Goal, GoalContribution } from '@/shared/types/goal.types';
import type { Bill, BillEntry } from '@/shared/types/bill.types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function makeError(code: string, message: string, cause?: unknown): Result<never> {
  console.error(`[settingsService] ${code}:`, message, cause);
  return { success: false, error: { code, message } };
}

/**
 * Gather all storable data for a given user. Returns partial data gracefully
 * when storages are not yet implemented (returns empty arrays / null).
 */
async function gatherUserData(userId: UUID, derivedKey: CryptoKey) {
  const [
    settingsResult,
    categoriesResult,
    transactionsResult,
    accountsResult,
    budgetsResult,
    goalsResult,
    billsResult,
    recurringRulesResult,
  ] = await Promise.all([
    settingsStorage.getSettingsByUser(userId, derivedKey),
    categoryStorage.listCategoriesByUser(userId, derivedKey),
    transactionStorage.listTransactionsByUser(
      userId,
      { userId, limit: 999999, sortBy: 'date', sortOrder: 'desc' },
      derivedKey
    ),
    accountStorage.listAccountsByUser(userId, derivedKey),
    budgetStorage.listBudgetsByUser(userId, derivedKey),
    goalStorage.listGoalsByUser(userId, derivedKey),
    billStorage.listBillsByUser(userId, derivedKey),
    recurringRuleStorage.listRulesByUser(userId, derivedKey),
  ]);

  const goals: Goal[] = goalsResult.success ? goalsResult.data : [];
  const bills: Bill[] = billsResult.success ? billsResult.data : [];

  // Goal contributions — fetched per goal (no userId index)
  const goalContributions: GoalContribution[] = [];
  for (const goal of goals) {
    const r = await goalContributionStorage.listContributionsByGoal(goal.id, derivedKey);
    if (r.success) goalContributions.push(...r.data);
  }

  // Bill entries — fetched per bill (no userId index)
  const billEntries: BillEntry[] = [];
  for (const bill of bills) {
    const r = await billEntryStorage.listEntriesByBill(bill.id, derivedKey);
    if (r.success) billEntries.push(...r.data);
  }

  return {
    settings: settingsResult.success ? settingsResult.data : null,
    categories: categoriesResult.success ? categoriesResult.data : [],
    transactions: transactionsResult.success ? transactionsResult.data.transactions : [],
    accounts: accountsResult.success ? accountsResult.data : [],
    budgets: budgetsResult.success ? budgetsResult.data : [],
    goals,
    goalContributions,
    bills,
    billEntries,
    recurringRules: recurringRulesResult.success ? recurringRulesResult.data : [],
  };
}

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

/**
 * Plaintext counts embedded in the backup envelope and Drive file properties.
 * Never contains financial data — only quantity metadata.
 */
export type BackupMeta = {
  accounts: number;
  transactions: number;
  categories: number;
  budgets: number;
  goals: number;
  bills: number;
};

const CSV_HEADERS = 'date,type,amount,currency,categoryId,accountId,notes\n' as const;

function transactionToCSVRow(tx: Transaction): string {
  const escape = (value: string | undefined): string => {
    if (value == null) return '';
    const str = value;
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  return [
    escape(tx.date),
    escape(tx.type),
    String(tx.amount),
    escape(tx.currency),
    escape(tx.categoryId),
    escape(tx.accountId),
    escape(tx.notes ?? ''),
  ].join(',');
}

export async function exportTransactionsCSV(
  userId: UUID,
  derivedKey: CryptoKey
): Promise<Result<Blob>> {
  try {
    const result = await transactionStorage.listTransactionsByUser(
      userId,
      { userId, limit: 999999, sortBy: 'date', sortOrder: 'desc' },
      derivedKey
    );

    if (!result.success) {
      if (result.error.code === 'NOT_IMPLEMENTED') {
        // Storage not yet implemented — return headers-only CSV
        return {
          success: true,
          data: new Blob([CSV_HEADERS], { type: 'text/csv;charset=utf-8;' }),
        };
      }
      return makeError('CSV_EXPORT_FAILED', result.error.message);
    }

    const rows = result.data.transactions.map(transactionToCSVRow).join('\n');
    const csv = CSV_HEADERS + rows;

    return {
      success: true,
      data: new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    };
  } catch (err) {
    return makeError('CSV_EXPORT_FAILED', 'Unexpected error during CSV export.', err);
  }
}

// ---------------------------------------------------------------------------
// Encrypted Backup Export (.zentro)
// ---------------------------------------------------------------------------

export type EncryptedBackupResult = {
  blob: Blob;
  meta: BackupMeta;
};

export async function exportEncryptedBackup(
  userId: UUID,
  derivedKey: CryptoKey
): Promise<Result<EncryptedBackupResult>> {
  try {
    const data = await gatherUserData(userId, derivedKey);

    const meta: BackupMeta = {
      accounts: data.accounts.length,
      transactions: data.transactions.length,
      categories: data.categories.filter((c) => !c.isSystem).length,
      budgets: data.budgets.length,
      goals: data.goals.length,
      bills: data.bills.length,
    };

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      userId,
      ...data,
    };

    // encryptData(key, plaintext) — key is first arg
    const encryptResult = await encryptData(derivedKey, payload);
    if (!encryptResult.success) {
      return makeError('BACKUP_EXPORT_FAILED', encryptResult.error.message);
    }

    // Wrap in a .zentro envelope — meta is plaintext for identification without decryption
    const envelope = JSON.stringify({
      zentro: true,
      version: 1,
      meta,
      payload: encryptResult.data,
    });

    return {
      success: true,
      data: {
        blob: new Blob([envelope], { type: 'application/zentro-backup' }),
        meta,
      },
    };
  } catch (err) {
    return makeError('BACKUP_EXPORT_FAILED', 'Unexpected error during backup export.', err);
  }
}

// ---------------------------------------------------------------------------
// Plain JSON Export
// ---------------------------------------------------------------------------

export async function exportPlainJSON(userId: UUID, derivedKey: CryptoKey): Promise<Result<Blob>> {
  try {
    const data = await gatherUserData(userId, derivedKey);

    const json = JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        userId,
        ...data,
      },
      null,
      2
    );

    return {
      success: true,
      data: new Blob([json], { type: 'application/json' }),
    };
  } catch (err) {
    return makeError('JSON_EXPORT_FAILED', 'Unexpected error during JSON export.', err);
  }
}

// ---------------------------------------------------------------------------
// Import / Restore
// ---------------------------------------------------------------------------

type BackupPayload = {
  version: number;
  exportedAt: string;
  userId: string;
  settings: unknown;
  categories: Category[];
  transactions: Transaction[];
  accounts: Account[];
  budgets: Budget[];
  goals: Goal[];
  goalContributions: GoalContribution[];
  bills: Bill[];
  billEntries: BillEntry[];
  recurringRules: RecurringRule[];
};

function isBackupPayload(obj: unknown): obj is BackupPayload {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'version' in obj &&
    'userId' in obj &&
    'settings' in obj
  );
}

/**
 * Shared restore logic — writes all entities from a decrypted payload into
 * IndexedDB for the given user, re-encrypting each record with their derived key.
 * Clears existing user data first to avoid duplicates.
 */
async function restorePayload(
  userId: UUID,
  derivedKey: CryptoKey,
  payload: BackupPayload
): Promise<Result<void>> {
  try {
    const db = await getDB();

    // ----------------------------------------------------------------
    // 1. Clear existing user data (reverse dependency order)
    // ----------------------------------------------------------------

    // Collect parent IDs before deleting parents
    const existingGoalKeys = await db.getAllKeysFromIndex('goals', 'userId', userId);
    const existingBillKeys = await db.getAllKeysFromIndex('bills', 'userId', userId);

    for (const goalId of existingGoalKeys) {
      const contribKeys = await db.getAllKeysFromIndex('goal_contributions', 'goalId', goalId);
      for (const k of contribKeys) await db.delete('goal_contributions', k);
    }
    for (const billId of existingBillKeys) {
      const entryKeys = await db.getAllKeysFromIndex('bill_entries', 'billId', billId);
      for (const k of entryKeys) await db.delete('bill_entries', k);
    }
    for (const store of [
      'accounts',
      'transactions',
      'categories',
      'budgets',
      'goals',
      'bills',
      'recurring_rules',
    ] as const) {
      const keys = await db.getAllKeysFromIndex(store, 'userId', userId);
      for (const k of keys) await db.delete(store, k);
    }

    // ----------------------------------------------------------------
    // 2. Restore settings
    // ----------------------------------------------------------------
    if (payload.settings && typeof payload.settings === 'object') {
      const settings = payload.settings as Parameters<typeof settingsStorage.upsertSettings>[0];
      await settingsStorage.upsertSettings(settings, derivedKey);
    }

    // Helper: encrypt entity and return the base64 data blob
    async function enc(item: unknown): Promise<string | null> {
      const r = await encryptData(derivedKey, item);
      return r.success ? r.data.data : null;
    }

    // ----------------------------------------------------------------
    // 3. Restore accounts
    // ----------------------------------------------------------------
    for (const account of payload.accounts ?? []) {
      const data = await enc(account);
      if (data)
        await db.put('accounts', {
          id: account.id,
          userId: account.userId,
          type: account.type,
          data,
        });
    }

    // ----------------------------------------------------------------
    // 4. Restore categories
    // ----------------------------------------------------------------
    for (const category of payload.categories ?? []) {
      const data = await enc(category);
      if (data)
        await db.put('categories', {
          id: category.id,
          userId: category.userId,
          isSystem: category.isSystem ? 1 : 0,
          data,
        });
    }

    // ----------------------------------------------------------------
    // 5. Restore transactions
    // ----------------------------------------------------------------
    for (const tx of payload.transactions ?? []) {
      const data = await enc(tx);
      if (data) {
        await db.put('transactions', {
          id: tx.id,
          userId: tx.userId,
          accountId: tx.accountId,
          date: tx.date,
          categoryId: tx.categoryId,
          type: tx.type,
          ...(tx.recurringRuleId ? { recurringRuleId: tx.recurringRuleId } : {}),
          data,
        });
      }
    }

    // ----------------------------------------------------------------
    // 6. Restore budgets
    // ----------------------------------------------------------------
    for (const budget of payload.budgets ?? []) {
      const data = await enc(budget);
      if (data)
        await db.put('budgets', {
          id: budget.id,
          userId: budget.userId,
          categoryId: budget.categoryId,
          cycleStart: budget.cycleStart,
          data,
        });
    }

    // ----------------------------------------------------------------
    // 7. Restore recurring rules
    // ----------------------------------------------------------------
    for (const rule of payload.recurringRules ?? []) {
      const data = await enc(rule);
      if (data) await db.put('recurring_rules', { id: rule.id, userId: rule.userId, data });
    }

    // ----------------------------------------------------------------
    // 8. Restore goals
    // ----------------------------------------------------------------
    for (const goal of payload.goals ?? []) {
      const data = await enc(goal);
      if (data) await db.put('goals', { id: goal.id, userId: goal.userId, data });
    }

    // ----------------------------------------------------------------
    // 9. Restore goal contributions
    // ----------------------------------------------------------------
    for (const contrib of payload.goalContributions ?? []) {
      const data = await enc(contrib);
      if (data)
        await db.put('goal_contributions', {
          id: contrib.id,
          goalId: contrib.goalId,
          fromAccountId: contrib.fromAccountId,
          data,
        });
    }

    // ----------------------------------------------------------------
    // 10. Restore bills
    // ----------------------------------------------------------------
    for (const bill of payload.bills ?? []) {
      const data = await enc(bill);
      if (data) await db.put('bills', { id: bill.id, userId: bill.userId, data });
    }

    // ----------------------------------------------------------------
    // 11. Restore bill entries
    // ----------------------------------------------------------------
    for (const entry of payload.billEntries ?? []) {
      const data = await enc(entry);
      if (data)
        await db.put('bill_entries', {
          id: entry.id,
          billId: entry.billId,
          dueDate: entry.dueDate,
          status: entry.status,
          data,
        });
    }

    return { success: true, data: undefined };
  } catch (err) {
    return makeError('IMPORT_FAILED', 'Unexpected error during restore.', err);
  }
}

/**
 * Import a .zentro encrypted backup. Requires the user's password to decrypt.
 */
export async function importEncryptedBackup(
  userId: UUID,
  password: string,
  file: File
): Promise<Result<void>> {
  try {
    const keyResult = await unlockWithPassword(userId, password);
    if (!keyResult.success) {
      return makeError('IMPORT_AUTH_FAILED', 'Incorrect password.');
    }
    const derivedKey = keyResult.data;

    const text = await file.text();

    let envelope: unknown;
    try {
      envelope = JSON.parse(text);
    } catch {
      return makeError('IMPORT_PARSE_FAILED', 'Backup file is corrupt or invalid.');
    }

    if (
      typeof envelope !== 'object' ||
      envelope === null ||
      !('zentro' in envelope) ||
      !('payload' in envelope)
    ) {
      return makeError('IMPORT_INVALID', 'File is not a valid Zentro backup.');
    }

    const encPayload = (envelope as { payload: SerializedEncryptedPayload }).payload;

    const decryptResult = await decryptData<BackupPayload>(derivedKey, encPayload);
    if (!decryptResult.success) {
      return makeError('IMPORT_DECRYPT_FAILED', 'Failed to decrypt backup. Wrong password?');
    }

    const payload = decryptResult.data;

    if (!isBackupPayload(payload)) {
      return makeError('IMPORT_INVALID', 'Backup file format is not recognised.');
    }

    return restorePayload(userId, derivedKey, payload);
  } catch (err) {
    return makeError('IMPORT_FAILED', 'Unexpected error during import.', err);
  }
}

/**
 * Import a .zentro encrypted backup using an already-derived CryptoKey.
 * Use this for authenticated restore where the user is already logged in —
 * no password re-entry required.
 */
export async function importEncryptedBackupWithKey(
  userId: UUID,
  derivedKey: CryptoKey,
  file: File
): Promise<Result<void>> {
  try {
    const text = await file.text();

    let envelope: unknown;
    try {
      envelope = JSON.parse(text);
    } catch {
      return makeError('IMPORT_PARSE_FAILED', 'Backup file is corrupt or invalid.');
    }

    if (
      typeof envelope !== 'object' ||
      envelope === null ||
      !('zentro' in envelope) ||
      !('payload' in envelope)
    ) {
      return makeError('IMPORT_INVALID', 'File is not a valid Zentro backup.');
    }

    const encPayload = (envelope as { payload: SerializedEncryptedPayload }).payload;

    const decryptResult = await decryptData<BackupPayload>(derivedKey, encPayload);
    if (!decryptResult.success) {
      return makeError('IMPORT_DECRYPT_FAILED', 'Failed to decrypt backup. Session key mismatch?');
    }

    const payload = decryptResult.data;

    if (!isBackupPayload(payload)) {
      return makeError('IMPORT_INVALID', 'Backup file format is not recognised.');
    }

    return restorePayload(userId, derivedKey, payload);
  } catch (err) {
    return makeError('IMPORT_FAILED', 'Unexpected error during import.', err);
  }
}

/**
 * Import a plain-JSON backup (no decryption required).
 */
export async function importPlainJSON(
  userId: UUID,
  derivedKey: CryptoKey,
  file: File
): Promise<Result<void>> {
  try {
    const text = await file.text();

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      return makeError('IMPORT_PARSE_FAILED', 'File is not valid JSON.');
    }

    if (!isBackupPayload(payload)) {
      return makeError('IMPORT_INVALID', 'File format is not recognised.');
    }

    return restorePayload(userId, derivedKey, payload);
  } catch (err) {
    return makeError('IMPORT_FAILED', 'Unexpected error during JSON import.', err);
  }
}

// ---------------------------------------------------------------------------
// Account Deletion
// ---------------------------------------------------------------------------

/**
 * Permanently deletes a user account and all associated data.
 * Requires password confirmation.
 */
export async function deleteAccount(userId: UUID, password: string): Promise<Result<void>> {
  try {
    const verifyResult = await unlockWithPassword(userId, password);
    if (!verifyResult.success) {
      return makeError('DELETE_AUTH_FAILED', 'Incorrect password. Account not deleted.');
    }

    const deleteResult = await userStorage.deleteUser(userId);
    if (!deleteResult.success) {
      return makeError('DELETE_USER_FAILED', deleteResult.error.message);
    }

    return { success: true, data: undefined };
  } catch (err) {
    return makeError('DELETE_ACCOUNT_FAILED', 'Unexpected error during account deletion.', err);
  }
}

// ---------------------------------------------------------------------------
// Browser Download Helper
// ---------------------------------------------------------------------------

export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Delay revoke to allow download to start
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10_000);
}
