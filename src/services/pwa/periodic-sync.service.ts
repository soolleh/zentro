/**
 * periodic-sync.service.ts
 *
 * Registers Periodic Background Sync tags when supported.
 * Falls back to setInterval polling for unsupported browsers (Safari, Firefox).
 *
 * Handles:
 *   - Recurring transaction generation (daily)
 *   - Notification check scheduling (hourly)
 */
import { useSessionStore } from '@/app/stores/session.store';
import { generateRecurringTransactions } from '@/services/transactions/transaction.service';
import { generateAllUserEntries } from '@/services/bills/bill.service';
import { checkAndSchedule } from '@/services/notifications/notification.service';

// ---------------------------------------------------------------------------
// Throttle keys
// ---------------------------------------------------------------------------

const LS_LAST_RECURRING = 'zentro_last_recurring_gen';
const LS_LAST_NOTIF = 'zentro_last_notif_check';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_MINUTE_MS = 15 * 60 * 1000; // check interval for fallback

let fallbackIntervalId: ReturnType<typeof setInterval> | null = null;

// ---------------------------------------------------------------------------
// Periodic Background Sync registration
// ---------------------------------------------------------------------------

interface PeriodicSyncManager {
  register(tag: string, options?: { minInterval: number }): Promise<void>;
  getTags(): Promise<string[]>;
}

interface ExtendedServiceWorkerRegistration extends ServiceWorkerRegistration {
  periodicSync?: PeriodicSyncManager;
}

async function requestPeriodicSyncPermission(): Promise<boolean> {
  if (!('permissions' in navigator)) return false;
  try {
    const status = await navigator.permissions.query({
      // @ts-expect-error -- periodic-background-sync not in TS DOM lib yet
      name: 'periodic-background-sync',
    });
    return status.state === 'granted';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Recurring generation fallback (main-thread)
// ---------------------------------------------------------------------------

async function recurringFallback(): Promise<void> {
  const lastRun = localStorage.getItem(LS_LAST_RECURRING);
  if (lastRun && Date.now() - Number(lastRun) < ONE_DAY_MS) return;

  const { currentUser, derivedKey } = useSessionStore.getState();
  if (!currentUser?.id || !derivedKey) return;

  await Promise.allSettled([
    generateRecurringTransactions(currentUser.id, derivedKey),
    generateAllUserEntries(currentUser.id, derivedKey),
  ]);

  localStorage.setItem(LS_LAST_RECURRING, String(Date.now()));
}

// ---------------------------------------------------------------------------
// Notification check fallback (main-thread)
// ---------------------------------------------------------------------------

async function notificationFallback(): Promise<void> {
  const lastRun = localStorage.getItem(LS_LAST_NOTIF);
  if (lastRun && Date.now() - Number(lastRun) < ONE_HOUR_MS) return;

  const { currentUser } = useSessionStore.getState();
  if (!currentUser?.id) return;

  await checkAndSchedule(currentUser.id);

  localStorage.setItem(LS_LAST_NOTIF, String(Date.now()));
}

// ---------------------------------------------------------------------------
// Combined fallback poll
// ---------------------------------------------------------------------------

function runFallbackPolls(): void {
  void recurringFallback().catch(() => undefined);
  void notificationFallback().catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function registerPeriodicSync(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const reg = registration as ExtendedServiceWorkerRegistration;

    if (reg.periodicSync && (await requestPeriodicSyncPermission())) {
      const tags = await reg.periodicSync.getTags();

      if (!tags.includes('zentro-recurring-generation')) {
        await reg.periodicSync.register('zentro-recurring-generation', {
          minInterval: ONE_DAY_MS,
        });
      }

      if (!tags.includes('zentro-notification-check')) {
        await reg.periodicSync.register('zentro-notification-check', {
          minInterval: ONE_HOUR_MS,
        });
      }

      return; // Periodic sync supported — no need for setInterval
    }
  } catch {
    // Permission denied or API not available — fall through to setInterval
  }

  // Fallback: interval polling from the main thread
  if (fallbackIntervalId !== null) return; // Already registered

  runFallbackPolls(); // Run immediately on register
  fallbackIntervalId = setInterval(runFallbackPolls, ONE_MINUTE_MS);
}

export function unregisterPeriodicSync(): void {
  if (fallbackIntervalId !== null) {
    clearInterval(fallbackIntervalId);
    fallbackIntervalId = null;
  }
}
