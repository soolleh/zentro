/**
 * alert.service.ts
 *
 * Business logic for evaluating account balance alerts.
 * No direct React rendering — uses the Zustand stores via `.getState()`.
 * All methods return Result<T>. No throws.
 */
import { addHours } from 'date-fns';
import type { Result, UUID, ISODateString } from '@/shared/types/common.types';
import type { AlertEvaluationResult, EnrichedAccountAlert } from '@/shared/types/alert.types';
import { alertStorage } from '@/services/storage/alert.storage';
import { getAccountBalance, getAllAccountsWithBalances } from '@/services/accounts/account.service';
import {
  sendNotification,
  getPermissionStatus,
} from '@/services/notifications/notification.service';
import { useSessionStore } from '@/app/stores/session.store';
import { useAccountStore } from '@/app/stores/account.store';
import { useUIStore } from '@/app/ui.store';
import { formatCurrency } from '@/shared/utils/currency.utils';

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
// Core evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate all enabled alerts for a single account.
 * - Skips snoozed alerts where `snoozeUntil` is still in the future.
 * - Marks newly triggered alerts and resets un-triggered ones.
 * - Returns evaluation results (triggered flag per alert).
 */
export async function evaluateAlertsForAccount(
  _userId: UUID,
  accountId: UUID,
  currentBalance: number,
  previousBalance?: number
): Promise<Result<AlertEvaluationResult[]>> {
  const key = useSessionStore.getState().derivedKey;
  if (!key) return makeError('NO_KEY', 'No active session key.');

  try {
    const alertsResult = await alertStorage.listAlertsByAccount(accountId, key, false);
    if (!alertsResult.success) return alertsResult;

    const alerts = alertsResult.data;
    if (alerts.length === 0) return { success: true, data: [] };

    const now = new Date();
    const results: AlertEvaluationResult[] = [];

    for (const alert of alerts) {
      if (!alert.isEnabled) continue;

      // Skip snoozed alerts still within the snooze window
      if (alert.status === 'snoozed' && alert.snoozeUntil) {
        const snoozeEnd = new Date(alert.snoozeUntil);
        if (now < snoozeEnd) continue;
      }

      const isTriggeredNow =
        alert.condition === 'below'
          ? currentBalance < alert.threshold
          : currentBalance > alert.threshold;

      const crossedAt = now.toISOString() as ISODateString;

      if (isTriggeredNow && alert.status !== 'triggered') {
        // New trigger: mark in storage
        const markResult = await alertStorage.markAlertTriggered(alert.id, currentBalance, key);
        if (!markResult.success) continue;

        results.push({
          alert: markResult.data,
          triggered: true,
          currentBalance,
          previousBalance: previousBalance ?? null,
          crossedAt,
        });
      } else if (!isTriggeredNow && alert.status === 'triggered') {
        // Balance moved back out of the triggered zone: reset
        const resetResult = await alertStorage.resetAlertStatus(alert.id, key);
        if (!resetResult.success) continue;

        results.push({
          alert: resetResult.data,
          triggered: false,
          currentBalance,
          previousBalance: previousBalance ?? null,
          crossedAt,
        });
      } else {
        // No state change
        results.push({
          alert,
          triggered: false,
          currentBalance,
          previousBalance: previousBalance ?? null,
          crossedAt,
        });
      }
    }

    return { success: true, data: results };
  } catch (err) {
    return makeError('ALERT_EVALUATION_FAILED', 'Failed to evaluate alerts.', err);
  }
}

/**
 * Evaluate all alerts across all accounts for a user.
 * Used during the periodic notification check.
 */
export async function evaluateAllAlertsForUser(
  userId: UUID
): Promise<Result<AlertEvaluationResult[]>> {
  const key = useSessionStore.getState().derivedKey;
  if (!key) return makeError('NO_KEY', 'No active session key.');

  try {
    const accountsResult = await getAllAccountsWithBalances(userId, key);
    if (!accountsResult.success) return accountsResult;

    const allResults: AlertEvaluationResult[] = [];

    for (const row of accountsResult.data) {
      const result = await evaluateAlertsForAccount(userId, row.account.id, row.currentBalance);
      if (result.success) {
        allResults.push(...result.data);
      }
    }

    return { success: true, data: allResults };
  } catch (err) {
    return makeError('ALERT_EVAL_ALL_FAILED', 'Failed to evaluate all alerts.', err);
  }
}

// ---------------------------------------------------------------------------
// Enriched list for UI
// ---------------------------------------------------------------------------

