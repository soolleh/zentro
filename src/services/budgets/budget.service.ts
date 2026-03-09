/**
 * budget.service.ts
 *
 * Business logic for the Budgets module.
 * All methods return Result<T> or are synchronous pure functions.
 * No React, no Zustand. Keys and preferences passed from the store layer.
 */

import {
  parseISO,
  addMonths,
  subDays,
  differenceInDays,
  getDaysInMonth,
  getDate,
  getMonth,
  getYear,
} from 'date-fns';
import type { Result, UUID, ISODateString, Currency } from '@/shared/types/common.types';
import type {
  Budget,
  CycleDates,
  EnrichedBudget,
  BudgetCycleUtilization,
  CreateBudgetParams,
  SpendingVelocity,
} from '@/shared/types/budget.types';
import { budgetStorage } from '@/services/storage/budget.storage';
import { categoryStorage } from '@/services/storage/category.storage';
import { transactionStorage } from '@/services/storage/transaction.storage';

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

function clampDay(day: number, year: number, month: number): number {
  // month is 0-indexed
  return Math.min(day, getDaysInMonth(new Date(year, month)));
}

function makeCycleStartDate(year: number, month: number, cycleStartDay: number): Date {
  return new Date(year, month, clampDay(cycleStartDay, year, month));
}

function cycleStartToISO(date: Date): ISODateString {
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}` as ISODateString;
}

function cycleEndToISO(date: Date): ISODateString {
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}` as ISODateString;
}

// ---------------------------------------------------------------------------
// Public pure functions
// ---------------------------------------------------------------------------

export function getCycleDates(referenceDate: ISODateString, cycleStartDay: number): CycleDates {
  const ref = parseISO(referenceDate);
  const refDay = getDate(ref);
  const refYear = getYear(ref);
  const refMonth = getMonth(ref); // 0-indexed

  let cycleStartDate: Date;
  if (refDay >= cycleStartDay) {
    cycleStartDate = makeCycleStartDate(refYear, refMonth, cycleStartDay);
  } else {
    // Previous month
    const prevDate = addMonths(ref, -1);
    cycleStartDate = makeCycleStartDate(getYear(prevDate), getMonth(prevDate), cycleStartDay);
  }

  // Next cycle start: add 1 month then clamp
  const nextMonthBase = addMonths(cycleStartDate, 1);
  const nextCycleStartDate = makeCycleStartDate(
    getYear(nextMonthBase),
    getMonth(nextMonthBase),
    cycleStartDay
  );

  const cycleEndDate = subDays(nextCycleStartDate, 1);

  return {
    cycleStart: cycleStartToISO(cycleStartDate),
    cycleEnd: cycleEndToISO(cycleEndDate),
  };
}

export function getAdjacentCycle(
  cycleStart: ISODateString,
  direction: 'prev' | 'next',
  cycleStartDay: number
): CycleDates {
  const start = parseISO(cycleStart);
  if (direction === 'prev') {
    // Go back 1 day from cycleStart → lands in the previous cycle
    const prevDay = subDays(start, 1);
    return getCycleDates(prevDay.toISOString() as ISODateString, cycleStartDay);
  }
  // Go forward: add 1 month from cycleStart
  const nextMonthBase = addMonths(start, 1);
  const nextCycleStart = makeCycleStartDate(
    getYear(nextMonthBase),
    getMonth(nextMonthBase),
    cycleStartDay
  );
  return getCycleDates(nextCycleStart.toISOString() as ISODateString, cycleStartDay);
}

// ---------------------------------------------------------------------------
// Async service functions
// ---------------------------------------------------------------------------

