/**
 * milestone.service.ts
 *
 * Business logic for detecting and recording net worth milestones.
 * All methods return Result<T>. No throws. No direct React rendering.
 */
import { startOfMonth, endOfMonth } from 'date-fns';
import type { Result, UUID, ISODateString } from '@/shared/types/common.types';
import type {
  NetWorthMilestone,
  MilestoneThreshold,
  MilestoneProgress,
} from '@/shared/types/milestone.types';
import { milestoneStorage } from '@/services/storage/milestone.storage';
import { getNetWorth, getAllAccountsWithBalances } from '@/services/accounts/account.service';
import { transactionStorage } from '@/services/storage/transaction.storage';
import { useSessionStore } from '@/app/stores/session.store';
import { usePreferencesStore } from '@/app/preferences.store';
import {
  NET_WORTH_THRESHOLDS,
  SAVINGS_THRESHOLDS,
  DEBT_FREE_THRESHOLD,
} from './milestone-thresholds';

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

function toISO(d: Date): ISODateString {
  return d.toISOString() as ISODateString;
}

/**
 * Compute current net worth from IDB.
 * Returns `null` if session key or base currency is unavailable.
 */
export async function computeNetWorth(userId: UUID): Promise<Result<number>> {
  const key = useSessionStore.getState().derivedKey;
  if (!key) return makeError('NO_KEY', 'No active session key.');

  const baseCurrency = usePreferencesStore.getState().baseCurrency;
  const result = await getNetWorth(userId, key, baseCurrency);
  if (!result.success) return result;
  return { success: true, data: result.data.netWorth };
}

/**
 * Detect whether the user's accounts have mixed currencies.
 * Milestone evaluation is skipped in this case.
 */
