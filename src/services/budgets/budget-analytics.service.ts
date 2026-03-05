/**
 * budget-analytics.service.ts
 *
 * Analytics computations for the Budgets module.
 * All methods return Promise<Result<T>>. No React, no Zustand.
 * Keys and preferences are passed from the store layer.
 */

import { parseISO, subMonths, format } from 'date-fns';
import type { Result, UUID, ISODateString, Currency } from '@/shared/types/common.types';
import type {
  BudgetCycleUtilization,
  BudgetVsActual,
  CycleComparison,
  CategorySpendingTrend,
  SpendingTrendPoint,
  CategoryDrillDown,
  MerchantSummary,
  BudgetHealthScore,
} from '@/shared/types/budget.types';
import {
  getCycleDates,
  getAdjacentCycle,
  getBudgetUtilizationForCycle,
} from '@/services/budgets/budget.service';

// ---------------------------------------------------------------------------
// Error helper
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
// Internal: fetch a cycle's utilization (convenience wrapper)
// ---------------------------------------------------------------------------

async function fetchCycle(
  userId: UUID,
  cycleStart: ISODateString,
  cycleStartDay: number,
  key: CryptoKey,
  baseCurrency: Currency
): Promise<BudgetCycleUtilization | null> {
  const dates = getCycleDates(cycleStart, cycleStartDay);
  const result = await getBudgetUtilizationForCycle(
    userId,
    dates.cycleStart,
    dates.cycleEnd,
    key,
    baseCurrency
  );
  if (!result.success) return null;
  return result.data;
}

// ---------------------------------------------------------------------------
// 1. Budget vs Actual
// ---------------------------------------------------------------------------

export async function getBudgetVsActual(
  userId: UUID,
  cycleStart: ISODateString,
  cycleEnd: ISODateString,
  key: CryptoKey,
  baseCurrency: Currency
): Promise<Result<BudgetVsActual[]>> {
  try {
    const utilResult = await getBudgetUtilizationForCycle(
      userId,
      cycleStart,
      cycleEnd,
      key,
      baseCurrency
    );
    if (!utilResult.success) return utilResult;

    const items: BudgetVsActual[] = utilResult.data.budgets.map((eb) => ({
      categoryId: eb.budget.categoryId,
      categoryName: eb.category.name,
      categoryColor: eb.category.color,
      allocated: eb.effectiveAmount,
      spent: eb.spent,
      variance: eb.effectiveAmount - eb.spent,
      variancePercent:
        eb.effectiveAmount > 0 ? ((eb.effectiveAmount - eb.spent) / eb.effectiveAmount) * 100 : 0,
    }));

    // Sort: most under budget first (positive variance), over budget last
    items.sort((a, b) => b.variance - a.variance);

    return { success: true, data: items };
  } catch (err) {
    return makeError('BUDGET_VS_ACTUAL_FAILED', 'Failed to compute budget vs actual.', err);
  }
}

// ---------------------------------------------------------------------------
// 2. Cycle comparison
// ---------------------------------------------------------------------------