export async function getBudgetUtilizationForCycle(
  userId: UUID,
  cycleStart: ISODateString,
  cycleEnd: ISODateString,
  key: CryptoKey,
  baseCurrency: Currency
): Promise<Result<BudgetCycleUtilization>> {
  try {
    const budgetsResult = await budgetStorage.listBudgetsByCycle(userId, cycleStart, key);
    if (!budgetsResult.success) return budgetsResult;

    if (budgetsResult.data.length === 0) {
      return {
        success: true,
        data: {
          cycleStart,
          cycleEnd,
          budgets: [],
          totalAllocated: 0,
          totalSpent: 0,
          totalRemaining: 0,
          overallUtilization: 0,
          hasOverspend: false,
          currency: baseCurrency,
        },
      };
    }

    // Fetch all transactions in cycle range
    const from = `${cycleStart}T00:00:00.000Z` as ISODateString;
    const to = `${cycleEnd}T23:59:59.999Z` as ISODateString;
    const txResult = await transactionStorage.listTransactionsByDateRange(userId, from, to, key);
    if (!txResult.success) return txResult;

    // Fetch categories
    const catResult = await categoryStorage.listCategoriesByUser(userId, key);
    if (!catResult.success) return catResult;
    const catMap = new Map(catResult.data.map((c) => [c.id, c]));

    // Find most recent previous cycle for carry-forward computation
    const allBudgetsResult = await budgetStorage.listBudgetsByUser(userId, key);
    let prevBudgets: Budget[] = [];
    const prevSpentByCategory = new Map<UUID, number>();
    if (allBudgetsResult.success) {
      const prevCycleStart = findMostRecentCycleBefore(allBudgetsResult.data, cycleStart);
      if (prevCycleStart !== null) {
        const prevBudgetsResult = await budgetStorage.listBudgetsByCycle(
          userId,
          prevCycleStart,
          key
        );
        if (prevBudgetsResult.success) {
          prevBudgets = prevBudgetsResult.data;
          const prevCycleEnd = prevBudgets.length > 0 ? prevBudgets[0].cycleEnd : prevCycleStart;
          const prevFrom = `${prevCycleStart}T00:00:00.000Z` as ISODateString;
          const prevTo = `${prevCycleEnd}T23:59:59.999Z` as ISODateString;
          const prevTxResult = await transactionStorage.listTransactionsByDateRange(
            userId,
            prevFrom,
            prevTo,
            key
          );
          if (prevTxResult.success) {
            for (const tx of prevTxResult.data) {
              if (tx.type !== 'Expense') continue;
              // Credit to own category
              const existing = prevSpentByCategory.get(tx.categoryId) ?? 0;
              prevSpentByCategory.set(tx.categoryId, existing + tx.amount);
              // Also credit to parent category so carry-forward works for parent budgets
              const txCat = catMap.get(tx.categoryId);
              if (txCat?.parentId != null) {
                const parentExisting = prevSpentByCategory.get(txCat.parentId) ?? 0;
                prevSpentByCategory.set(txCat.parentId, parentExisting + tx.amount);
              }
            }
          }
        }
      }
    }

    // Velocity time data
    const today = new Date();
    const cycleStartDate = parseISO(cycleStart);
    const cycleEndDate = parseISO(cycleEnd);
    const daysInCycle = differenceInDays(cycleEndDate, cycleStartDate) + 1;
    const daysElapsed = Math.max(
      1,
      Math.min(daysInCycle, differenceInDays(today, cycleStartDate) + 1)
    );
    const daysRemaining = Math.max(0, daysInCycle - daysElapsed);

    const enrichedBudgets: EnrichedBudget[] = [];

    for (const budget of budgetsResult.data) {
      const category = catMap.get(budget.categoryId);
      if (category === undefined) continue;

      // Collect matching category IDs: the budget's own category + any direct children
      const childIds = catResult.data
        .filter((c) => c.parentId === budget.categoryId)
        .map((c) => c.id);
      const matchIds = new Set<UUID>([budget.categoryId, ...childIds]);

      const budgetTx = txResult.data.filter(
        (tx) => matchIds.has(tx.categoryId) && tx.type === 'Expense'
      );
      const spent = budgetTx.reduce((s, tx) => s + tx.amount, 0);

      let carryForwardAmount = 0;
      if (budget.carryForward) {
        const prevBudget = prevBudgets.find((pb) => pb.categoryId === budget.categoryId);
        if (prevBudget !== undefined) {
          const prevSpent = prevSpentByCategory.get(budget.categoryId) ?? 0;
          carryForwardAmount = Math.max(0, prevBudget.amount - prevSpent);
        }
      }

      const effectiveAmount = budget.amount + carryForwardAmount;
      const remaining = effectiveAmount - spent;
      const percentUsed = effectiveAmount > 0 ? (spent / effectiveAmount) * 100 : 0;
      const isOverBudget = spent > effectiveAmount;
      const isAlertTriggered = !isOverBudget && percentUsed >= budget.alertThreshold;

      const dailyAverage = spent / daysElapsed;
      const projectedTotal = dailyAverage * daysInCycle;
      const projectedPercentUsed =
        effectiveAmount > 0 ? (projectedTotal / effectiveAmount) * 100 : 0;

      const velocity: SpendingVelocity = {
        dailyAverage,
        projectedTotal,
        projectedPercentUsed,
        isOnTrack: projectedTotal <= effectiveAmount,
        daysRemaining,
      };

      enrichedBudgets.push({
        budget,
        category,
        spent,
        remaining,
        percentUsed,
        isOverBudget,
        isAlertTriggered,
        carryForwardAmount,
        effectiveAmount,
        velocity,
        transactions: budgetTx,
      });
    }

    const totalAllocated = enrichedBudgets.reduce((s, eb) => s + eb.effectiveAmount, 0);
    const totalSpent = enrichedBudgets.reduce((s, eb) => s + eb.spent, 0);
    const totalRemaining = totalAllocated - totalSpent;
    const overallUtilization = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;
    const hasOverspend = enrichedBudgets.some((eb) => eb.isOverBudget);

    return {
      success: true,
      data: {
        cycleStart,
        cycleEnd,
        budgets: enrichedBudgets,
        totalAllocated,
        totalSpent,
        totalRemaining,
        overallUtilization,
        hasOverspend,
        currency: baseCurrency,
      },
    };
  } catch (err) {
    return makeError('BUDGET_UTILIZATION_FAILED', 'Failed to compute budget utilization.', err);
  }
}

