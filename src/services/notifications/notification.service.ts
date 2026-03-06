/**
 * notification.service.ts
 *
 * Main-thread notification service. Sends rich, decrypted notifications
 * using the active session. All notifications are local-only — no push server,
 * no VAPID, no Web Push API.
 */
import { format, getDay, getWeek, differenceInDays } from 'date-fns';
import type { UUID, ISODateString } from '@/shared/types/common.types';
import type { LocalNotificationPayload } from '@/shared/types/notification.types';
import { getBudgetUtilizationForCycle, getCycleDates } from '@/services/budgets/budget.service';
import { getAllEnrichedGoals } from '@/services/goals/goal.service';
import { getEnrichedEntriesForRange, isOverdue } from '@/services/bills/bill.service';
import { writeSWState } from '@/services/storage/sw-state.storage';
import { usePreferencesStore } from '@/app/preferences.store';
import { useSessionStore } from '@/app/stores/session.store';
import { transactionStorage } from '@/services/storage/transaction.storage';

// ---------------------------------------------------------------------------
// Capability checks
// ---------------------------------------------------------------------------

export function isNotificationSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export function getPermissionStatus(): NotificationPermission {
  if (typeof Notification === 'undefined') return 'default';
  return Notification.permission;
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'default';
  return Notification.requestPermission();
}

// ---------------------------------------------------------------------------
// Send a single local notification via the SW registration
// ---------------------------------------------------------------------------

/** Resolves navigator.serviceWorker.ready with a timeout. */
async function getSwRegistration(timeoutMs = 3000): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

export async function sendNotification(payload: LocalNotificationPayload): Promise<void> {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;

  const notificationOptions = {
    body: payload.body,
    icon: payload.icon ?? '/zentro/icons/icon-192.png',
    badge: payload.badge ?? '/zentro/icons/icon-96.png',
    tag: payload.tag,
    data: payload.data,
    silent: payload.silent ?? false,
  };

  try {
    const registration = await getSwRegistration();
    if (registration) {
      await registration.showNotification(payload.title, notificationOptions);
    } else {
      // SW not ready (e.g. dev mode, SW install pending) — fall back to
      // creating the Notification directly on the main thread.
      // eslint-disable-next-line no-new
      new Notification(payload.title, notificationOptions);
    }
  } catch (err) {
    // Last-resort fallback
    try {
      // eslint-disable-next-line no-new
      new Notification(payload.title, notificationOptions);
    } catch {
      console.warn('[Zentro] sendNotification failed:', err);
    }
  }
}

// ---------------------------------------------------------------------------
// Main scheduler — calls all check functions based on preferences
// ---------------------------------------------------------------------------

export async function checkAndSchedule(userId: UUID): Promise<void> {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;

  const prefs = usePreferencesStore.getState().notificationPreferences;

  const checks: Promise<void>[] = [];

  const budgetPref = prefs.find((p) => p.type === 'BudgetAlert');
  if (budgetPref?.enabled) checks.push(checkBudgetAlerts(userId));

  const billPref = prefs.find((p) => p.type === 'BillDue');
  if (billPref?.enabled) checks.push(checkBillReminders(userId));

  const goalPref = prefs.find((p) => p.type === 'GoalReminder');
  if (goalPref?.enabled) checks.push(checkGoalReminders(userId));

  const weeklyPref = prefs.find((p) => p.type === 'WeeklySummary');
  if (weeklyPref?.enabled) checks.push(checkWeeklySummary(userId, weeklyPref.dayOfWeek));

  await Promise.allSettled(checks);
  await writeSWState('lastNotificationCheck', new Date().toISOString());
}

// ---------------------------------------------------------------------------
// Budget alerts
// ---------------------------------------------------------------------------

