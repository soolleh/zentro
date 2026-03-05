/**
 * reports-anomaly.worker.ts
 *
 * Detects spending anomalies using a 3-month rolling average per category.
 * Runs off the main thread to avoid blocking the UI.
 *
 * Input:  { type: 'DETECT_ANOMALIES', transactions: Transaction[], filters: ReportFilters }
 * Output: { type: 'ANOMALY_RESULT', flags: AnomalyFlag[] }
 */

import type { Transaction } from '../shared/types/transaction.types';
import type { AnomalyFlag, ReportFilters } from '../shared/types/reports.types';
import type { UUID, ISODateString } from '../shared/types/common.types';

// ---------------------------------------------------------------------------
// Input / Output message types
// ---------------------------------------------------------------------------

type DetectAnomaliesInput = {
  type: 'DETECT_ANOMALIES';
  transactions: Transaction[];
  filters: ReportFilters;
  categoryNames: Record<UUID, string>;
};

type AnomalyResultOutput = {
  type: 'ANOMALY_RESULT';
  flags: AnomalyFlag[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns "YYYY-MM" key for a transaction date string */
function monthKey(date: ISODateString): string {
  return date.substring(0, 7);
}

/** Returns a Date for YYYY-MM month key */
function parseMonthKey(key: string): Date {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

/** Returns the 3 calendar months immediately before the given month key */
function prior3Months(key: string): string[] {
  const d = parseMonthKey(key);
  const result: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const prior = new Date(d);
    prior.setMonth(prior.getMonth() - i);
    const y = prior.getFullYear().toString();
    const m = String(prior.getMonth() + 1).padStart(2, '0');
    result.push(`${y}-${m}`);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Algorithm
// ---------------------------------------------------------------------------

function detectAnomalies(
  transactions: Transaction[],
  filters: ReportFilters,
  categoryNames: Record<UUID, string>
): AnomalyFlag[] {
  // Filter: only expenses, apply account / category filters
  const expenseTxs = transactions.filter((tx) => {
    if (tx.type !== 'Expense') return false;
    if (filters.accountIds.length > 0 && !filters.accountIds.includes(tx.accountId)) return false;
    if (filters.categoryIds.length > 0 && !filters.categoryIds.includes(tx.categoryId))
      return false;
    const txDate = tx.date;
    if (txDate < filters.dateFrom || txDate > filters.dateTo) return false;
    return true;
  });

  // Group by category → month → total spend
  const categoryMonthSpend = new Map<UUID, Map<string, number>>();
  for (const tx of expenseTxs) {
    const mk = monthKey(tx.date);
    let monthMap = categoryMonthSpend.get(tx.categoryId);
    if (!monthMap) {
      monthMap = new Map<string, number>();
      categoryMonthSpend.set(tx.categoryId, monthMap);
    }
    monthMap.set(mk, (monthMap.get(mk) ?? 0) + tx.amount);
  }

  // Sort expenseTxs oldest → newest
  const sorted = [...expenseTxs].sort((a, b) => a.date.localeCompare(b.date));

  const flags: AnomalyFlag[] = [];

  for (const tx of sorted) {
    const mk = monthKey(tx.date);
    const prior = prior3Months(mk);
    const monthMap = categoryMonthSpend.get(tx.categoryId);
    if (!monthMap) continue;

    // Count how many prior months have data
    const priorValues = prior.map((p) => monthMap.get(p) ?? 0).filter((v) => v > 0);
    if (priorValues.length < 3) continue; // not enough history

    const rollingAverage = priorValues.reduce((s, v) => s + v, 0) / priorValues.length;
    if (rollingAverage === 0) continue;

    const deviationPercent = ((tx.amount - rollingAverage) / rollingAverage) * 100;

    if (deviationPercent >= 50) {
      const severity: AnomalyFlag['severity'] = deviationPercent >= 100 ? 'high' : 'moderate';
      flags.push({
        transactionId: tx.id,
        categoryId: tx.categoryId,
        categoryName: categoryNames[tx.categoryId] ?? 'Unknown',
        amount: tx.amount,
        date: tx.date,
        rollingAverage,
        deviationPercent,
        severity,
      });
    }
  }

  // Sort by deviation descending, return maximum 10
  flags.sort((a, b) => b.deviationPercent - a.deviationPercent);
  return flags.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

self.onmessage = (event: MessageEvent<DetectAnomaliesInput>) => {
  const { transactions, filters, categoryNames } = event.data;

  const flags = detectAnomalies(transactions, filters, categoryNames);
  const output: AnomalyResultOutput = { type: 'ANOMALY_RESULT', flags };
  self.postMessage(output);
};