export async function createBudgetForCycle(
  userId: UUID,
  params: CreateBudgetParams,
  key: CryptoKey
): Promise<Result<Budget>> {
  try {
    const today = new Date().toISOString() as ISODateString;
    const refDate = params.referenceDate ?? today;
    const cycleDates = getCycleDates(refDate, params.cycleStartDay);

    // Check for duplicate
    const existingResult = await budgetStorage.listBudgetsByCycle(
      userId,
      cycleDates.cycleStart,
      key
    );
    if (!existingResult.success) return existingResult;
    const duplicate = existingResult.data.find((b) => b.categoryId === params.categoryId);
    if (duplicate !== undefined) {
      return makeError(
        'BUDGET_ALREADY_EXISTS',
        'A budget for this category already exists this cycle.'
      );
    }

    return await budgetStorage.createBudget(
      {
        userId,
        categoryId: params.categoryId,
        amount: params.amount,
        currency: params.currency,
        cycleStart: cycleDates.cycleStart,
        cycleEnd: cycleDates.cycleEnd,
        carryForward: params.carryForward,
        alertThreshold: params.alertThreshold,
      },
      key
    );
  } catch (err) {
    return makeError('BUDGET_CREATE_FAILED', 'Failed to create budget for cycle.', err);
  }
}

export async function updateBudgetAmount(
  budgetId: UUID,
  newAmount: number,
  key: CryptoKey
): Promise<Result<Budget>> {
  if (newAmount <= 0) {
    return makeError('BUDGET_INVALID_AMOUNT', 'Budget amount must be greater than 0.');
  }
  return await budgetStorage.updateBudget(budgetId, { amount: newAmount }, key);
}

export async function ensureBudgetsForCycle(
  userId: UUID,
  cycleStart: ISODateString,
  cycleStartDay: number,
  key: CryptoKey
): Promise<Result<void>> {
  try {
    const cycleDates = getCycleDates(cycleStart, cycleStartDay);
    const existingResult = await budgetStorage.listBudgetsByCycle(
      userId,
      cycleDates.cycleStart,
      key
    );
    if (!existingResult.success) return existingResult;

    if (existingResult.data.length > 0) {
      return { success: true, data: undefined };
    }

    // Find most recent cycle with budgets
    const allResult = await budgetStorage.listBudgetsByUser(userId, key);
    if (!allResult.success) return allResult;

    const prevCycleStart = findMostRecentCycleBefore(allResult.data, cycleDates.cycleStart);
    if (prevCycleStart === null) {
      return { success: true, data: undefined };
    }

    const copyResult = await budgetStorage.copyBudgetsToNextCycle(
      userId,
      prevCycleStart,
      cycleDates,
      key
    );
    if (!copyResult.success) return copyResult;

    return { success: true, data: undefined };
  } catch (err) {
    return makeError('BUDGET_ENSURE_FAILED', 'Failed to ensure budgets for cycle.', err);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function findMostRecentCycleBefore(
  budgets: Budget[],
  cycleStart: ISODateString
): ISODateString | null {
  const candidates = budgets.map((b) => b.cycleStart).filter((cs) => cs < cycleStart);
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (a > b ? a : b));
}
