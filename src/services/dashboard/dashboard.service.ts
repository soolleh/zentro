/**
 * dashboard.service.ts
 *
 * Business logic for dashboard data aggregation.
 *
 * All methods return Promise<Result<T>>. No throws. No React. No Zustand.
 * Keys and preferences are passed from the store layer.
 */

import type { Result, UUID, ISODateString, Currency } from '@/shared/types/common.types';
import type {
  DashboardSummary,
  MonthSummary,
  NetWorthHistoryPoint,
  BudgetUtilizationSummary,
  UpcomingBill,
  GoalProgressSummary,
  Insight,
  InsightWorkerInput,
} from '@/shared/types/dashboard.types';
import type { Transaction } from '@/shared/types/transaction.types';
import type { Category } from '@/shared/types/category.types';
import {
  getNetWorth,
  getAllAccountsWithBalances,
  getAccountBalanceHistory,
} from '@/services/accounts/account.service';
import { transactionStorage } from '@/services/storage/transaction.storage';
import { budgetStorage } from '@/services/storage/budget.storage';
import { billStorage } from '@/services/storage/bill.storage';
import { billEntryStorage } from '@/services/storage/bill-entry.storage';
import { goalStorage } from '@/services/storage/goal.storage';
import { goalContributionStorage } from '@/services/storage/goal-contribution.storage';
import { categoryStorage } from '@/services/storage/category.storage';
import { accountStorage } from '@/services/storage/account.storage';

// ---------------------------------------------------------------------------
// Error helpers
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

/** Gracefully return fallback when a storage call is NOT_IMPLEMENTED or fails. */
function graceful<T>(result: Result<T>, fallback: T): T {
  return result.success ? result.data : fallback;
}

// ---------------------------------------------------------------------------
// Date helpers (no date-fns dependency; pure arithmetic)
// ---------------------------------------------------------------------------

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

function endOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0, 23, 59, 59, 999);
}

function toISO(date: Date): ISODateString {
  return date.toISOString() as ISODateString;
}

// ---------------------------------------------------------------------------
// MonthSummary computation
// ---------------------------------------------------------------------------

function computeMonthSummary(monthDate: Date, transactions: Transaction[]): MonthSummary {
  let income = 0;
  let expenses = 0;
  let count = 0;

  for (const tx of transactions) {
    if (tx.type === 'Income') {
      income += tx.amount;
      count++;
    } else if (tx.type === 'Expense') {
      expenses += tx.amount;
      count++;
    }
    // Transfers excluded
  }

  const savingsRate =
    income > 0 ? Math.min(100, Math.max(-100, ((income - expenses) / income) * 100)) : 0;

  return {
    income,
    expenses,
    savingsRate,
    transactionCount: count,
    month: toISO(startOfMonth(monthDate.getFullYear(), monthDate.getMonth())),
  };
}

// ---------------------------------------------------------------------------
// getDashboardSummary
// ---------------------------------------------------------------------------

export async function getDashboardSummary(
  userId: UUID,
  key: CryptoKey,
  baseCurrency: Currency
): Promise<Result<DashboardSummary>> {
  try {
    const now = new Date();
    const cy = now.getFullYear();
    const cm = now.getMonth();

    // Last month
    const lm = cm === 0 ? 11 : cm - 1;
    const ly = cm === 0 ? cy - 1 : cy;

    const [netWorthResult, currentTxResult, lastTxResult] = await Promise.all([
      getNetWorth(userId, key, baseCurrency),
      transactionStorage.listTransactionsByDateRange(
        userId,
        toISO(startOfMonth(cy, cm)),
        toISO(endOfMonth(cy, cm)),
        key
      ),
      transactionStorage.listTransactionsByDateRange(
        userId,
        toISO(startOfMonth(ly, lm)),
        toISO(endOfMonth(ly, lm)),
        key
      ),
    ]);

    if (!netWorthResult.success) return netWorthResult;
    if (!currentTxResult.success) return currentTxResult;
    if (!lastTxResult.success) return lastTxResult;

    const currentMonth = computeMonthSummary(now, currentTxResult.data);
    const lastMonth = computeMonthSummary(new Date(ly, lm, 1), lastTxResult.data);

    return {
      success: true,
      data: {
        netWorth: netWorthResult.data,
        currentMonth,
        lastMonth,
        lastUpdatedAt: now.toISOString() as ISODateString,
      },
    };
  } catch (err) {
    return makeError('DASHBOARD_SUMMARY_FAILED', 'Failed to load dashboard summary.', err);
  }
}

// ---------------------------------------------------------------------------
// getNetWorthHistory
// ---------------------------------------------------------------------------

