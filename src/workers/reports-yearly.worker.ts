/**
 * reports-yearly.worker.ts
 *
 * Computes yearly overview for a given year from raw transaction data.
 * Runs off the main thread to avoid blocking the UI.
 *
 * Input:  { type: 'COMPUTE_YEARLY', transactions: Transaction[], year: number, filters: ReportFilters }
 * Output: { type: 'YEARLY_RESULT', result: YearlyOverview }
 */

import type { Transaction } from '../shared/types/transaction.types';
import type {
  MonthlyBreakdown,
  YearlyOverview,
  CategoryBreakdownItem,
  ReportFilters,
} from '../shared/types/reports.types';
import type { UUID, ISODateString } from '../shared/types/common.types';

// ---------------------------------------------------------------------------
// Input / Output message types
// ---------------------------------------------------------------------------

type ComputeYearlyInput = {
  type: 'COMPUTE_YEARLY';
  transactions: Transaction[];
  year: number;
  filters: ReportFilters;
};

type YearlyResultOutput = {
  type: 'YEARLY_RESULT';
  result: YearlyOverview;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toISO(year: number, month: number): ISODateString {
  const mm = String(month + 1).padStart(2, '0');
  return `${String(year)}-${mm}-01T00:00:00.000Z` as ISODateString;
}

function computeMonthlyBreakdown(
  year: number,
  month: number,
  transactions: Transaction[],
  categoryMap: Map<UUID, { name: string; color: string }>
): MonthlyBreakdown {
  let income = 0;
  let expenses = 0;
  const categoryTotals = new Map<UUID, { amount: number; count: number }>();

  for (const tx of transactions) {
    if (tx.type === 'Income') {
      income += tx.amount;
    } else if (tx.type === 'Expense') {
      expenses += tx.amount;
      const existing = categoryTotals.get(tx.categoryId) ?? { amount: 0, count: 0 };
      categoryTotals.set(tx.categoryId, {
        amount: existing.amount + tx.amount,
        count: existing.count + 1,
      });
    }
  }

  const savings = income - expenses;
  const savingsRate = income > 0 ? Math.max(-100, Math.min(100, (savings / income) * 100)) : 0;

  const categoryBreakdown: CategoryBreakdownItem[] = [];
  for (const [catId, { amount, count }] of categoryTotals.entries()) {
    const meta = categoryMap.get(catId);
    categoryBreakdown.push({
      categoryId: catId,
      categoryName: meta?.name ?? 'Unknown',
      categoryColor: meta?.color ?? '#6b7280',
      amount,
      percentage: expenses > 0 ? (amount / expenses) * 100 : 0,
      transactionCount: count,
    });
  }
  categoryBreakdown.sort((a, b) => b.amount - a.amount);

  return {
    month: toISO(year, month),
    income,
    expenses,
    savings,
    savingsRate,
    categoryBreakdown,
  };
}

function computeYearly(
  transactions: Transaction[],
  year: number,
  filters: ReportFilters
): YearlyOverview {
  // Build a category map from the transactions themselves
  // (worker does not have access to storage; caller must pass enriched data)
  const categoryMap = new Map<UUID, { name: string; color: string }>();

  // Filter transactions to the given year
  const yearTransactions = transactions.filter((tx) => {
    if (tx.type === 'Transfer') return false;
    const txYear = parseInt(tx.date.substring(0, 4), 10);
    if (txYear !== year) return false;
    if (filters.accountIds.length > 0 && !filters.accountIds.includes(tx.accountId)) return false;
    if (filters.categoryIds.length > 0 && !filters.categoryIds.includes(tx.categoryId))
      return false;
    return true;
  });

  // Group by month
  const monthMap = new Map<number, Transaction[]>();
  for (let m = 0; m < 12; m++) {
    monthMap.set(m, []);
  }
  for (const tx of yearTransactions) {
    const m = parseInt(tx.date.substring(5, 7), 10) - 1;
    const arr = monthMap.get(m);
    if (arr) arr.push(tx);
  }

  const months: MonthlyBreakdown[] = [];
  let totalIncome = 0;
  let totalExpenses = 0;
  let totalSavingsRate = 0;
  let rateCount = 0;

  for (let m = 0; m < 12; m++) {
    const txs = monthMap.get(m) ?? [];
    const breakdown = computeMonthlyBreakdown(year, m, txs, categoryMap);
    months.push(breakdown);
    totalIncome += breakdown.income;
    totalExpenses += breakdown.expenses;
    if (breakdown.income > 0) {
      totalSavingsRate += breakdown.savingsRate;
      rateCount++;
    }
  }

  const totalSavings = totalIncome - totalExpenses;
  const averageSavingsRate =
    totalIncome > 0
      ? Math.max(-100, Math.min(100, (totalSavings / totalIncome) * 100))
      : rateCount > 0
        ? totalSavingsRate / rateCount
        : 0;

  return {
    year,
    months,
    totalIncome,
    totalExpenses,
    totalSavings,
    averageSavingsRate,
  };
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

self.onmessage = (event: MessageEvent<ComputeYearlyInput>) => {
  const { transactions, year, filters } = event.data;

  const result = computeYearly(transactions, year, filters);
  const output: YearlyResultOutput = { type: 'YEARLY_RESULT', result };
  self.postMessage(output);
};
