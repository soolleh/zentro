/**
 * milestone.service.ts
 *
 * Business logic for detecting and recording net worth milestones (INR, 16 milestones).
 * All methods return Result<T>. No throws. No direct React rendering.
 */
import type { Result, UUID } from '@/shared/types/common.types';
import type { AchievedMilestone } from '@/shared/types/milestone.types';
import { milestoneStorage } from '@/services/storage/milestone.storage';
import { getNetWorth, getAllAccountsWithBalances } from '@/services/accounts/account.service';
import { useSessionStore } from '@/app/stores/session.store';
import { usePreferencesStore } from '@/app/preferences.store';
import {
  MILESTONE_CONFIG,
  getMilestoneProgress,
  type MilestoneProgressData,
} from './milestone-config';

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

/**
 * Compute current net worth from IDB using the session key and user's
 * preferred base currency.
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
 * Detect whether accounts have mixed currencies.
 * Milestone evaluation is skipped when accounts are multi-currency since
 * a consistent net worth in INR cannot be computed reliably.
 */
async function hasMixedCurrencies(userId: UUID): Promise<boolean> {
  const key = useSessionStore.getState().derivedKey;
  if (!key) return true;

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
 * Check all MILESTONE_CONFIG entries for upward threshold crossings.
 * For each new crossing: record the achievement if not already recorded.
 * Returns newly recorded milestones only.
 *
 * Only detects UPWARD crossings. Dropping below a threshold and recovering
 * does NOT re-award a milestone (enforced by idempotency in storage).
 *
 * Skips milestone id=1 (threshold=0) — awarded implicitly.
 * Silently skips if accounts have mixed currencies.
 */
export async function evaluateMilestones(
  userId: UUID,
  currentNetWorth: number,
  previousNetWorth: number
): Promise<Result<AchievedMilestone[]>> {
  try {
    const mixed = await hasMixedCurrencies(userId);
    if (mixed) return { success: true, data: [] };

    const newMilestones: AchievedMilestone[] = [];

    for (const config of MILESTONE_CONFIG) {
      // Skip the starting milestone (threshold = 0)
      if (config.threshold === 0) continue;

      const crossed =
        previousNetWorth < config.threshold &&
        currentNetWorth >= config.threshold;
      if (!crossed) continue;

      const alreadyAchieved = await milestoneStorage.hasAchieved(userId, config.id);
      if (alreadyAchieved) continue;

      const result = await milestoneStorage.recordAchievement(
        userId,
        config.id,
        currentNetWorth
      );
      if (result.success) newMilestones.push(result.data);
    }

    return { success: true, data: newMilestones };
  } catch (err) {
    return makeError('MILESTONE_EVALUATION_FAILED', 'Failed to evaluate milestones.', err);
  }
}

// ---------------------------------------------------------------------------
// getProgressData
// ---------------------------------------------------------------------------

/**
 * Pure computation — no IDB reads required.
 * Returns the full milestone progress data for the given net worth.
 */
export function getProgressData(currentNetWorth: number): MilestoneProgressData {
  return getMilestoneProgress(currentNetWorth);
}

// ---------------------------------------------------------------------------
// checkAndCelebrate
// ---------------------------------------------------------------------------

/**
 * Evaluate milestones and return newly achieved ones.
 * Does NOT push to the store (avoid circular deps — caller handles that).
 *
 * Respects the 'NetWorthMilestone' notification preference:
 * - When disabled: milestones are RECORDED in IDB but an empty array is returned
 *   so the caller does not trigger celebrations.
 * - When enabled (default): returns new milestones for celebration.
 */
export async function checkAndCelebrate(
  userId: UUID,
  currentNetWorth: number,
  previousNetWorth: number
): Promise<AchievedMilestone[]> {
  try {
    const evalResult = await evaluateMilestones(userId, currentNetWorth, previousNetWorth);
    if (!evalResult.success || evalResult.data.length === 0) return [];

    // Always record — only skip celebration if preference is off
    const prefs = usePreferencesStore.getState().notificationPreferences;
    const milestonePref = prefs.find((p) => p.type === 'NetWorthMilestone');
    const celebrationsEnabled = milestonePref?.enabled !== false; // default true

    if (!celebrationsEnabled) return [];
    return evalResult.data;
  } catch {
    return [];
  }
}
