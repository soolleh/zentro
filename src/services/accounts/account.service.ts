/**
 * account.service.ts
 *
 * Business logic for account management, balance computation, transfers,
 * reconciliation, and net worth calculation.
 *
 * All methods are pure async functions returning Result<T>. No throws.
 * No React, no Zustand.
 */

import type { Result, UUID, ISODateString, Currency } from '@/shared/types/common.types';
import type {
  Account,
  AccountWithBalance,
  AccountType,
  BalanceHistoryPoint,
  NetWorthSummary,
} from '@/shared/types/account.types';
import type { Transaction } from '@/shared/types/transaction.types';
import { accountStorage } from '@/services/storage/account.storage';
import { transactionStorage } from '@/services/storage/transaction.storage';
import { CATEGORY_TRANSFER } from '@/shared/constants/categories.constants';
import { generateUUID } from '@/services/crypto/crypto.utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ASSET_TYPES: readonly AccountType[] = ['Cash', 'Bank', 'Checking', 'Savings', 'Investment'];
const LIABILITY_TYPES: readonly AccountType[] = ['CreditCard', 'Loan'];

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

/** Compute balance from an opening balance + a list of transactions that belong to `accountId`. */
function computeBalance(account: Account, transactions: Transaction[]): number {
  let balance = account.openingBalance;
  for (const tx of transactions) {
    if (tx.accountId === account.id) {
      if (tx.type === 'Income') {
        balance += tx.amount;
      } else if (tx.type === 'Expense') {
        balance -= tx.amount;
      } else {
        // For transfers: check notes for linked direction
        // Expense-side of transfer (source account) deducts; Income-side (dest account) adds.
        // The Transfer type on a transaction associated with this account acts like Expense
        // (reduces the source account). Income-type Transfers add to the destination.
        // We model: Transfer transactions are Expense for the from-account and Income for to-account
        // but both have type=Transfer. We therefore use amount sign based on whether this
        // account is the source or destination by looking at tx type convention:
        // from account: tx.type = 'Transfer', created as expense-side → subtract
        // to account: tx.type = 'Transfer', created as income-side → add
        // Since both are stored with type='Transfer', we differentiate by the notes prefix.
        if (tx.notes?.startsWith('[transfer:') && tx.notes.includes('→from]')) {
          balance -= tx.amount;
        } else if (tx.notes?.startsWith('[transfer:') && tx.notes.includes('→to]')) {
          balance += tx.amount;
        } else {
          // Fallback: treat as expense
          balance -= tx.amount;
        }
      }
    }
  }
  return balance;
}

function isAsset(type: AccountType): boolean {
  return (ASSET_TYPES as AccountType[]).includes(type);
}