export async function getCycleComparison(
  userId: UUID,
  cycleStart: ISODateString,
  cycleStartDay: number,
  key: CryptoKey,
  baseCurrency: Currency
): Promise<Result<CycleComparison[]>> {
  try {
    const currentDates = getCycleDates(cycleStart, cycleStartDay);

    // Fetch current + 4 previous cycles in parallel
    const prevDates1 = getAdjacentCycle(currentDates.cycleStart, 'prev', cycleStartDay);
    const prevDates2 = getAdjacentCycle(prevDates1.cycleStart, 'prev', cycleStartDay);
    const prevDates3 = getAdjacentCycle(prevDates2.cycleStart, 'prev', cycleStartDay);
    const prevDates4 = getAdjacentCycle(prevDates3.cycleStart, 'prev', cycleStartDay);

    const [currentCycle, prev1, prev2, prev3, prev4] = await Promise.all([
      fetchCycle(userId, currentDates.cycleStart, cycleStartDay, key, baseCurrency),
      fetchCycle(userId, prevDates1.cycleStart, cycleStartDay, key, baseCurrency),
      fetchCycle(userId, prevDates2.cycleStart, cycleStartDay, key, baseCurrency),
      fetchCycle(userId, prevDates3.cycleStart, cycleStartDay, key, baseCurrency),
      fetchCycle(userId, prevDates4.cycleStart, cycleStartDay, key, baseCurrency),
    ]);

    if (!currentCycle) {
      return { success: true, data: [] };
    }

    // Build a map of categoryId → spent across 3-month history (prev1, prev2, prev3)
    const threeMonthCycles = [prev1, prev2, prev3].filter(
      (c): c is BudgetCycleUtilization => c !== null
    );

    // Gather all category IDs across current and previous
    const categoryIds = new Set<UUID>();
    for (const eb of currentCycle.budgets) categoryIds.add(eb.budget.categoryId);
    if (prev1) for (const eb of prev1.budgets) categoryIds.add(eb.budget.categoryId);

    const items: CycleComparison[] = [];

    for (const catId of categoryIds) {
      const currentEb = currentCycle.budgets.find((b) => b.budget.categoryId === catId);
      const prevEb = prev1?.budgets.find((b) => b.budget.categoryId === catId);

      // Need at least one side to exist
      const categoryName = currentEb?.category.name ?? prevEb?.category.name ?? 'Unknown';
      const categoryColor = currentEb?.category.color ?? prevEb?.category.color ?? '#888';

      const currentSpent = currentEb?.spent ?? 0;
      const previousSpent = prevEb?.spent ?? 0;

      // 3-month average
      let threeMonthTotal = currentSpent; // include current
      let threeMonthCount = 1;
      for (const cycle of threeMonthCycles) {
        const eb = cycle.budgets.find((b) => b.budget.categoryId === catId);
        if (eb !== undefined) {
          threeMonthTotal += eb.spent;
          threeMonthCount++;
        }
      }
      // Also include prev4 if available
      if (prev4) {
        const eb = prev4.budgets.find((b) => b.budget.categoryId === catId);
        if (eb !== undefined) {
          threeMonthTotal += eb.spent;
          threeMonthCount++;
        }
      }
      const threeMonthAverage =
        threeMonthCount > 0 ? threeMonthTotal / threeMonthCount : currentSpent;

      const trendPercent =
        previousSpent > 0
          ? ((currentSpent - previousSpent) / previousSpent) * 100
          : currentSpent > 0
            ? 100
            : 0;

      const trend: CycleComparison['trend'] =
        Math.abs(trendPercent) < 5 ? 'stable' : trendPercent > 0 ? 'up' : 'down';

      items.push({
        categoryId: catId,
        categoryName,
        categoryColor,
        currentCycleSpent: currentSpent,
        previousCycleSpent: previousSpent,
        threeMonthAverage,
        trend,
        trendPercent,
      });
    }

    // Sort: largest increase first
    items.sort((a, b) => b.trendPercent - a.trendPercent);

    return { success: true, data: items };
  } catch (err) {
    return makeError('CYCLE_COMPARISON_FAILED', 'Failed to compute cycle comparison.', err);
  }
}

// ---------------------------------------------------------------------------
// 3. Category spending trends
// ---------------------------------------------------------------------------

export async function getCategorySpendingTrends(
  userId: UUID,
  months: number,
  cycleStartDay: number,
  key: CryptoKey,
  baseCurrency: Currency
): Promise<Result<CategorySpendingTrend[]>> {
  try {
    const today = new Date();
    const cycleStarts: ISODateString[] = [];

    // Build list of cycle start dates going back `months` months
    for (let i = months - 1; i >= 0; i--) {
      const ref = subMonths(today, i);
      const refISO = ref.toISOString().slice(0, 10) as ISODateString;
      const dates = getCycleDates(refISO, cycleStartDay);
      // Deduplicate
      if (!cycleStarts.includes(dates.cycleStart)) {
        cycleStarts.push(dates.cycleStart);
      }
    }

    const cycles = await Promise.all(
      cycleStarts.map((cs) => fetchCycle(userId, cs, cycleStartDay, key, baseCurrency))
    );

    // Group by categoryId
    const categoryMap = new Map<
      UUID,
      {
        name: string;
        color: string;
        points: SpendingTrendPoint[];
        cycleSet: Set<ISODateString>;
      }
    >();

    for (let i = 0; i < cycles.length; i++) {
      const cycle = cycles[i];
      const cs = cycleStarts[i];
      if (!cycle) continue;
      for (const eb of cycle.budgets) {
        const catId = eb.budget.categoryId;
        if (!categoryMap.has(catId)) {
          categoryMap.set(catId, {
            name: eb.category.name,
            color: eb.category.color,
            points: [],
            cycleSet: new Set(),
          });
        }
        const entry = categoryMap.get(catId);
        if (entry && !entry.cycleSet.has(cs)) {
          entry.cycleSet.add(cs);
          entry.points.push({
            cycleStart: cs,
            spent: eb.spent,
            allocated: eb.effectiveAmount,
            percentUsed: eb.percentUsed,
          });
        }
      }
    }

    // Keep only categories with data in at least 2 cycles
    const trends: CategorySpendingTrend[] = [];
    for (const [catId, entry] of categoryMap) {
      if (entry.points.length < 2) continue;
      const avgSpend = entry.points.reduce((s, p) => s + p.spent, 0) / entry.points.length;
      trends.push({
        categoryId: catId,
        categoryName: entry.name,
        categoryColor: entry.color,
        points: [...entry.points].sort((a, b) => a.cycleStart.localeCompare(b.cycleStart)),
      });
      // Attach avgSpend for sorting (we'll sort before push)
      void avgSpend; // suppress unused warning
    }

    // Sort by average spend descending
    trends.sort((a, b) => {
      const avgA = a.points.reduce((s, p) => s + p.spent, 0) / a.points.length;
      const avgB = b.points.reduce((s, p) => s + p.spent, 0) / b.points.length;
      return avgB - avgA;
    });

    return { success: true, data: trends };
  } catch (err) {
    return makeError('SPENDING_TRENDS_FAILED', 'Failed to compute spending trends.', err);
  }
}

