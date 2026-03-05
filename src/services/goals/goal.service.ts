/**
 * goal.service.ts
 *
 * Business logic for the Goals module.
 * All methods return Result<T>. No throws. No React. No Zustand.
 */

import type { Result, UUID, ISODateString } from '@/shared/types/common.types';
import type { Transaction } from '@/shared/types/transaction.types';
import type { Account } from '@/shared/types/account.types';
import type {
  Goal,
  GoalContribution,
  EnrichedGoal,
  GoalMilestone,
  GoalProjection,
  ContributeParams,
} from '@/shared/types/goal.types';
import { goalStorage } from '@/services/storage/goal.storage';
import { goalContributionStorage } from '@/services/storage/goal-contribution.storage';
import { accountStorage } from '@/services/storage/account.storage';
import { transactionStorage } from '@/services/storage/transaction.storage';
import { CATEGORY_TRANSFER } from '@/shared/constants/categories.constants';
import { useSessionStore } from '@/app/stores/session.store';
import {
  parseISO,
  addMonths,
  subMonths,
  startOfMonth,
  differenceInMonths,
  formatISO,
} from 'date-fns';

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

function getKey(): CryptoKey | null {
  return useSessionStore.getState().derivedKey;
}

// ---------------------------------------------------------------------------
// Milestone computation
// ---------------------------------------------------------------------------

const MILESTONE_THRESHOLDS: ReadonlyArray<25 | 50 | 75 | 100> = [25, 50, 75, 100];

function computeMilestones(goal: Goal, contributions: GoalContribution[]): GoalMilestone[] {
  const sorted = [...contributions].sort((a, b) => a.date.localeCompare(b.date));

  let running = 0;
  const runningTotals: number[] = sorted.map((c) => {
    running += c.amount;
    return running;
  });

  return MILESTONE_THRESHOLDS.map((percent) => {
    const amount = (goal.targetAmount * percent) / 100;
    const idx = runningTotals.findIndex((total) => total >= amount);
    const isReached = idx !== -1;
    const reachedAt = isReached ? sorted[idx].date : null;
    return { percent, amount, isReached, reachedAt };
  });
}

// ---------------------------------------------------------------------------
// Projection computation
// ---------------------------------------------------------------------------

function computeProjection(
  goal: Goal,
  remainingAmount: number,
  contributions: GoalContribution[]
): GoalProjection {
  const now = new Date();
  const periodStart = startOfMonth(subMonths(now, 2));

  const recentTotal = contributions
    .filter((c) => parseISO(c.date) >= periodStart)
    .reduce((sum, c) => sum + c.amount, 0);

  const monthlyContributionRate = recentTotal / 3;

  let projectedCompletionDate: ISODateString | null = null;
  let monthsToCompletion: number | null = null;

  if (remainingAmount <= 0) {
    monthsToCompletion = 0;
    projectedCompletionDate = formatISO(now, { representation: 'date' }) as ISODateString;
  } else if (monthlyContributionRate > 0) {
    monthsToCompletion = Math.ceil(remainingAmount / monthlyContributionRate);
    projectedCompletionDate = formatISO(addMonths(now, monthsToCompletion), {
      representation: 'date',
    }) as ISODateString;
  }

  let isOnTrack = true;
  if (goal.targetDate && projectedCompletionDate && remainingAmount > 0) {
    isOnTrack = projectedCompletionDate <= goal.targetDate;
  }

  let requiredMonthlyAmount: number | null = null;
  if (goal.targetDate && remainingAmount > 0) {
    const monthsUntilTarget = differenceInMonths(parseISO(goal.targetDate), now);
    requiredMonthlyAmount =
      monthsUntilTarget > 0 ? remainingAmount / monthsUntilTarget : remainingAmount;
  }

  return {
    monthlyContributionRate,
    projectedCompletionDate,
    isOnTrack,
    monthsToCompletion,
    requiredMonthlyAmount,
  };
}

// ---------------------------------------------------------------------------
// enrichGoal — pure synchronous function
// ---------------------------------------------------------------------------

export function enrichGoal(
  goal: Goal,
  contributions: GoalContribution[],
  linkedAccount: Account | null
): EnrichedGoal {
  const totalContributed = contributions.reduce((sum, c) => sum + c.amount, 0);
  const percentComplete = Math.min(
    100,
    goal.targetAmount > 0 ? Math.round((totalContributed / goal.targetAmount) * 100) : 0
  );
  const remainingAmount = Math.max(0, goal.targetAmount - totalContributed);
  const isComplete = totalContributed >= goal.targetAmount;
  const completedAt = goal.completedAt ?? null;
  const milestones = computeMilestones(goal, contributions);
  const projection = computeProjection(goal, remainingAmount, contributions);

  return {
    goal,
    contributions,
    totalContributed,
    percentComplete,
    remainingAmount,
    isComplete,
    completedAt,
    milestones,
    projection,
    linkedAccount,
  };
}

// ---------------------------------------------------------------------------
// getAllEnrichedGoals
// ---------------------------------------------------------------------------