export async function getNetWorthHistory(
  userId: UUID,
  key: CryptoKey,
  months: number
): Promise<Result<NetWorthHistoryPoint[]>> {
  try {
    const accountsResult = await getAllAccountsWithBalances(userId, key);
    if (!accountsResult.success) return accountsResult;

    if (accountsResult.data.length === 0) {
      return { success: true, data: [] };
    }

    // Fetch balance history for all accounts in parallel
    const histories = await Promise.all(
      accountsResult.data.map((aw) => getAccountBalanceHistory(aw.account.id, key, months))
    );

    // Aggregate per-month assets and liabilities
    const assetsByDate = new Map<string, number>();
    const liabilitiesByDate = new Map<string, number>();

    for (let i = 0; i < accountsResult.data.length; i++) {
      const aw = accountsResult.data[i];
      const histResult = histories[i];
      if (!histResult.success) continue;

      for (const point of histResult.data) {
        const key_ = point.date as string;
        if (aw.isAsset) {
          assetsByDate.set(key_, (assetsByDate.get(key_) ?? 0) + Math.max(0, point.balance));
        } else if (aw.isLiability) {
          liabilitiesByDate.set(
            key_,
            (liabilitiesByDate.get(key_) ?? 0) + Math.max(0, point.balance)
          );
        }
      }
    }

    const allDates = [...new Set([...assetsByDate.keys(), ...liabilitiesByDate.keys()])].sort();

    const result: NetWorthHistoryPoint[] = allDates.map((date) => {
      const assets = assetsByDate.get(date) ?? 0;
      const liabilities = liabilitiesByDate.get(date) ?? 0;
      return {
        date: date as ISODateString,
        assets,
        liabilities,
        netWorth: assets - liabilities,
      };
    });

    return { success: true, data: result };
  } catch (err) {
    return makeError('NET_WORTH_HISTORY_FAILED', 'Failed to load net worth history.', err);
  }
}

// ---------------------------------------------------------------------------
// getBudgetUtilization
// ---------------------------------------------------------------------------

export async function getBudgetUtilization(
  userId: UUID,
  key: CryptoKey
): Promise<Result<BudgetUtilizationSummary[]>> {
  try {
    const now = new Date();
    const cycleStart = toISO(startOfMonth(now.getFullYear(), now.getMonth()));

    const budgetsResult = await budgetStorage.listBudgetsByCycle(userId, cycleStart, key);
    // Graceful degradation for NOT_IMPLEMENTED
    if (!budgetsResult.success) {
      return { success: true, data: [] };
    }

    if (budgetsResult.data.length === 0) {
      return { success: true, data: [] };
    }

    const categoriesResult = await categoryStorage.listCategoriesByUser(userId, key);
    const categories = graceful(categoriesResult, []);
    const categoryMap = new Map<string, Category>(categories.map((c) => [c.id, c]));

    const cycleEnd = toISO(endOfMonth(now.getFullYear(), now.getMonth()));
    const msInDay = 24 * 60 * 60 * 1000;
    const daysRemainingInCycle = Math.max(
      0,
      Math.ceil((endOfMonth(now.getFullYear(), now.getMonth()).getTime() - now.getTime()) / msInDay)
    );

    const results: BudgetUtilizationSummary[] = [];

    for (const budget of budgetsResult.data) {
      const category = categoryMap.get(budget.categoryId);
      if (!category) continue;

      const txResult = await transactionStorage.listTransactionsByDateRange(
        userId,
        cycleStart,
        cycleEnd,
        key
      );
      const transactions = graceful(txResult, []);

      const spent = transactions
        .filter((tx) => tx.categoryId === budget.categoryId && tx.type === 'Expense')
        .reduce((sum, tx) => sum + tx.amount, 0);

      const percentUsed = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

      results.push({
        budget,
        category,
        spent,
        percentUsed,
        isOverBudget: spent > budget.amount,
        isAlertTriggered: percentUsed >= budget.alertThreshold,
        daysRemainingInCycle,
      });
    }

    // Sort: over-budget first, then by percentUsed descending
    results.sort((a, b) => {
      if (a.isOverBudget && !b.isOverBudget) return -1;
      if (!a.isOverBudget && b.isOverBudget) return 1;
      return b.percentUsed - a.percentUsed;
    });

    return { success: true, data: results };
  } catch (err) {
    return makeError('BUDGET_UTILIZATION_FAILED', 'Failed to load budget utilization.', err);
  }
}

// ---------------------------------------------------------------------------
// getUpcomingBills
// ---------------------------------------------------------------------------

export async function getUpcomingBills(
  userId: UUID,
  _key: CryptoKey,
  days: number
): Promise<Result<UpcomingBill[]>> {
  try {
    const billsResult = await billStorage.listBillsByUser(userId);
    // Graceful degradation
    if (!billsResult.success) {
      return { success: true, data: [] };
    }

    const activeBills = billsResult.data.filter((b) => b.isActive);
    if (activeBills.length === 0) {
      return { success: true, data: [] };
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const msInDay = 24 * 60 * 60 * 1000;

    const results: UpcomingBill[] = [];

    for (const bill of activeBills) {
      // Get pending entries
      const entriesResult = await billEntryStorage.listEntriesByBill(bill.id);
      const entries = graceful(entriesResult, []);

      const pendingEntries = entries.filter((e) => e.status === 'Pending');

      for (const entry of pendingEntries) {
        const dueDate = new Date(entry.dueDate);
        if (dueDate > cutoff) continue;

        const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / msInDay);
        const isOverdue = daysUntilDue < 0;

        // Get account (graceful fallback)
        const accountResult = await accountStorage.getAccountById(bill.accountId, _key);
        if (!accountResult.success || !accountResult.data) continue;

        results.push({
          bill,
          entry,
          account: accountResult.data,
          daysUntilDue,
          isOverdue,
        });
      }
    }

    // Sort: overdue first, then by daysUntilDue ascending
    results.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return a.daysUntilDue - b.daysUntilDue;
    });

    return { success: true, data: results };
  } catch (err) {
    return makeError('UPCOMING_BILLS_FAILED', 'Failed to load upcoming bills.', err);
  }
}