export async function getEnrichedAlerts(userId: UUID): Promise<Result<EnrichedAccountAlert[]>> {
  const key = useSessionStore.getState().derivedKey;
  if (!key) return makeError('NO_KEY', 'No active session key.');

  try {
    const [alertsResult, accountsResult] = await Promise.all([
      alertStorage.listAlertsByUser(userId, key),
      getAllAccountsWithBalances(userId, key),
    ]);

    if (!alertsResult.success) return alertsResult;
    if (!accountsResult.success) return accountsResult;

    const accountMap = new Map(accountsResult.data.map((r) => [r.account.id, r]));
    const enriched: EnrichedAccountAlert[] = [];

    for (const alert of alertsResult.data) {
      const row = accountMap.get(alert.accountId);
      if (!row) continue;

      const currentBalance = row.currentBalance;
      const isCurrentlyTriggered =
        alert.condition === 'below'
          ? currentBalance < alert.threshold
          : currentBalance > alert.threshold;

      enriched.push({
        alert,
        account: row.account,
        isCurrentlyTriggered,
      });
    }

    // Sort: triggered first, then by account name
    enriched.sort((a, b) => {
      if (a.isCurrentlyTriggered && !b.isCurrentlyTriggered) return -1;
      if (!a.isCurrentlyTriggered && b.isCurrentlyTriggered) return 1;
      return a.account.name.localeCompare(b.account.name);
    });

    return { success: true, data: enriched };
  } catch (err) {
    return makeError('ALERT_ENRICH_FAILED', 'Failed to get enriched alerts.', err);
  }
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

/**
 * Send push and/or in-app notifications for all newly-triggered alerts.
 * Accounts are resolved from the in-memory store (already loaded).
 */
export async function sendAlertNotifications(
  results: AlertEvaluationResult[],
  accountNames?: Map<UUID, string>
): Promise<void> {
  const triggered = results.filter((r) => r.triggered);
  if (triggered.length === 0) return;

  const addToast = useUIStore.getState().addToast;
  // Build account name map from in-memory store if not provided
  const accounts = useAccountStore.getState().accounts;
  const nameMap =
    accountNames ?? new Map(accounts.map((a) => [a.account.id as UUID, a.account.name]));

  for (const result of triggered) {
    const { alert, currentBalance } = result;
    const accountName = nameMap.get(alert.accountId) ?? 'Account';
    const conditionLabel = alert.condition === 'below' ? 'below' : 'above';
    const formattedBalance = formatCurrency(currentBalance, alert.currency);
    const formattedThreshold = formatCurrency(alert.threshold, alert.currency);

    if (alert.notifyPush && getPermissionStatus() === 'granted') {
      void sendNotification({
        title: `${accountName} balance alert`,
        body:
          alert.condition === 'below'
            ? `Balance is ${formattedBalance} — below your ${formattedThreshold} alert.`
            : `Balance is ${formattedBalance} — above your ${formattedThreshold} alert.`,
        tag: `balance-alert-${alert.id}`,
        data: {
          type: 'AccountBalanceAlert',
          actionUrl: '/zentro/accounts',
        },
      });
    }

    if (alert.notifyInApp) {
      addToast({
        type: 'warning',
        message: `${accountName}: Balance ${conditionLabel} ${formattedThreshold}.`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Snooze
// ---------------------------------------------------------------------------

export async function snoozeAlertById(alertId: UUID, hours: 1 | 4 | 24): Promise<Result<void>> {
  const key = useSessionStore.getState().derivedKey;
  if (!key) return makeError('NO_KEY', 'No active session key.');

  try {
    const until = addHours(new Date(), hours).toISOString() as ISODateString;
    const result = await alertStorage.snoozeAlert(alertId, until, key);
    if (!result.success) return result;
    return { success: true, data: undefined };
  } catch (err) {
    return makeError('ALERT_SNOOZE_FAILED', 'Failed to snooze alert.', err);
  }
}

// ---------------------------------------------------------------------------
// Convenience: check alerts after a transaction was created
// ---------------------------------------------------------------------------

/**
 * Called from TransactionForm after a transaction is committed.
 * Short-circuits if no alerts are configured for the account.
 */
export async function checkAlertsAfterTransaction(
  userId: UUID,
  accountId: UUID,
  previousBalance: number
): Promise<void> {
  const key = useSessionStore.getState().derivedKey;
  if (!key) return;

  try {
    // Short-circuit: no IDB read overhead if no alerts configured
    const alertsResult = await alertStorage.listAlertsByAccount(accountId, key, false);
    if (!alertsResult.success || alertsResult.data.length === 0) return;

    // Fetch updated balance after transaction
    const balanceResult = await getAccountBalance(accountId, key);
    if (!balanceResult.success) return;

    const currentBalance = balanceResult.data;
    const evalResult = await evaluateAlertsForAccount(
      userId,
      accountId,
      currentBalance,
      previousBalance
    );
    if (!evalResult.success) return;

    const triggered = evalResult.data.filter((r) => r.triggered);
    if (triggered.length > 0) {
      void sendAlertNotifications(triggered);
    }
  } catch {
    // Non-critical path — silently fail
  }
}
