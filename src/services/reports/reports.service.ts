/**
 * reports.service.ts
 *
 * All report computation logic for the Reports & Analytics module.
 *
 * All methods return Promise<Result<T>>. No throws. No React. No Zustand.
 * Transfer transactions are excluded from all calculations.
 */

import type { Result, UUID, ISODateString } from '@/shared/types/common.types';
import type { Transaction } from '@/shared/types/transaction.types';
import type {
  MonthlyBreakdown,
  YearlyOverview,
  CategoryBreakdownItem,
  TrendPoint,
  AnomalyFlag,
  ReportFilters,
} from '@/shared/types/reports.types';
import { transactionStorage } from '@/services/storage/transaction.storage';
import { categoryStorage } from '@/services/storage/category.storage';
import { accountStorage } from '@/services/storage/account.storage';
import type { AccountType } from '@/shared/types/account.types';
import type { Category } from '@/shared/types/category.types';

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

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function toISO(year: number, month: number): ISODateString {
  const mm = String(month + 1).padStart(2, '0');
  return `${String(year)}-${mm}-01T00:00:00.000Z` as ISODateString;
}

function monthStartISO(d: Date): ISODateString {
  return toISO(d.getFullYear(), d.getMonth());
}

function subMonths(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(1);
  result.setMonth(result.getMonth() - n);
  return result;
}

function endOfMonthISO(year: number, month: number): ISODateString {
  const d = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return d.toISOString() as ISODateString;
}

function monthKey(date: ISODateString): string {
  return date.substring(0, 7);
}

// ---------------------------------------------------------------------------
// Shared: fetch all transactions for a user within a date range
// ---------------------------------------------------------------------------

async function fetchTransactions(
  userId: UUID,
  key: CryptoKey,
  dateFrom: ISODateString,
  dateTo: ISODateString
): Promise<Result<Transaction[]>> {
  const result = await transactionStorage.listTransactionsByUser(
    userId,
    {
      userId,
      dateFrom,
      dateTo,
      limit: 999999,
      sortBy: 'date',
      sortOrder: 'asc',
    },
    key
  );
  if (!result.success) return result;
  return { success: true, data: result.data.transactions };
}

// ---------------------------------------------------------------------------
// Shared: build category lookup map
// ---------------------------------------------------------------------------

async function buildCategoryMap(
  userId: UUID,
  key: CryptoKey
): Promise<Result<Map<UUID, Category>>> {
  const result = await categoryStorage.listCategoriesByUser(userId, key);
  if (!result.success) return result;
  const map = new Map<UUID, Category>();
  for (const cat of result.data) {
    map.set(cat.id, cat);
  }
  return { success: true, data: map };
}

// ---------------------------------------------------------------------------
// Shared: apply filters and exclude transfers
// ---------------------------------------------------------------------------

