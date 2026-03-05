import { useEffect, useRef, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { Workbox } from 'workbox-window';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { useUIStore } from '@/app/ui.store';
import { useSessionStore } from '@/app/session.store';
import type { Toast } from '@/app/ui.store';
import { router } from '@/app/router';
import { generateRecurringTransactions } from '@/services/transactions/transaction.service';
import { generateAllUserEntries } from '@/services/bills/bill.service';
import { useDashboardStore } from '@/app/stores/dashboard.store';
import { usePWAStore, type BeforeInstallPromptEvent } from '@/app/stores/pwa.store';
import { usePreferencesStore } from '@/app/preferences.store';
import { writeSWState } from '@/services/storage/sw-state.storage';
import { registerPeriodicSync } from '@/services/pwa/periodic-sync.service';
import { checkAndSchedule } from '@/services/notifications/notification.service';
import {
  getSessionToken,
  importKeyFromToken,
  clearSessionToken,
} from '@/app/stores/session.store';
import { userStorage } from '@/services/storage/user.storage';
import type { UUID } from '@/shared/types/common.types';
import { LoadingSpinner } from '@/app/LoadingSpinner';

// --- Theme Initializer ---
function ThemeInitializer() {
  const setTheme = useUIStore((s) => s.setTheme);
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    setTheme(theme);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (useUIStore.getState().theme === 'system') {
        setTheme('system');
      }
    };
    mediaQuery.addEventListener('change', handler);
    return () => { mediaQuery.removeEventListener('change', handler); };
  }, [setTheme, theme]);

  return null;
}

// --- Inactivity Watcher ---
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;

function InactivityWatcher() {
  const refreshActivity = useSessionStore((s) => s.refreshActivity);
  const lock = useSessionStore((s) => s.lock);
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleActivity = () => {
      if (throttleRef.current !== null) return;
      throttleRef.current = setTimeout(() => {
        refreshActivity();
        throttleRef.current = null;
      }, 1000);
    };

    // When the tab regains focus, check whether the session already expired
    // while the user was away. The inactivity timer pauses when a tab is hidden
    // on some browsers, so we verify expiry on visibility restore.
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const { sessionExpiresAt, isAuthenticated, isLocked } = useSessionStore.getState();
      if (!isAuthenticated || isLocked || !sessionExpiresAt) return;
      if (Date.now() >= new Date(sessionExpiresAt).getTime()) {
        lock();
      }
    };

    ACTIVITY_EVENTS.forEach((event) => { window.addEventListener(event, handleActivity, { passive: true }); });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      ACTIVITY_EVENTS.forEach((event) => { window.removeEventListener(event, handleActivity); });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (throttleRef.current !== null) clearTimeout(throttleRef.current);
    };
  }, [refreshActivity, lock]);

  return null;
}

// --- Toast Renderer ---
const TOAST_COLORS: Record<Toast['type'], string> = {
  success: 'bg-chart-4 text-white',
  error: 'bg-destructive text-destructive-foreground',
  info: 'bg-primary text-primary-foreground',
  warning: 'bg-chart-3 text-white',
};

function ToastRenderer() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  useEffect(() => {
    toasts.forEach((toast) => {
      const duration = toast.duration ?? 4000;
      const timer = setTimeout(() => { removeToast(toast.id); }, duration);
      return () => { clearTimeout(timer); };
    });
  }, [toasts, removeToast]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-20 right-4 lg:bottom-4 z-50 flex flex-col gap-2 pointer-events-none"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg pointer-events-auto max-w-sm ${TOAST_COLORS[toast.type]}`}
          role="alert"
        >
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => { removeToast(toast.id); }}
            className="ml-2 opacity-80 hover:opacity-100 transition-opacity"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

// --- Recurring Transaction Initializer ---
function RecurringTransactionInitializer() {
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const isLocked = useSessionStore((s) => s.isLocked);
  const currentUser = useSessionStore((s) => s.currentUser);
  const derivedKey = useSessionStore((s) => s.derivedKey);
  const hasRun = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || isLocked || !currentUser || !derivedKey) {
      hasRun.current = false;
      return;
    }
    if (hasRun.current) return;
    hasRun.current = true;
    void generateRecurringTransactions(currentUser.id, derivedKey);
  }, [isAuthenticated, isLocked, currentUser, derivedKey]);

  return null;
}

// --- Bill Entry Initializer ---
function BillEntryInitializer() {
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const isLocked = useSessionStore((s) => s.isLocked);
  const currentUser = useSessionStore((s) => s.currentUser);
  const derivedKey = useSessionStore((s) => s.derivedKey);
  const hasRun = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || isLocked || !currentUser || !derivedKey) {
      hasRun.current = false;
      return;
    }
    if (hasRun.current) return;
    hasRun.current = true;
    void generateAllUserEntries(currentUser.id, derivedKey);
  }, [isAuthenticated, isLocked, currentUser, derivedKey]);

  return null;
}

// --- Dashboard Initializer ---
function DashboardInitializer() {
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const isLocked = useSessionStore((s) => s.isLocked);
  const currentUser = useSessionStore((s) => s.currentUser);
  const loadDashboard = useDashboardStore((s) => s.loadDashboard);
  const loadInsights = useDashboardStore((s) => s.loadInsights);
  const resetDashboard = useDashboardStore((s) => s.reset);
  const hasRun = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || isLocked || !currentUser) {
      hasRun.current = false;
      resetDashboard();
      return;
    }
    if (hasRun.current) return;
    hasRun.current = true;
    void loadDashboard(currentUser.id).then(() => {
      void loadInsights(currentUser.id);
    });
  }, [isAuthenticated, isLocked, currentUser, loadDashboard, loadInsights, resetDashboard]);

  return null;
}