// ---------------------------------------------------------------------------
// getGoalProgress
// ---------------------------------------------------------------------------

export async function getGoalProgress(
  userId: UUID,
  key: CryptoKey
): Promise<Result<GoalProgressSummary[]>> {
  try {
    const goalsResult = await goalStorage.listGoalsByUser(userId, key);
    // Graceful degradation
    if (!goalsResult.success) {
      return { success: true, data: [] };
    }

    if (goalsResult.data.length === 0) {
      return { success: true, data: [] };
    }

    const results: GoalProgressSummary[] = [];

    for (const goal of goalsResult.data) {
      const contribResult = await goalContributionStorage.listContributionsByGoal(goal.id, key);
      const contributions = graceful(contribResult, []);

      const totalContributed = contributions.reduce((sum, c) => sum + c.amount, 0);
      const percentComplete = Math.min(
        100,
        goal.targetAmount > 0 ? (totalContributed / goal.targetAmount) * 100 : 0
      );
      const remainingAmount = Math.max(0, goal.targetAmount - totalContributed);
      const isComplete = totalContributed >= goal.targetAmount;

      // Project completion date from contribution rate
      let projectedCompletionDate: ISODateString | null = null;
      let isOnTrack = false;

      if (isComplete) {
        projectedCompletionDate = goal.targetDate ?? null;
        isOnTrack = true;
      } else if (contributions.length >= 2) {
        // Rate = total contributed / days since first contribution
        const sortedDates = contributions
          .map((c) => new Date(c.date).getTime())
          .sort((a, b) => a - b);
        const firstDate = sortedDates[0];
        const now = Date.now();
        const daysSinceStart = Math.max(1, (now - firstDate) / (24 * 60 * 60 * 1000));
        const ratePerDay = totalContributed / daysSinceStart;

        if (ratePerDay > 0) {
          const daysToComplete = remainingAmount / ratePerDay;
          const projectedDate = new Date(now + daysToComplete * 24 * 60 * 60 * 1000);
          projectedCompletionDate = projectedDate.toISOString() as ISODateString;
          isOnTrack = goal.targetDate ? projectedDate <= new Date(goal.targetDate) : false;
        }
      }

      results.push({
        goal,
        totalContributed,
        percentComplete,
        remainingAmount,
        projectedCompletionDate,
        isOnTrack,
        isComplete,
      });
    }

    // Sort: incomplete first (by percent descending), then complete
    results.sort((a, b) => {
      if (!a.isComplete && b.isComplete) return -1;
      if (a.isComplete && !b.isComplete) return 1;
      return b.percentComplete - a.percentComplete;
    });

    return { success: true, data: results };
  } catch (err) {
    return makeError('GOAL_PROGRESS_FAILED', 'Failed to load goal progress.', err);
  }
}

// ---------------------------------------------------------------------------
// getRecentTransactions
// ---------------------------------------------------------------------------

export async function getRecentTransactions(
  userId: UUID,
  key: CryptoKey,
  limit: number
): Promise<Result<Transaction[]>> {
  try {
    const result = await transactionStorage.listTransactionsByUser(
      userId,
      {
        userId,
        limit,
        types: ['Income', 'Expense'],
        sortBy: 'date',
        sortOrder: 'desc',
      },
      key
    );
    if (!result.success) return result;
    return { success: true, data: result.data.transactions };
  } catch (err) {
    return makeError('RECENT_TRANSACTIONS_FAILED', 'Failed to load recent transactions.', err);
  }
}

// ---------------------------------------------------------------------------
// generateInsights (runs in a Web Worker)
// ---------------------------------------------------------------------------

export function generateInsights(input: InsightWorkerInput): Promise<Result<Insight[]>> {
  return new Promise((resolve) => {
    try {
      const worker = new Worker(new URL('../../workers/insights.worker.ts', import.meta.url), {
        type: 'module',
      });

      worker.onmessage = (event: MessageEvent<Insight[]>) => {
        worker.terminate();
        resolve({ success: true, data: event.data });
      };

      worker.onerror = (err) => {
        worker.terminate();
        resolve(makeError('INSIGHTS_WORKER_ERROR', 'Insights worker failed.', err));
      };

      worker.postMessage(input);
    } catch (err) {
      // Fall back to synchronous computation if worker creation fails
      resolve(makeError('INSIGHTS_WORKER_INIT_FAILED', 'Failed to start insights worker.', err));
    }
  });
}