async function hasMixedCurrencies(userId: UUID): Promise<boolean> {
  const key = useSessionStore.getState().derivedKey;
  if (!key) return true; // treat as mixed to skip evaluation safely

  try {
    const result = await getAllAccountsWithBalances(userId, key);
    if (!result.success) return true;

    const currencies = new Set(result.data.map((a) => a.account.currency));
    return currencies.size > 1;
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------------------
// evaluateMilestones
// ---------------------------------------------------------------------------

/**
 * Check all threshold lists for upward crossings.
 * For each new crossing: record the milestone if not already recorded.
 * Returns the newly recorded milestones.
 *
 * Only detects UPWARD crossings. Net worth dropping below a threshold
 * and recovering does NOT re-award a milestone (idempotency in storage).
 *
 * Silently skips evaluation if accounts have mixed currencies.
 */
export async function evaluateMilestones(
  userId: UUID,
  currentNetWorth: number,
  previousNetWorth: number
): Promise<Result<NetWorthMilestone[]>> {
  try {
    // Skip silently on mixed currencies
    const mixed = await hasMixedCurrencies(userId);
    if (mixed) return { success: true, data: [] };

    const newMilestones: NetWorthMilestone[] = [];
    const now = new Date().toISOString() as ISODateString;
    const currency = usePreferencesStore.getState().baseCurrency;

    // --- Net worth thresholds ---
    for (const threshold of NET_WORTH_THRESHOLDS) {
      const crossed = previousNetWorth < threshold.value && currentNetWorth >= threshold.value;
      if (!crossed) continue;

      const existing = await milestoneStorage.getMilestoneByThreshold(
        userId,
        'net_worth',
        threshold.value
      );
      if (!existing.success) continue;
      if (existing.data !== null) continue; // already recorded

      const result = await milestoneStorage.recordMilestone({
        userId,
        type: 'net_worth',
        threshold: threshold.value,
        label: threshold.label,
        emoji: threshold.emoji,
        tier: threshold.tier,
        achievedAt: now,
        netWorthAtAchievement: currentNetWorth,
        acknowledged: false,
      });
      if (result.success) newMilestones.push(result.data);
    }

    // --- Debt-free threshold ---
    const debtFreeCrossed = previousNetWorth < 0 && currentNetWorth >= 0;
    if (debtFreeCrossed) {
      const existing = await milestoneStorage.getMilestoneByThreshold(userId, 'debt_free', 0);
      if (existing.success && existing.data === null) {
        const result = await milestoneStorage.recordMilestone({
          userId,
          type: 'debt_free',
          threshold: 0,
          label: DEBT_FREE_THRESHOLD.label,
          emoji: DEBT_FREE_THRESHOLD.emoji,
          tier: DEBT_FREE_THRESHOLD.tier,
          achievedAt: now,
          netWorthAtAchievement: currentNetWorth,
          acknowledged: false,
        });
        if (result.success) newMilestones.push(result.data);
      }
    }

    // --- Savings rate milestones (current calendar month) ---
    const key = useSessionStore.getState().derivedKey;
    if (key) {
      const monthStart = toISO(startOfMonth(new Date()));
      const monthEnd = toISO(endOfMonth(new Date()));
      const txResult = await transactionStorage.listTransactionsByDateRange(
        userId,
        monthStart,
        monthEnd,
        key
      );

      if (txResult.success) {
        const txs = txResult.data;
        let income = 0;
        let expenses = 0;

        for (const tx of txs) {
          if (tx.type === 'Income') income += tx.amount;
          else if (tx.type === 'Expense') expenses += tx.amount;
        }

        if (income > 0) {
          const savingsRate = ((income - expenses) / income) * 100;

          for (const threshold of SAVINGS_THRESHOLDS) {
            const crossed = savingsRate >= threshold.value;
            if (!crossed) continue;

            const existing = await milestoneStorage.getMilestoneByThreshold(
              userId,
              'savings',
              threshold.value
            );
            if (!existing.success || existing.data !== null) continue;

            const result = await milestoneStorage.recordMilestone({
              userId,
              type: 'savings',
              threshold: threshold.value,
              label: threshold.label,
              emoji: threshold.emoji,
              tier: threshold.tier,
              achievedAt: now,
              netWorthAtAchievement: currentNetWorth,
              acknowledged: false,
            });
            if (result.success) newMilestones.push(result.data);
          }
        }
      }
    }

    void currency; // used for context — actual amounts stored are in base currency

    return { success: true, data: newMilestones };
  } catch (err) {
    return makeError('MILESTONE_EVALUATE_FAILED', 'Failed to evaluate milestones.', err);
  }
}

// ---------------------------------------------------------------------------
// getNextMilestone
// ---------------------------------------------------------------------------

/**
 * Returns the next unachieved net worth threshold above the current value.
 * Returns null if all thresholds are already achieved.
 */
export async function getNextMilestone(
  userId: UUID,
  currentNetWorth: number
): Promise<Result<MilestoneThreshold | null>> {
  try {
    const achieved = await milestoneStorage.listMilestonesByUser(userId);
    if (!achieved.success) return achieved;

    const achievedThresholds = new Set(
      achieved.data.filter((m) => m.type === 'net_worth').map((m) => m.threshold)
    );

    const next = NET_WORTH_THRESHOLDS.find(
      (t) => t.value > currentNetWorth && !achievedThresholds.has(t.value)
    );

    return { success: true, data: next ?? null };
  } catch (err) {
    return makeError('MILESTONE_NEXT_FAILED', 'Failed to find next milestone.', err);
  }
}

// ---------------------------------------------------------------------------
// getProgressToNextMilestone
// ---------------------------------------------------------------------------

/**
 * Computes progress toward the next milestone.
 * Returns null if no next milestone exists (all achieved) or if mixed currencies.
 */
export async function getProgressToNextMilestone(
  userId: UUID,
  currentNetWorth: number
): Promise<Result<MilestoneProgress | null>> {
  try {
    const mixed = await hasMixedCurrencies(userId);
    if (mixed) return { success: true, data: null };

    const nextResult = await getNextMilestone(userId, currentNetWorth);
    if (!nextResult.success) return nextResult;
    if (!nextResult.data) return { success: true, data: null };

    const next = nextResult.data;

    // Find the last achieved threshold below the next
    const achieved = await milestoneStorage.listMilestonesByUser(userId);
    if (!achieved.success) return achieved;

    const achievedNetWorth = achieved.data
      .filter((m) => m.type === 'net_worth')
      .map((m) => m.threshold)
      .sort((a, b) => b - a);

    const previousThresholdValue = achievedNetWorth.find((v) => v < next.value);
    const previous: MilestoneThreshold | null =
      previousThresholdValue != null
        ? (NET_WORTH_THRESHOLDS.find((t) => t.value === previousThresholdValue) ?? null)
        : null;

    const base = previous?.value ?? 0;
    const range = next.value - base;
    const progress = Math.min(100, Math.max(0, ((currentNetWorth - base) / range) * 100));

    return {
      success: true,
      data: {
        current: currentNetWorth,
        next,
        previous,
        progressPercent: progress,
        amountRemaining: Math.max(0, next.value - currentNetWorth),
      },
    };
  } catch (err) {
    return makeError('MILESTONE_PROGRESS_FAILED', 'Failed to compute milestone progress.', err);
  }
}

// ---------------------------------------------------------------------------
// checkAndCelebrate
// ---------------------------------------------------------------------------

/**
 * Evaluate milestones and return any newly recorded ones.
 * The CALLER is responsible for triggering the toast/overlay UI
 * via `useMilestoneStore.getState().addMilestoneToast(milestone)`.
 *
 * Milestone checks run AFTER alert evaluation — alerts are higher priority.
 */
export async function checkAndCelebrate(
  userId: UUID,
  currentNetWorth: number,
  previousNetWorth: number
): Promise<NetWorthMilestone[]> {
  try {
    const result = await evaluateMilestones(userId, currentNetWorth, previousNetWorth);
    if (!result.success || result.data.length === 0) return [];
    return result.data;
  } catch {
    return [];
  }
}