async function checkBudgetAlerts(userId: UUID): Promise<void> {
  const { derivedKey } = useSessionStore.getState();
  if (!derivedKey) return;

  const { baseCurrency, budgetCycleStartDay } = usePreferencesStore.getState();
  const today = new Date().toISOString() as ISODateString;
  const cycleDates = getCycleDates(today, budgetCycleStartDay);

  const result = await getBudgetUtilizationForCycle(
    userId,
    cycleDates.cycleStart,
    cycleDates.cycleEnd,
    derivedKey,
    baseCurrency
  );
  if (!result.success) return;

  for (const enrichedBudget of result.data.budgets) {
    const { budget, category, percentUsed, isOverBudget, isAlertTriggered } = enrichedBudget;
    const sign = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: budget.currency,
      minimumFractionDigits: 0,
    });

    if (isOverBudget) {
      const overAmount = enrichedBudget.spent - enrichedBudget.effectiveAmount;
      await sendNotification({
        title: `${category.name} budget exceeded`,
        body: `You've spent ${String(Math.round(percentUsed))}% of your ${category.name} budget. ${sign.format(overAmount)} over.`,
        tag: `budget-exceeded-${budget.id}-${cycleDates.cycleStart}`,
        data: {
          type: 'BudgetExceeded',
          actionUrl: '/zentro/budgets',
          entityId: budget.id,
        },
      });
    } else if (isAlertTriggered) {
      await sendNotification({
        title: `Budget alert — ${category.name}`,
        body: `You've used ${String(Math.round(percentUsed))}% of your ${category.name} budget this month.`,
        tag: `budget-alert-${budget.id}-${cycleDates.cycleStart}`,
        data: {
          type: 'BudgetNearLimit',
          actionUrl: '/zentro/budgets',
          entityId: budget.id,
        },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Bill reminders
// ---------------------------------------------------------------------------

async function checkBillReminders(userId: UUID): Promise<void> {
  const { derivedKey } = useSessionStore.getState();
  if (!derivedKey) return;

  const now = new Date();
  const from = now.toISOString() as ISODateString;
  // Look 7 days ahead + 30 days back (for overdue)
  const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const pastDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const to = futureDate.toISOString() as ISODateString;
  const pastFrom = pastDate.toISOString() as ISODateString;

  const [upcomingResult, overdueResult] = await Promise.all([
    getEnrichedEntriesForRange(userId, from, to, derivedKey),
    getEnrichedEntriesForRange(userId, pastFrom, from, derivedKey),
  ]);

  if (upcomingResult.success) {
    for (const entry of upcomingResult.data) {
      if (entry.status !== 'pending' && entry.status !== 'snoozed') continue;

      const dueDate = new Date(entry.dueDate);
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

      if (daysUntilDue === 1 || daysUntilDue === 3) {
        const label = daysUntilDue === 1 ? 'tomorrow' : 'in 3 days';
        await sendNotification({
          title: `${entry.bill.name} due ${label}`,
          body: `${new Intl.NumberFormat('en', { style: 'currency', currency: entry.bill.currency, minimumFractionDigits: 2 }).format(entry.bill.amount)} due on ${format(dueDate, 'MMM d')}.`,
          tag: `bill-reminder-${entry.id}-${String(daysUntilDue)}d`,
          data: {
            type: 'BillDueSoon',
            actionUrl: '/zentro/bills',
            entityId: entry.id,
          },
        });
      }
    }
  }

  // Overdue bills
  if (overdueResult.success) {
    for (const entry of overdueResult.data) {
      if (!isOverdue(entry)) continue;
      const dueDate = new Date(entry.dueDate);
      const daysOverdue = differenceInDays(now, dueDate);
      await sendNotification({
        title: `${entry.bill.name} is overdue`,
        body: `${new Intl.NumberFormat('en', { style: 'currency', currency: entry.bill.currency }).format(entry.bill.amount)} was due ${String(daysOverdue)} day${daysOverdue === 1 ? '' : 's'} ago.`,
        tag: `bill-overdue-${entry.id}`,
        data: {
          type: 'BillDueSoon',
          actionUrl: '/zentro/bills',
          entityId: entry.id,
        },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Goal reminders — Mondays only
// ---------------------------------------------------------------------------

async function checkGoalReminders(userId: UUID): Promise<void> {
  // Only run on Mondays
  if (getDay(new Date()) !== 1) return;

  if (!useSessionStore.getState().derivedKey) return;

  const { baseCurrency } = usePreferencesStore.getState();
  const weekNumber = getWeek(new Date());

  const result = await getAllEnrichedGoals(userId);
  if (!result.success) return;

  for (const enrichedGoal of result.data) {
    if (enrichedGoal.isComplete) continue;
    if (enrichedGoal.projection.isOnTrack) continue;

    const { goal, projection } = enrichedGoal;
    const required = projection.requiredMonthlyAmount ?? 0;
    const sign = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: baseCurrency,
      minimumFractionDigits: 0,
    });

    await sendNotification({
      title: `${goal.name} needs attention`,
      body: `You need ${sign.format(required)}/mo to stay on track.`,
      tag: `goal-reminder-${goal.id}-${String(weekNumber)}`,
      data: {
        type: 'GoalBehindTarget',
        actionUrl: '/zentro/goals',
        entityId: goal.id,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Weekly summary — configured day of week
// ---------------------------------------------------------------------------

async function checkWeeklySummary(
  userId: UUID,
  configuredDayOfWeek: number | undefined
): Promise<void> {
  const dayOfWeek = configuredDayOfWeek ?? 1; // default Monday
  if (getDay(new Date()) !== dayOfWeek) return;

  const { derivedKey } = useSessionStore.getState();
  if (!derivedKey) return;

  const { baseCurrency } = usePreferencesStore.getState();
  const weekNumber = getWeek(new Date());

  // Compute current week range (Mon–Sun)
  const now = new Date();
  const daysSinceMonday = (getDay(now) + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysSinceMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const from = monday.toISOString() as ISODateString;
  const to = sunday.toISOString() as ISODateString;

  const txResult = await transactionStorage.listTransactionsByDateRange(
    userId,
    from,
    to,
    derivedKey
  );
  if (!txResult.success) return;

  const sign = new Intl.NumberFormat('en', {
    style: 'currency',
    currency: baseCurrency,
    minimumFractionDigits: 0,
  });

  let income = 0;
  let expenses = 0;

  for (const tx of txResult.data) {
    if (tx.type === 'Income') income += tx.amount;
    else if (tx.type === 'Expense') expenses += tx.amount;
  }

  const net = income - expenses;

  await sendNotification({
    title: 'Your weekly summary',
    body: `This week: ${sign.format(income)} in, ${sign.format(expenses)} out. Net ${sign.format(net)}.`,
    tag: `weekly-summary-${String(weekNumber)}`,
    data: {
      type: 'WeeklySummary',
      actionUrl: '/zentro/dashboard',
    },
  });
}

// ---------------------------------------------------------------------------
// Test notification — for use from Settings
// ---------------------------------------------------------------------------

export async function sendTestNotification(): Promise<void> {
  await sendNotification({
    title: 'Zentro test',
    body: 'Notifications are working correctly.',
    tag: 'test',
    data: {
      type: 'WeeklySummary',
      actionUrl: '/zentro/settings',
    },
  });
}
