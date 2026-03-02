import { useEffect, useRef } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { useUIStore } from '@/app/ui.store';
import { useSessionStore } from '@/app/session.store';
import type { Toast } from '@/app/ui.store';
import { router } from '@/app/router';

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
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleActivity = () => {
      if (throttleRef.current !== null) return;
      throttleRef.current = setTimeout(() => {
        refreshActivity();
        throttleRef.current = null;
      }, 1000);
    };

    ACTIVITY_EVENTS.forEach((event) => { window.addEventListener(event, handleActivity, { passive: true }); });
    return () => {
      ACTIVITY_EVENTS.forEach((event) => { window.removeEventListener(event, handleActivity); });
      if (throttleRef.current !== null) clearTimeout(throttleRef.current);
    };
  }, [refreshActivity]);

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

// --- App Providers ---
export function Providers() {
  return (
    <ErrorBoundary>
      <ThemeInitializer />
      <InactivityWatcher />
      <RouterProvider router={router} />
      <ToastRenderer />
    </ErrorBoundary>
  );
}