export async function getAllEnrichedGoals(userId: UUID): Promise<Result<EnrichedGoal[]>> {
  const key = getKey();
  if (!key) return makeError('NO_KEY', 'No encryption key available.');

  try {
    const goalsResult = await goalStorage.listGoalsByUser(userId, key);
    if (!goalsResult.success) return goalsResult;

    const enriched: EnrichedGoal[] = [];

    for (const goal of goalsResult.data) {
      const contribResult = await goalContributionStorage.listContributionsByGoal(goal.id, key);
      if (!contribResult.success) return contribResult;

      let linkedAccount: Account | null = null;
      if (goal.linkedAccountId) {
        const acctResult = await accountStorage.getAccountById(goal.linkedAccountId, key);
        if (acctResult.success) linkedAccount = acctResult.data;
      }

      enriched.push(enrichGoal(goal, contribResult.data, linkedAccount));
    }

    // Sort: incomplete first by percentComplete descending, complete last by completedAt descending
    enriched.sort((a, b) => {
      if (a.isComplete !== b.isComplete) return a.isComplete ? 1 : -1;
      if (!a.isComplete) return b.percentComplete - a.percentComplete;
      const aDate = a.completedAt ?? '';
      const bDate = b.completedAt ?? '';
      return bDate.localeCompare(aDate);
    });

    return { success: true, data: enriched };
  } catch (err) {
    return makeError('ENRICH_GOALS_FAILED', 'Failed to load enriched goals.', err);
  }
}

// ---------------------------------------------------------------------------
// contribute
// ---------------------------------------------------------------------------

export async function contribute(
  userId: UUID,
  params: ContributeParams
): Promise<
  Result<{
    contribution: GoalContribution;
    transaction: Transaction;
    newTotal: number;
    milestonesReached: GoalMilestone[];
  }>
> {
  const key = getKey();
  if (!key) return makeError('NO_KEY', 'No encryption key available.');

  if (params.amount <= 0) {
    return makeError('INVALID_AMOUNT', 'Contribution amount must be greater than 0.');
  }

  try {
    // Validate account belongs to user
    const accountResult = await accountStorage.getAccountById(params.fromAccountId, key);
    if (!accountResult.success) return accountResult;
    if (!accountResult.data) {
      return makeError('ACCOUNT_NOT_FOUND', 'From account not found.');
    }
    if (accountResult.data.userId !== userId) {
      return makeError('UNAUTHORIZED', 'Account does not belong to this user.');
    }

    // Get goal
    const goalResult = await goalStorage.getGoalById(params.goalId, key);
    if (!goalResult.success) return goalResult;
    if (!goalResult.data) {
      return makeError('GOAL_NOT_FOUND', 'Goal not found.');
    }
    const goal = goalResult.data;

    // Compute total before this contribution
    const prevContribsResult = await goalContributionStorage.listContributionsByGoal(
      params.goalId,
      key
    );
    if (!prevContribsResult.success) return prevContribsResult;
    const totalBefore = prevContribsResult.data.reduce((sum, c) => sum + c.amount, 0);

    // Create the expense transaction
    const txResult = await transactionStorage.createTransaction(
      {
        userId,
        accountId: params.fromAccountId,
        type: 'Expense',
        amount: params.amount,
        currency: goal.currency,
        categoryId: CATEGORY_TRANSFER.id,
        date: params.date,
        notes: `[goal:${params.goalId}] ${params.notes ?? goal.name}`,
        isReconciled: false,
      },
      key
    );
    if (!txResult.success) return txResult;
    const transaction = txResult.data;

    // Create the contribution record
    const contribResult = await goalContributionStorage.createContribution(
      {
        goalId: params.goalId,
        fromAccountId: params.fromAccountId,
        amount: params.amount,
        date: params.date,
        transactionId: transaction.id,
        notes: params.notes,
      },
      key
    );
    if (!contribResult.success) return contribResult;
    const contribution = contribResult.data;

    const newTotal = totalBefore + params.amount;

    // Find newly crossed milestones
    const milestonesReached: GoalMilestone[] = MILESTONE_THRESHOLDS.filter((percent) => {
      const threshold = (goal.targetAmount * percent) / 100;
      return totalBefore < threshold && newTotal >= threshold;
    }).map((percent) => ({
      percent,
      amount: (goal.targetAmount * percent) / 100,
      isReached: true,
      reachedAt: params.date,
    }));

    // If newly complete, update goal with completedAt
    if (totalBefore < goal.targetAmount && newTotal >= goal.targetAmount) {
      await goalStorage.updateGoal(
        goal.id,
        { completedAt: new Date().toISOString() as ISODateString },
        key
      );
    }

    return { success: true, data: { contribution, transaction, newTotal, milestonesReached } };
  } catch (err) {
    return makeError('CONTRIBUTE_FAILED', 'Failed to add contribution.', err);
  }
}

// ---------------------------------------------------------------------------
// undoContribution
// ---------------------------------------------------------------------------