// ---------------------------------------------------------------------------
// 4. Category drill-down
// ---------------------------------------------------------------------------

export async function getCategoryDrillDown(
  userId: UUID,
  categoryId: UUID,
  cycleStart: ISODateString,
  cycleStartDay: number,
  key: CryptoKey,
  baseCurrency: Currency
): Promise<Result<CategoryDrillDown>> {
  try {
    const currentDates = getCycleDates(cycleStart, cycleStartDay);
    const currentCycleResult = await getBudgetUtilizationForCycle(
      userId,
      currentDates.cycleStart,
      currentDates.cycleEnd,
      key,
      baseCurrency
    );
    if (!currentCycleResult.success) return currentCycleResult;

    const currentEb = currentCycleResult.data.budgets.find(
      (b) => b.budget.categoryId === categoryId
    );
    if (!currentEb) {
      return makeError(
        'DRILL_DOWN_NOT_FOUND',
        'Budget not found for this category in the current cycle.'
      );
    }

    // Fetch last 6 cycles (excluding current)
    const historicalPoints: SpendingTrendPoint[] = [];
    let prevStart = currentDates.cycleStart;
    for (let i = 0; i < 6; i++) {
      const prevDates = getAdjacentCycle(prevStart, 'prev', cycleStartDay);
      const prevCycle = await fetchCycle(
        userId,
        prevDates.cycleStart,
        cycleStartDay,
        key,
        baseCurrency
      );
      if (prevCycle) {
        const prevEb = prevCycle.budgets.find((b) => b.budget.categoryId === categoryId);
        if (prevEb) {
          historicalPoints.unshift({
            cycleStart: prevDates.cycleStart,
            spent: prevEb.spent,
            allocated: prevEb.effectiveAmount,
            percentUsed: prevEb.percentUsed,
          });
        }
      }
      prevStart = prevDates.cycleStart;
    }

    // Add current cycle at end
    historicalPoints.push({
      cycleStart: currentDates.cycleStart,
      spent: currentEb.spent,
      allocated: currentEb.effectiveAmount,
      percentUsed: currentEb.percentUsed,
    });

    const transactions = currentEb.transactions;

    // Top merchants: group by first 3 words of notes
    const merchantMap = new Map<
      string,
      { totalSpent: number; transactionCount: number; lastDate: ISODateString }
    >();
    for (const tx of transactions) {
      if (tx.type !== 'Expense') continue;
      const words = (tx.notes ?? '').trim().split(/\s+/).slice(0, 3).join(' ');
      const merchantName = words.length > 0 ? words : 'Unknown';
      const existing = merchantMap.get(merchantName);
      const txDate = tx.date;
      if (!existing) {
        merchantMap.set(merchantName, {
          totalSpent: tx.amount,
          transactionCount: 1,
          lastDate: txDate,
        });
      } else {
        merchantMap.set(merchantName, {
          totalSpent: existing.totalSpent + tx.amount,
          transactionCount: existing.transactionCount + 1,
          lastDate: txDate > existing.lastDate ? txDate : existing.lastDate,
        });
      }
    }
    const topMerchants: MerchantSummary[] = Array.from(merchantMap.entries())
      .map(([name, data]) => ({
        name,
        totalSpent: data.totalSpent,
        transactionCount: data.transactionCount,
        lastTransactionDate: data.lastDate,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5);

    const expenseTx = transactions.filter((t) => t.type === 'Expense');
    const averageTransactionAmount =
      expenseTx.length > 0 ? expenseTx.reduce((s, t) => s + t.amount, 0) / expenseTx.length : 0;

    // Frequency: avg transactions per week
    // Use cycle length (days) to compute weeks
    const cycleDays =
      Math.abs(
        parseISO(currentDates.cycleEnd).getTime() - parseISO(currentDates.cycleStart).getTime()
      ) /
        (1000 * 60 * 60 * 24) +
      1;
    const cycleWeeks = Math.max(1, cycleDays / 7);
    const transactionFrequency = expenseTx.length / cycleWeeks;

    return {
      success: true,
      data: {
        category: currentEb.category,
        currentCycle: currentEb,
        historicalTrend: historicalPoints,
        transactions,
        topMerchants,
        averageTransactionAmount,
        transactionFrequency,
      },
    };
  } catch (err) {
    return makeError('DRILL_DOWN_FAILED', 'Failed to load category drill-down.', err);
  }
}

// ---------------------------------------------------------------------------
// 5. Compute health score (via Web Worker)
// ---------------------------------------------------------------------------

export async function computeHealthScore(
  userId: UUID,
  cycleStart: ISODateString,
  cycleStartDay: number,
  key: CryptoKey,
  baseCurrency: Currency
): Promise<Result<BudgetHealthScore>> {
  try {
    const currentDates = getCycleDates(cycleStart, cycleStartDay);

    // Fetch current + 3 previous cycles
    const prevDates1 = getAdjacentCycle(currentDates.cycleStart, 'prev', cycleStartDay);
    const prevDates2 = getAdjacentCycle(prevDates1.cycleStart, 'prev', cycleStartDay);
    const prevDates3 = getAdjacentCycle(prevDates2.cycleStart, 'prev', cycleStartDay);

    const [currentCycle, prev1, prev2, prev3] = await Promise.all([
      fetchCycle(userId, currentDates.cycleStart, cycleStartDay, key, baseCurrency),
      fetchCycle(userId, prevDates1.cycleStart, cycleStartDay, key, baseCurrency),
      fetchCycle(userId, prevDates2.cycleStart, cycleStartDay, key, baseCurrency),
      fetchCycle(userId, prevDates3.cycleStart, cycleStartDay, key, baseCurrency),
    ]);

    if (!currentCycle) {
      return makeError('HEALTH_SCORE_NO_DATA', 'No budget data available for this cycle.');
    }

    const historicalCycles = [prev1, prev2, prev3].filter(
      (c): c is BudgetCycleUtilization => c !== null && c.budgets.length > 0
    );

    return await new Promise<Result<BudgetHealthScore>>((resolve) => {
      try {
        const worker = new Worker(
          new URL('../../workers/budget-analytics.worker.ts', import.meta.url),
          { type: 'module' }
        );
        worker.onmessage = (event: MessageEvent<{ type: string; score: BudgetHealthScore }>) => {
          worker.terminate();
          resolve({ success: true, data: event.data.score });
        };
        worker.onerror = (err) => {
          worker.terminate();
          resolve(makeError('HEALTH_SCORE_WORKER_ERROR', 'Health score worker failed.', err));
        };
        worker.postMessage({
          type: 'COMPUTE_HEALTH_SCORE',
          currentCycle,
          historicalCycles,
        });
      } catch (err) {
        resolve(makeError('HEALTH_SCORE_WORKER_INIT', 'Failed to start health score worker.', err));
      }
    });
  } catch (err) {
    return makeError('HEALTH_SCORE_FAILED', 'Failed to compute health score.', err);
  }
}

// ---------------------------------------------------------------------------
// Re-export format helper for cycle labels
// ---------------------------------------------------------------------------

export function formatCycleLabel(cycleStart: ISODateString): string {
  try {
    return format(parseISO(cycleStart), 'MMM yyyy');
  } catch {
    return cycleStart;
  }
}