function isLiability(type: AccountType): boolean {
  return (LIABILITY_TYPES as AccountType[]).includes(type);
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

export type TransferParams = {
  readonly fromAccountId: UUID;
  readonly toAccountId: UUID;
  readonly amount: number;
  readonly date: ISODateString;
  readonly notes?: string;
};

/**
 * Compute the current balance for a single account.
 * Balance = openingBalance + sum(income) - sum(expense) ± transfers
 */
export async function getAccountBalance(accountId: UUID, key: CryptoKey): Promise<Result<number>> {
  try {
    const accountResult = await accountStorage.getAccountById(accountId, key);
    if (!accountResult.success) return accountResult;
    if (!accountResult.data) {
      return makeError('ACCOUNT_NOT_FOUND', `No account found with id: ${accountId}`);
    }
    const account = accountResult.data;

    const txResult = await transactionStorage.listTransactionsByAccount(
      accountId,
      { limit: 999999 },
      key
    );
    if (!txResult.success) return txResult;

    const balance = computeBalance(account, txResult.data.transactions);
    return { success: true, data: balance };
  } catch (err) {
    return makeError('BALANCE_COMPUTE_FAILED', 'Failed to compute account balance.', err);
  }
}

/**
 * Compute balance history for the last `months` months.
 * Returns an array ordered oldest → newest with one point per month.
 */
export async function getAccountBalanceHistory(
  accountId: UUID,
  key: CryptoKey,
  months: number
): Promise<Result<BalanceHistoryPoint[]>> {
  try {
    const accountResult = await accountStorage.getAccountById(accountId, key);
    if (!accountResult.success) return accountResult;
    if (!accountResult.data) {
      return makeError('ACCOUNT_NOT_FOUND', `No account found with id: ${accountId}`);
    }
    const account = accountResult.data;

    const txResult = await transactionStorage.listTransactionsByAccount(
      accountId,
      { limit: 999999, sortBy: 'date', sortOrder: 'asc' },
      key
    );
    if (!txResult.success) return txResult;
    const allTx = txResult.data.transactions;

    const now = new Date();
    const points: BalanceHistoryPoint[] = [];

    for (let i = months - 1; i >= 0; i--) {
      // First day of (now - i months)
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      // Last day of that month
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      const monthEndStr = monthEnd.toISOString().slice(0, 10);

      // Sum all transactions up to monthEnd
      const txUpToMonth = allTx.filter((tx) => tx.date.slice(0, 10) <= monthEndStr);
      const balance = computeBalance(account, txUpToMonth);

      points.push({
        date: monthDate.toISOString().slice(0, 10) as ISODateString,
        balance,
      });
    }

    return { success: true, data: points };
  } catch (err) {
    return makeError('BALANCE_HISTORY_FAILED', 'Failed to compute balance history.', err);
  }
}

/**
 * Get all accounts with computed current balances for a user.
 * Sorted: assets first, then liabilities, then by createdAt.
 */
export async function getAllAccountsWithBalances(
  userId: UUID,
  key: CryptoKey
): Promise<Result<AccountWithBalance[]>> {
  try {
    const accountsResult = await accountStorage.listAccountsByUser(userId, key);
    if (!accountsResult.success) return accountsResult;

    const result: AccountWithBalance[] = [];
    for (const account of accountsResult.data) {
      const balanceResult = await getAccountBalance(account.id, key);
      if (!balanceResult.success) return balanceResult;

      result.push({
        account,
        currentBalance: balanceResult.data,
        isAsset: isAsset(account.type),
        isLiability: isLiability(account.type),
      });
    }

    result.sort((a, b) => {
      // Assets before liabilities
      if (a.isAsset && !b.isAsset) return -1;
      if (!a.isAsset && b.isAsset) return 1;
      // Then by createdAt
      return a.account.createdAt.localeCompare(b.account.createdAt);
    });

    return { success: true, data: result };
  } catch (err) {
    return makeError('ACCOUNTS_WITH_BALANCES_FAILED', 'Failed to get accounts with balances.', err);
  }
}

/**
 * Compute net worth for a user in their base currency.
 * (Exchange rates are applied at base 1:1 since manual rates aren't stored
 *  in a queryable way here — the UI layer handles rate conversion display.)
 */
export async function getNetWorth(
  userId: UUID,
  key: CryptoKey,
  baseCurrency: Currency
): Promise<Result<NetWorthSummary>> {
  try {
    const accountsResult = await getAllAccountsWithBalances(userId, key);
    if (!accountsResult.success) return accountsResult;

    let totalAssets = 0;
    let totalLiabilities = 0;

    for (const { currentBalance, isAsset, isLiability } of accountsResult.data) {
      if (isAsset) {
        totalAssets += Math.max(0, currentBalance);
      } else if (isLiability) {
        // For liabilities, the outstanding amount owed is (positive balance = owed)
        totalLiabilities += Math.max(0, currentBalance);
      }
    }

    return {
      success: true,
      data: {
        totalAssets,
        totalLiabilities,
        netWorth: totalAssets - totalLiabilities,
        currency: baseCurrency,
      },
    };
  } catch (err) {
    return makeError('NET_WORTH_FAILED', 'Failed to compute net worth.', err);
  }
}

/**
 * Transfer funds between two accounts.
 * Creates a linked pair of Transfer transactions.
 */
export async function transferBetweenAccounts(
  params: TransferParams,
  userId: UUID,
  key: CryptoKey
): Promise<Result<{ from: Transaction; to: Transaction }>> {
  try {
    if (params.fromAccountId === params.toAccountId) {
      return makeError('TRANSFER_SAME_ACCOUNT', 'From and To accounts must be different.');
    }

    const transferId = generateUUID();
    const userNotes = params.notes ? ` ${params.notes}` : '';
    const fromNotes = `[transfer:${transferId}→from]${userNotes}` as Transaction['notes'];
    const toNotes = `[transfer:${transferId}→to]${userNotes}` as Transaction['notes'];
    const categoryId = CATEGORY_TRANSFER.id;

    const fromTxResult = await transactionStorage.createTransaction(
      {
        accountId: params.fromAccountId,
        userId,
        type: 'Transfer',
        amount: params.amount,
        currency: 'USD' as Currency, // will be overridden by account currency at UI
        categoryId,
        date: params.date,
        notes: fromNotes,
        isReconciled: false,
      },
      key
    );
    if (!fromTxResult.success) return fromTxResult;

    const toTxResult = await transactionStorage.createTransaction(
      {
        accountId: params.toAccountId,
        userId,
        type: 'Transfer',
        amount: params.amount,
        currency: 'USD' as Currency,
        categoryId,
        date: params.date,
        notes: toNotes,
        isReconciled: false,
      },
      key
    );
    if (!toTxResult.success) return toTxResult;

    return {
      success: true,
      data: { from: fromTxResult.data, to: toTxResult.data },
    };
  } catch (err) {
    return makeError('TRANSFER_FAILED', 'Failed to transfer funds.', err);
  }
}

/**
 * Mark all transactions for an account up to `reconcileUpToDate` as reconciled.
 */
export async function reconcileAccount(
  accountId: UUID,
  reconcileUpToDate: ISODateString,
  key: CryptoKey
): Promise<Result<void>> {
  try {
    const txResult = await transactionStorage.listTransactionsByAccount(
      accountId,
      { limit: 999999, dateTo: reconcileUpToDate },
      key
    );
    if (!txResult.success) return txResult;

    const unreconciled = txResult.data.transactions.filter((tx) => !tx.isReconciled);

    for (const tx of unreconciled) {
      const updateResult = await transactionStorage.updateTransaction(
        tx.id,
        { isReconciled: true },
        key
      );
      if (!updateResult.success) return updateResult;
    }

    return { success: true, data: undefined };
  } catch (err) {
    return makeError('RECONCILE_FAILED', 'Failed to reconcile account.', err);
  }
}

/**
 * Delete an account. Fails if the account has any transactions.
 */
export async function deleteAccount(accountId: UUID, key: CryptoKey): Promise<Result<void>> {
  try {
    const txResult = await transactionStorage.listTransactionsByAccount(
      accountId,
      { limit: 1 },
      key
    );
    if (!txResult.success) return txResult;

    if (txResult.data.totalCount > 0) {
      return makeError(
        'ACCOUNT_HAS_TRANSACTIONS',
        'This account has transactions. Delete or reassign them before removing the account.'
      );
    }

    return await accountStorage.deleteAccount(accountId);
  } catch (err) {
    return makeError('ACCOUNT_DELETE_FAILED', 'Failed to delete account.', err);
  }
}

/**
 * Count reconciled transactions for an account.
 */
export async function getReconciledCount(accountId: UUID, key: CryptoKey): Promise<Result<number>> {
  try {
    const txResult = await transactionStorage.listTransactionsByAccount(
      accountId,
      { limit: 999999 },
      key
    );
    if (!txResult.success) return txResult;
    const count = txResult.data.transactions.filter((tx) => tx.isReconciled).length;
    return { success: true, data: count };
  } catch (err) {
    return makeError('RECONCILED_COUNT_FAILED', 'Failed to count reconciled transactions.', err);
  }
}