export async function undoContribution(
  contributionId: UUID,
  transactionId: UUID
): Promise<Result<void>> {
  const key = getKey();
  if (!key) return makeError('NO_KEY', 'No encryption key available.');

  try {
    await transactionStorage.deleteTransaction(transactionId);
    await goalContributionStorage.deleteContribution(contributionId);
    return { success: true, data: undefined };
  } catch (err) {
    return makeError('UNDO_FAILED', 'Failed to undo contribution.', err);
  }
}

// ---------------------------------------------------------------------------
// deleteGoalWithContributions
// ---------------------------------------------------------------------------

export async function deleteGoalWithContributions(goalId: UUID): Promise<Result<void>> {
  const key = getKey();
  if (!key) return makeError('NO_KEY', 'No encryption key available.');

  try {
    // Fetch all contributions first
    const contribsResult = await goalContributionStorage.listContributionsByGoal(goalId, key);
    if (!contribsResult.success) return contribsResult;

    // Delete all linked transactions first (order matters per spec)
    for (const contribution of contribsResult.data) {
      await transactionStorage.deleteTransaction(contribution.transactionId);
    }

    // Delete all contributions
    const deleteContribsResult = await goalContributionStorage.deleteAllContributionsForGoal(
      goalId,
      key
    );
    if (!deleteContribsResult.success) return deleteContribsResult;

    // Delete the goal
    const deleteGoalResult = await goalStorage.deleteGoal(goalId);
    if (!deleteGoalResult.success) return deleteGoalResult;

    return { success: true, data: undefined };
  } catch (err) {
    return makeError('DELETE_GOAL_FAILED', 'Failed to delete goal.', err);
  }
}

// ---------------------------------------------------------------------------
// createGoalWithContributions — helper for GoalForm add mode
// ---------------------------------------------------------------------------

export async function createGoalWithContributions(
  userId: UUID,
  goalData: Omit<Goal, 'id' | 'createdAt'>,
  initialContribution?: { amount: number; fromAccountId: UUID; date: ISODateString }
): Promise<Result<EnrichedGoal>> {
  const key = getKey();
  if (!key) return makeError('NO_KEY', 'No encryption key available.');

  try {
    const goalResult = await goalStorage.createGoal(goalData, key);
    if (!goalResult.success) return goalResult;
    const goal = goalResult.data;

    let contributions: GoalContribution[] = [];

    if (initialContribution && initialContribution.amount > 0) {
      const txResult = await transactionStorage.createTransaction(
        {
          userId,
          accountId: initialContribution.fromAccountId,
          type: 'Expense',
          amount: initialContribution.amount,
          currency: goal.currency,
          categoryId: CATEGORY_TRANSFER.id,
          date: initialContribution.date,
          notes: `[goal:${goal.id}] ${goal.name}`,
          isReconciled: false,
        },
        key
      );
      if (!txResult.success) return txResult;

      const contribResult = await goalContributionStorage.createContribution(
        {
          goalId: goal.id,
          fromAccountId: initialContribution.fromAccountId,
          amount: initialContribution.amount,
          date: initialContribution.date,
          transactionId: txResult.data.id,
        },
        key
      );
      if (!contribResult.success) return contribResult;
      contributions = [contribResult.data];

      // Check if already complete after initial contribution
      if (initialContribution.amount >= goal.targetAmount) {
        await goalStorage.updateGoal(
          goal.id,
          { completedAt: new Date().toISOString() as ISODateString },
          key
        );
      }
    }

    let linkedAccount: Account | null = null;
    if (goal.linkedAccountId) {
      const acctResult = await accountStorage.getAccountById(goal.linkedAccountId, key);
      if (acctResult.success) linkedAccount = acctResult.data;
    }

    return { success: true, data: enrichGoal(goal, contributions, linkedAccount) };
  } catch (err) {
    return makeError('CREATE_GOAL_FAILED', 'Failed to create goal.', err);
  }
}

// ---------------------------------------------------------------------------
// refreshEnrichedGoal — re-fetch a single goal for store refresh
// ---------------------------------------------------------------------------

export async function refreshEnrichedGoal(
  userId: UUID,
  goalId: UUID
): Promise<Result<EnrichedGoal>> {
  const key = getKey();
  if (!key) return makeError('NO_KEY', 'No encryption key available.');

  try {
    const goalResult = await goalStorage.getGoalById(goalId, key);
    if (!goalResult.success) return goalResult;
    if (!goalResult.data) return makeError('GOAL_NOT_FOUND', 'Goal not found.');

    const goal = goalResult.data;
    if (goal.userId !== userId) return makeError('UNAUTHORIZED', 'Goal does not belong to user.');

    const contribResult = await goalContributionStorage.listContributionsByGoal(goalId, key);
    if (!contribResult.success) return contribResult;

    let linkedAccount: Account | null = null;
    if (goal.linkedAccountId) {
      const acctResult = await accountStorage.getAccountById(goal.linkedAccountId, key);
      if (acctResult.success) linkedAccount = acctResult.data;
    }

    return { success: true, data: enrichGoal(goal, contribResult.data, linkedAccount) };
  } catch (err) {
    return makeError('REFRESH_GOAL_FAILED', 'Failed to refresh goal.', err);
  }
}