// ---------------------------------------------------------------------------
// --- PWA Initializer --- registers SW, captures install prompt, detects update
// ---------------------------------------------------------------------------
function PWAInitializer() {
  const { setInstallPromptEvent, setInstalled, showInstallBanner, setUpdateAvailable } = usePWAStore();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // sw.js only exists in the production build — skip registration in dev.
    if (!import.meta.env.PROD) return;

    // Register service worker via workbox-window
    const wb = new Workbox(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });

    // Store reference on window for UpdateBanner usage
    window.__zentroWB = wb;

    // Detect updates — a new SW is waiting
    wb.addEventListener('waiting', () => {
      setUpdateAvailable(true);
    });

    void wb.register();

    // Capture the native install prompt
    const handleInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);

    // Detect already-installed state
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
    }
    window.addEventListener('appinstalled', () => { setInstalled(true); });

    // Show install banner after 30s if prompt is available
    const installBannerTimer = setTimeout(() => { showInstallBanner(); }, 30_000);

    // Listen for navigation messages from SW (notification click)
    navigator.serviceWorker.addEventListener('message', (event: MessageEvent<unknown>) => {
      const data = event.data as { type?: string; url?: string } | null;
      if (data?.type === 'NAVIGATE' && data.url) {
        window.location.assign(data.url);
      }
    });

    return () => {
      clearTimeout(installBannerTimer);
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

// ---------------------------------------------------------------------------
// --- SW State Sync --- writes active userId + notificationPreferences to IDB
//     so the service worker can read them while the main thread is sleeping
// ---------------------------------------------------------------------------
function SWStateSync() {
  const currentUser = useSessionStore((s) => s.currentUser);
  const notificationPreferences = usePreferencesStore((s) => s.notificationPreferences);
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);

  // Sync userId on login/logout
  useEffect(() => {
    if (isAuthenticated && currentUser?.id) {
      void writeSWState('activeUserId', currentUser.id);
      void writeSWState('notificationPreferences', notificationPreferences);
    } else {
      void writeSWState('activeUserId', null);
    }
  }, [isAuthenticated, currentUser, notificationPreferences]);

  return null;
}

// ---------------------------------------------------------------------------
// --- Periodic Sync Registrar --- registers PBS tags (or setInterval fallback)
// ---------------------------------------------------------------------------
function PeriodicSyncRegistrar() {
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const isLocked = useSessionStore((s) => s.isLocked);
  const hasRun = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || isLocked) {
      hasRun.current = false;
      return;
    }
    if (hasRun.current) return;
    hasRun.current = true;
    void registerPeriodicSync();
  }, [isAuthenticated, isLocked]);

  return null;
}

// ---------------------------------------------------------------------------
// --- Notification Initializer --- runs the main-thread notification check
//     once on session start so fresh alerts are sent without waiting for PBS
// ---------------------------------------------------------------------------
function NotificationInitializer() {
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const isLocked = useSessionStore((s) => s.isLocked);
  const currentUser = useSessionStore((s) => s.currentUser);
  const hasRun = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || isLocked || !currentUser) {
      hasRun.current = false;
      return;
    }
    if (hasRun.current) return;
    hasRun.current = true;
    void checkAndSchedule(currentUser.id);
  }, [isAuthenticated, isLocked, currentUser]);

  return null;
}

// ---------------------------------------------------------------------------
// --- Session Restorer ---
// Reads the sessionStorage token written on login/unlock and silently
// restores the Zustand session state before the router mounts.
// sessionStorage is cleared by the browser on tab close, so this never
// rehydrates a session from a closed tab.
// ---------------------------------------------------------------------------
function SessionRestorer({ onDone }: { onDone: () => void }) {
  const restoreSession = useSessionStore((s) => s.restoreSession);

  useEffect(() => {
    async function tryRestore() {
      const token = await getSessionToken();
      if (token) {
        try {
          const [userResult, key] = await Promise.all([
            userStorage.getUserById(token.userId as UUID),
            importKeyFromToken(token.rawKey),
          ]);
          if (userResult.success) {
            restoreSession(userResult.data, key, token.inactivityTimeoutMinutes);
            onDone();
            return;
          }
        } catch {
          // Token was invalid or IDB unavailable — clear it and send to login
        }
        clearSessionToken();
      }
      onDone();
    }
    void tryRestore();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

// --- App Providers ---
export function Providers() {
  const [sessionRestored, setSessionRestored] = useState(false);

  return (
    <ErrorBoundary>
      <ThemeInitializer />
      <InactivityWatcher />
      <PWAInitializer />
      <SessionRestorer onDone={() => { setSessionRestored(true); }} />
      {!sessionRestored ? (
        <LoadingSpinner />
      ) : (
        <>
          <SWStateSync />
          <PeriodicSyncRegistrar />
          <NotificationInitializer />
          <RecurringTransactionInitializer />
          <BillEntryInitializer />
          <DashboardInitializer />
          <RouterProvider router={router} />
          <ToastRenderer />
        </>
      )}
    </ErrorBoundary>
  );
}