function applyFilters(
  transactions: Transaction[],
  filters: Pick<ReportFilters, 'accountIds' | 'categoryIds'>
): Transaction[] {
  return transactions.filter((tx) => {
    if (tx.type === 'Transfer') return false;
    if (filters.accountIds.length > 0 && !filters.accountIds.includes(tx.accountId)) return false;
    if (filters.categoryIds.length > 0 && !filters.categoryIds.includes(tx.categoryId))
      return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Shared: compute monthly breakdown from a filtered transaction array
// ---------------------------------------------------------------------------

function computeBreakdownForMonth(
  transactions: Transaction[],
  year: number,
  month: number,
  categoryMap: Map<UUID, Category>
): MonthlyBreakdown {
  let income = 0;
  let expenses = 0;
  const categoryTotals = new Map<UUID, { amount: number; count: number }>();

  for (const tx of transactions) {
    if (tx.type === 'Income') {
      income += tx.amount;
    } else if (tx.type === 'Expense') {
      expenses += tx.amount;
      const e = categoryTotals.get(tx.categoryId) ?? { amount: 0, count: 0 };
      categoryTotals.set(tx.categoryId, { amount: e.amount + tx.amount, count: e.count + 1 });
    }
  }

  const savings = income - expenses;
  const savingsRate = income > 0 ? Math.max(-100, Math.min(100, (savings / income) * 100)) : 0;

  const categoryBreakdown: CategoryBreakdownItem[] = [];
  for (const [catId, { amount, count }] of categoryTotals.entries()) {
    const cat = categoryMap.get(catId);
    categoryBreakdown.push({
      categoryId: catId,
      categoryName: cat?.name ?? 'Unknown',
      categoryColor: cat?.color ?? '#6b7280',
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

// ---------------------------------------------------------------------------
// getMonthlyBreakdown
// ---------------------------------------------------------------------------

export async function getMonthlyBreakdown(
  userId: UUID,
  key: CryptoKey,
  filters: ReportFilters
): Promise<Result<MonthlyBreakdown[]>> {
  try {
    const [txResult, catMapResult] = await Promise.all([
      fetchTransactions(userId, key, filters.dateFrom, filters.dateTo),
      buildCategoryMap(userId, key),
    ]);
    if (!txResult.success) return txResult;
    if (!catMapResult.success) return catMapResult;

    const transactions = applyFilters(txResult.data, filters);
    const categoryMap = catMapResult.data;

    // Group by "YYYY-MM"
    const monthMap = new Map<string, Transaction[]>();
    for (const tx of transactions) {
      const mk = monthKey(tx.date);
      let bucket = monthMap.get(mk);
      if (!bucket) {
        bucket = [];
        monthMap.set(mk, bucket);
      }
      bucket.push(tx);
    }

    const sortedKeys = [...monthMap.keys()].sort();
    const breakdowns: MonthlyBreakdown[] = sortedKeys.map((mk) => {
      const year = parseInt(mk.substring(0, 4), 10);
      const month = parseInt(mk.substring(5, 7), 10) - 1;
      const txs = monthMap.get(mk) ?? [];
      return computeBreakdownForMonth(txs, year, month, categoryMap);
    });

    return { success: true, data: breakdowns };
  } catch (err) {
    return makeError('MONTHLY_BREAKDOWN_FAILED', 'Failed to compute monthly breakdown.', err);
  }
}

// ---------------------------------------------------------------------------
// getYearlyOverview — delegates heavy work to worker; here we just fetch
// ---------------------------------------------------------------------------

export async function getYearlyOverviewData(
  userId: UUID,
  key: CryptoKey,
  year: number
): Promise<Result<Transaction[]>> {
  // Return all transactions for that year so the caller can hand them to the worker
  const dateFrom = `${String(year)}-01-01T00:00:00.000Z` as ISODateString;
  const dateTo = `${String(year)}-12-31T23:59:59.999Z` as ISODateString;
  return fetchTransactions(userId, key, dateFrom, dateTo);
}

// ---------------------------------------------------------------------------
// getCategoryDistribution
// ---------------------------------------------------------------------------

export async function getCategoryDistribution(
  userId: UUID,
  key: CryptoKey,
  filters: ReportFilters,
  type: 'expense' | 'income'
): Promise<Result<CategoryBreakdownItem[]>> {
  try {
    const [txResult, catMapResult] = await Promise.all([
      fetchTransactions(userId, key, filters.dateFrom, filters.dateTo),
      buildCategoryMap(userId, key),
    ]);
    if (!txResult.success) return txResult;
    if (!catMapResult.success) return catMapResult;

    const txType = type === 'expense' ? 'Expense' : 'Income';
    const transactions = applyFilters(txResult.data, filters).filter((tx) => tx.type === txType);
    const categoryMap = catMapResult.data;

    const categoryTotals = new Map<UUID, { amount: number; count: number }>();
    let total = 0;
    for (const tx of transactions) {
      const e = categoryTotals.get(tx.categoryId) ?? { amount: 0, count: 0 };
      categoryTotals.set(tx.categoryId, { amount: e.amount + tx.amount, count: e.count + 1 });
      total += tx.amount;
    }

    let items: CategoryBreakdownItem[] = [];
    for (const [catId, { amount, count }] of categoryTotals.entries()) {
      const cat = categoryMap.get(catId);
      items.push({
        categoryId: catId,
        categoryName: cat?.name ?? 'Unknown',
        categoryColor: cat?.color ?? '#6b7280',
        amount,
        percentage: total > 0 ? (amount / total) * 100 : 0,
        transactionCount: count,
      });
    }

    items.sort((a, b) => b.amount - a.amount);

    // Group beyond index 10 as "Other"
    if (items.length > 10) {
      const top = items.slice(0, 10);
      const rest = items.slice(10);
      const otherAmount = rest.reduce((s, i) => s + i.amount, 0);
      const otherCount = rest.reduce((s, i) => s + i.transactionCount, 0);
      top.push({
        categoryId: 'other' as UUID,
        categoryName: 'Other',
        categoryColor: '#9ca3af',
        amount: otherAmount,
        percentage: total > 0 ? (otherAmount / total) * 100 : 0,
        transactionCount: otherCount,
      });
      items = top;
    }

    return { success: true, data: items };
  } catch (err) {
    return makeError(
      'CATEGORY_DISTRIBUTION_FAILED',
      'Failed to compute category distribution.',
      err
    );
  }
}

// ---------------------------------------------------------------------------
// getIncomeExpenseTrend
// ---------------------------------------------------------------------------

export async function getIncomeExpenseTrend(
  userId: UUID,
  key: CryptoKey,
  months: number,
  filters: ReportFilters
): Promise<Result<{ incomeTrend: TrendPoint[]; expenseTrend: TrendPoint[] }>> {
  try {
    const now = new Date();
    const dateFrom = monthStartISO(subMonths(now, months - 1));
    const dateTo = endOfMonthISO(now.getFullYear(), now.getMonth());

    const txResult = await fetchTransactions(userId, key, dateFrom, dateTo);
    if (!txResult.success) return txResult;

    const transactions = applyFilters(txResult.data, filters);

    // Build month income/expense map
    const monthIncome = new Map<string, number>();
    const monthExpense = new Map<string, number>();
    for (const tx of transactions) {
      const mk = monthKey(tx.date);
      if (tx.type === 'Income') monthIncome.set(mk, (monthIncome.get(mk) ?? 0) + tx.amount);
      else if (tx.type === 'Expense') monthExpense.set(mk, (monthExpense.get(mk) ?? 0) + tx.amount);
    }

    // Build compare data if enabled
    let compareIncome: Map<string, number> | null = null;
    let compareExpense: Map<string, number> | null = null;

    if (filters.compareEnabled) {
      const cResult = await fetchTransactions(
        userId,
        key,
        filters.compareDateFrom,
        filters.compareDateTo
      );
      if (cResult.success) {
        const cTx = applyFilters(cResult.data, filters);
        compareIncome = new Map<string, number>();
        compareExpense = new Map<string, number>();
        for (const tx of cTx) {
          const mk = monthKey(tx.date);
          if (tx.type === 'Income') compareIncome.set(mk, (compareIncome.get(mk) ?? 0) + tx.amount);
          else if (tx.type === 'Expense')
            compareExpense.set(mk, (compareExpense.get(mk) ?? 0) + tx.amount);
        }
      }
    }

    const incomeTrend: TrendPoint[] = [];
    const expenseTrend: TrendPoint[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = subMonths(now, i);
      const mk = `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const date = monthStartISO(d);

      // For compare: map to the equivalent month in compare period (shift by 1 year)
      const compareDate = subMonths(d, 12);
      const compareMk = `${String(compareDate.getFullYear())}-${String(compareDate.getMonth() + 1).padStart(2, '0')}`;

      incomeTrend.push({
        date,
        value: monthIncome.get(mk) ?? 0,
        compareValue: filters.compareEnabled ? (compareIncome?.get(compareMk) ?? 0) : undefined,
      });

      expenseTrend.push({
        date,
        value: monthExpense.get(mk) ?? 0,
        compareValue: filters.compareEnabled ? (compareExpense?.get(compareMk) ?? 0) : undefined,
      });
    }

    return { success: true, data: { incomeTrend, expenseTrend } };
  } catch (err) {
    return makeError('INCOME_EXPENSE_TREND_FAILED', 'Failed to compute income/expense trend.', err);
  }
}

// ---------------------------------------------------------------------------
// getNetWorthTrend
// ---------------------------------------------------------------------------

const ASSET_TYPES: ReadonlyArray<AccountType> = [
  'Cash',
  'Bank',
  'Checking',
  'Savings',
  'Investment',
];
const LIABILITY_TYPES: ReadonlyArray<AccountType> = ['CreditCard', 'Loan'];

export async function getNetWorthTrend(
  userId: UUID,
  key: CryptoKey,
  months: number,
  _filters: ReportFilters
): Promise<Result<TrendPoint[]>> {
  try {
    const accountsResult = await accountStorage.listAccountsByUser(userId, key);
    if (!accountsResult.success) return accountsResult;

    const now = new Date();
    const trend: TrendPoint[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = subMonths(now, i);
      const monthEndDateStr = new Date(d.getFullYear(), d.getMonth() + 1, 0)
        .toISOString()
        .slice(0, 10) as ISODateString;
      const date = monthStartISO(d);

      let totalAssets = 0;
      let totalLiabilities = 0;

      for (const account of accountsResult.data) {
        const txResult = await transactionStorage.listTransactionsByAccount(
          account.id,
          { limit: 999999, dateTo: monthEndDateStr, sortBy: 'date', sortOrder: 'asc' },
          key
        );
        if (!txResult.success) continue;

        // Compute balance up to month end
        let balance = account.openingBalance;
        for (const tx of txResult.data.transactions) {
          if (tx.type === 'Income') balance += tx.amount;
          else if (tx.type === 'Expense') balance -= tx.amount;
          else if (tx.notes?.includes('→from]')) balance -= tx.amount;
          else if (tx.notes?.includes('→to]')) balance += tx.amount;
          else balance -= tx.amount;
        }

        if ((ASSET_TYPES as AccountType[]).includes(account.type)) {
          totalAssets += Math.max(0, balance);
        } else if ((LIABILITY_TYPES as AccountType[]).includes(account.type)) {
          totalLiabilities += Math.max(0, balance);
        }
      }

      trend.push({ date, value: totalAssets - totalLiabilities });
    }

    return { success: true, data: trend };
  } catch (err) {
    return makeError('NET_WORTH_TREND_FAILED', 'Failed to compute net worth trend.', err);
  }
}

// ---------------------------------------------------------------------------
// getSavingsRateTrend
// ---------------------------------------------------------------------------

export async function getSavingsRateTrend(
  userId: UUID,
  key: CryptoKey,
  months: number,
  filters: ReportFilters
): Promise<Result<TrendPoint[]>> {
  try {
    const now = new Date();
    const dateFrom = monthStartISO(subMonths(now, months - 1));
    const dateTo = endOfMonthISO(now.getFullYear(), now.getMonth());

    const txResult = await fetchTransactions(userId, key, dateFrom, dateTo);
    if (!txResult.success) return txResult;

    const transactions = applyFilters(txResult.data, filters);

    const monthIncome = new Map<string, number>();
    const monthExpense = new Map<string, number>();
    for (const tx of transactions) {
      const mk = monthKey(tx.date);
      if (tx.type === 'Income') monthIncome.set(mk, (monthIncome.get(mk) ?? 0) + tx.amount);
      else if (tx.type === 'Expense') monthExpense.set(mk, (monthExpense.get(mk) ?? 0) + tx.amount);
    }

    let compareIncome: Map<string, number> | null = null;
    let compareExpense: Map<string, number> | null = null;

    if (filters.compareEnabled) {
      const cResult = await fetchTransactions(
        userId,
        key,
        filters.compareDateFrom,
        filters.compareDateTo
      );
      if (cResult.success) {
        const cTx = applyFilters(cResult.data, filters);
        compareIncome = new Map<string, number>();
        compareExpense = new Map<string, number>();
        for (const tx of cTx) {
          const mk = monthKey(tx.date);
          if (tx.type === 'Income') compareIncome.set(mk, (compareIncome.get(mk) ?? 0) + tx.amount);
          else if (tx.type === 'Expense')
            compareExpense.set(mk, (compareExpense.get(mk) ?? 0) + tx.amount);
        }
      }
    }

    const trend: TrendPoint[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = subMonths(now, i);
      const mk = `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const date = monthStartISO(d);
      const compareDate = subMonths(d, 12);
      const compareMk = `${String(compareDate.getFullYear())}-${String(compareDate.getMonth() + 1).padStart(2, '0')}`;

      const inc = monthIncome.get(mk) ?? 0;
      const exp = monthExpense.get(mk) ?? 0;
      const rate = inc > 0 ? Math.max(-100, Math.min(100, ((inc - exp) / inc) * 100)) : 0;

      let compareRate: number | undefined;
      if (filters.compareEnabled && compareIncome && compareExpense) {
        const cInc = compareIncome.get(compareMk) ?? 0;
        const cExp = compareExpense.get(compareMk) ?? 0;
        compareRate = cInc > 0 ? Math.max(-100, Math.min(100, ((cInc - cExp) / cInc) * 100)) : 0;
      }

      trend.push({ date, value: rate, compareValue: compareRate });
    }

    return { success: true, data: trend };
  } catch (err) {
    return makeError('SAVINGS_RATE_TREND_FAILED', 'Failed to compute savings rate trend.', err);
  }
}

// ---------------------------------------------------------------------------
// getYearlyOverview — fetches data and delegates to worker
// ---------------------------------------------------------------------------

interface YearlyWorkerInput {
  type: 'COMPUTE_YEARLY';
  transactions: Transaction[];
  year: number;
  filters: ReportFilters;
}

interface YearlyWorkerOutput {
  type: 'YEARLY_RESULT';
  result: YearlyOverview;
}

export async function getYearlyOverview(
  userId: UUID,
  key: CryptoKey,
  year: number,
  filters: ReportFilters
): Promise<Result<YearlyOverview>> {
  try {
    const txResult = await getYearlyOverviewData(userId, key, year);
    if (!txResult.success) return txResult;

    return await new Promise<Result<YearlyOverview>>((resolve) => {
      const worker = new Worker(
        new URL('../../workers/reports-yearly.worker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = (e: MessageEvent<YearlyWorkerOutput>) => {
        worker.terminate();
        resolve({ success: true, data: e.data.result });
      };

      worker.onerror = (err) => {
        worker.terminate();
        resolve(makeError('YEARLY_WORKER_FAILED', err.message));
      };

      const msg: YearlyWorkerInput = {
        type: 'COMPUTE_YEARLY',
        transactions: txResult.data,
        year,
        filters,
      };
      worker.postMessage(msg);
    });
  } catch (err) {
    return makeError('YEARLY_OVERVIEW_FAILED', 'Failed to compute yearly overview.', err);
  }
}

// ---------------------------------------------------------------------------
// detectAnomalies — fetches data and creates worker
// ---------------------------------------------------------------------------

export interface AnomalyWorkerInput {
  type: 'DETECT_ANOMALIES';
  transactions: Transaction[];
  filters: ReportFilters;
  categoryNames: Record<UUID, string>;
}

interface AnomalyWorkerOutput {
  type: 'ANOMALY_RESULT';
  flags: AnomalyFlag[];
}

export async function detectAnomalies(
  userId: UUID,
  key: CryptoKey,
  filters: ReportFilters
): Promise<Result<AnomalyFlag[]>> {
  try {
    const [txResult, catMapResult] = await Promise.all([
      fetchTransactions(userId, key, filters.dateFrom, filters.dateTo),
      buildCategoryMap(userId, key),
    ]);
    if (!txResult.success) return txResult;
    if (!catMapResult.success) return catMapResult;

    const categoryNames: Record<UUID, string> = {};
    for (const [id, cat] of catMapResult.data.entries()) {
      categoryNames[id] = cat.name;
    }

    return await new Promise<Result<AnomalyFlag[]>>((resolve) => {
      const worker = new Worker(
        new URL('../../workers/reports-anomaly.worker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = (e: MessageEvent<AnomalyWorkerOutput>) => {
        worker.terminate();
        resolve({ success: true, data: e.data.flags });
      };

      worker.onerror = (err) => {
        worker.terminate();
        resolve(makeError('ANOMALY_WORKER_FAILED', err.message));
      };

      const msg: AnomalyWorkerInput = {
        type: 'DETECT_ANOMALIES',
        transactions: txResult.data,
        filters,
        categoryNames,
      };
      worker.postMessage(msg);
    });
  } catch (err) {
    return makeError('ANOMALY_DETECTION_FAILED', 'Failed to detect anomalies.', err);
  }
}

// ---------------------------------------------------------------------------
// exportReportCSV
// ---------------------------------------------------------------------------

export async function exportReportCSV(
  userId: UUID,
  key: CryptoKey,
  filters: ReportFilters
): Promise<Result<string>> {
  try {
    const [monthlyResult, categoryResult, anomalyResult] = await Promise.all([
      getMonthlyBreakdown(userId, key, filters),
      getCategoryDistribution(userId, key, filters, 'expense'),
      detectAnomalies(userId, key, filters),
    ]);

    const lines: string[] = [];

    // Section 1: Monthly summary
    lines.push('MONTHLY SUMMARY');
    lines.push('Month,Income,Expenses,Savings,Savings Rate');
    if (monthlyResult.success) {
      for (const m of monthlyResult.data) {
        const month = m.month.substring(0, 7);
        const rate = m.savingsRate.toFixed(1) + '%';
        lines.push(
          `${month},${m.income.toFixed(2)},${m.expenses.toFixed(2)},${m.savings.toFixed(2)},${rate}`
        );
      }
    }

    lines.push('');

    // Section 2: Category distribution
    lines.push('CATEGORY DISTRIBUTION (EXPENSES)');
    lines.push('Category,Amount,Percentage,Transactions');
    if (categoryResult.success) {
      for (const c of categoryResult.data) {
        lines.push(
          `${c.categoryName},${c.amount.toFixed(2)},${c.percentage.toFixed(1)}%,${String(c.transactionCount)}`
        );
      }
    }

    lines.push('');

    // Section 3: Anomalies
    lines.push('UNUSUAL SPENDING');
    lines.push('Date,Category,Amount,Rolling Average,Deviation');
    if (anomalyResult.success) {
      for (const a of anomalyResult.data) {
        lines.push(
          `${a.date.substring(0, 10)},${a.categoryName},${a.amount.toFixed(2)},${a.rollingAverage.toFixed(2)},${a.deviationPercent.toFixed(1)}%`
        );
      }
    }

    return { success: true, data: lines.join('\n') };
  } catch (err) {
    return makeError('EXPORT_CSV_FAILED', 'Failed to export report CSV.', err);
  }
}
