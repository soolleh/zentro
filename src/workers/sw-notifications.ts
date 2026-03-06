/**
 * sw-notifications.ts
 *
 * Runs INSIDE the service worker context.
 * Uses IDB directly — NO imports from @/services/, NO WebCrypto decryption.
 * Financial data is encrypted at rest; only the sw_state store (unencrypted
 * metadata) is read here. Notifications are intentionally generic.
 */
import { openDB, type IDBPDatabase } from 'idb';

// ---------------------------------------------------------------------------
// Constants (must be kept in sync with storage.constants.ts)
// ---------------------------------------------------------------------------

const DB_NAME = 'zentro-db';
const DB_VERSION = 4;

// ---------------------------------------------------------------------------
// IDB bootstrap — open the DB without upgrade logic
// (migrations already applied by the main-thread storage layer)
// ---------------------------------------------------------------------------

async function getSwDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION);
}

// ---------------------------------------------------------------------------
// sw_state helpers
// ---------------------------------------------------------------------------

async function readSwStateValue<T>(db: IDBPDatabase, key: string): Promise<T | null> {
  try {
    const record = await db.get('sw_state', key);
    if (record === undefined || record === null) return null;
    // Records stored as { key, value } objects
    return (record as { key: string; value: T }).value;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Notification helpers
// ---------------------------------------------------------------------------

declare const self: ServiceWorkerGlobalScope;

async function sendSwNotification(
  title: string,
  body: string,
  tag: string,
  actionUrl: string
): Promise<void> {
  if (Notification.permission !== 'granted') return;

  await self.registration.showNotification(title, {
    body,
    icon: '/zentro/icons/icon-192.png',
    badge: '/zentro/icons/icon-96.png',
    tag,
    data: { actionUrl },
    silent: false,
  });
}

// ---------------------------------------------------------------------------
// Notification check (called by periodicsync or setInterval fallback)
// ---------------------------------------------------------------------------

interface SWNotificationPreference {
  type: string;
  enabled: boolean;
  timeOfDay?: string;
}

export async function handleNotificationCheck(): Promise<void> {
  let db: IDBPDatabase | null = null;
  try {
    db = await getSwDB();
  } catch {
    return; // DB not initialized yet — main thread hasn't run
  }

  const activeUserId = await readSwStateValue<string>(db, 'activeUserId');
  if (!activeUserId) return; // No active session

  const prefs = await readSwStateValue<SWNotificationPreference[]>(db, 'notificationPreferences');

  // Preferences default: notify if no prefs stored
  const isBudgetEnabled = prefs?.find((p) => p.type === 'BudgetAlert')?.enabled ?? false;
  const isBillEnabled = prefs?.find((p) => p.type === 'BillDue')?.enabled ?? false;
  const isGoalEnabled = prefs?.find((p) => p.type === 'GoalReminder')?.enabled ?? false;
  const isWeeklyEnabled = prefs?.find((p) => p.type === 'WeeklySummary')?.enabled ?? false;

  const isDailyEnabled = prefs?.find((p) => p.type === 'DailyReminder')?.enabled ?? false;
  const dailyTimeOfDay = prefs?.find((p) => p.type === 'DailyReminder')?.timeOfDay ?? '21:00';

  // Check last notification send timestamps to avoid spam
  const now = Date.now();
  const lastBudget = await readSwStateValue<number>(db, 'sw_lastBudgetCheck');
  const lastBill = await readSwStateValue<number>(db, 'sw_lastBillCheck');
  const lastGoal = await readSwStateValue<number>(db, 'sw_lastGoalCheck');
  const lastWeekly = await readSwStateValue<number>(db, 'sw_lastWeeklyCheck');
  const lastDailyReminderDate = await readSwStateValue<string>(db, 'sw_lastDailyReminderDate');

  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;

  const notifications: Promise<void>[] = [];

  if (isBudgetEnabled && (lastBudget === null || now - lastBudget > oneHour)) {
    notifications.push(
      sendSwNotification(
        'Budget alert',
        'You may have a budget alert. Open Zentro to review.',
        'sw-budget-alert',
        '/zentro/budgets'
      ).then(async () => {
        await db!.put('sw_state', {
          key: 'sw_lastBudgetCheck',
          value: now,
        });
      })
    );
  }

  if (isBillEnabled && (lastBill === null || now - lastBill > oneDay)) {
    notifications.push(
      sendSwNotification(
        'Upcoming bills',
        'A bill may be due soon. Open Zentro to check.',
        'sw-bill-reminder',
        '/zentro/bills'
      ).then(async () => {
        await db!.put('sw_state', { key: 'sw_lastBillCheck', value: now });
      })
    );
  }

  if (isGoalEnabled && (lastGoal === null || now - lastGoal > oneDay)) {
    notifications.push(
      sendSwNotification(
        'Goal progress',
        'Check your savings goal progress in Zentro.',
        'sw-goal-reminder',
        '/zentro/goals'
      ).then(async () => {
        await db!.put('sw_state', { key: 'sw_lastGoalCheck', value: now });
      })
    );
  }

  // Weekly summary — only on configured or default (Monday = 1)
  const today = new Date().getDay();
  if (isWeeklyEnabled && today === 1 && (lastWeekly === null || now - lastWeekly > oneDay)) {
    notifications.push(
      sendSwNotification(
        'Weekly summary ready',
        'Your weekly financial summary is ready. Open Zentro.',
        'sw-weekly-summary',
        '/zentro/dashboard'
      ).then(async () => {
        await db!.put('sw_state', { key: 'sw_lastWeeklyCheck', value: now });
      })
    );
  }

  await Promise.allSettled(notifications);

  // Daily reminder — fires once during the configured hour
  if (isDailyEnabled) {
    const [hStr] = dailyTimeOfDay.split(':');
    const targetHour = parseInt(hStr ?? '21', 10);
    const nowDate = new Date();
    const todayStr = nowDate.toISOString().substring(0, 10);
    if (nowDate.getHours() === targetHour && lastDailyReminderDate !== todayStr) {
      try {
        await sendSwNotification(
          "Have you logged today's transactions?",
          'Keep your finances up to date \u2014 tap to add a transaction.',
          `sw-daily-reminder-${todayStr}`,
          '/#/transactions'
        );
        await db.put('sw_state', { key: 'sw_lastDailyReminderDate', value: todayStr });
      } catch {
        // ignore
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Recurring generation (called by periodicsync or setInterval fallback)
// Posts a message to the main thread to handle the actual generation
// (recurring transaction generation requires the derived key from the session).
// ---------------------------------------------------------------------------

export async function handleRecurringGeneration(): Promise<void> {
  try {
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      client.postMessage({ type: 'SW_TRIGGER_RECURRING_GENERATION' });
    }
  } catch {
    // No active clients — will be handled on next app open
  }
}
