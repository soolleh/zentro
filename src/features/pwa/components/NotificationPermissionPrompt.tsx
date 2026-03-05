/**
 * NotificationPermissionPrompt.tsx
 *
 * Surfaces 2 minutes after the first authenticated session to ask the user
 * to enable local notifications. Non-intrusive: shown once, never blocked.
 *
 * Never throws on unsupported platforms (Safari < 16.4, etc.).
 */
import { useEffect, useState } from 'react';
import { Bell, BellOff, CheckCircle2 } from 'lucide-react';
import { usePWAStore } from '@/app/stores/pwa.store';
import { requestPermission } from '@/services/notifications/notification.service';

const PROMPT_DELAY_MS = 2 * 60 * 1000; // 2 minutes

const HEADING = 'Stay on top of your finances';
const BODY =
  'Enable notifications for budget alerts, bill reminders, and weekly summaries — all local, never shared.';
const FEATURE_LIST: string[] = [
  'Budget threshold alerts',
  'Bill due reminders',
  'Weekly spending summary',
];
const BTN_ENABLE = 'Enable notifications';
const BTN_LATER = 'Maybe later';

export function NotificationPermissionPrompt() {
  const {
    notificationPermission,
    notificationPromptDismissed,
    setNotificationPermission,
    setNotificationPromptDismissed,
  } = usePWAStore();

  const [visible, setVisible] = useState(false);

  // Show after delay, only if permission is still 'default' and not dismissed
  useEffect(() => {
    if (notificationPermission !== 'default') return;
    if (notificationPromptDismissed) return;
    if (typeof Notification === 'undefined') return;

    const id = setTimeout(() => {
      setVisible(true);
    }, PROMPT_DELAY_MS);

    return () => { clearTimeout(id); };
  }, [notificationPermission, notificationPromptDismissed]);

  if (!visible) return null;

  async function handleEnable() {
    const perm = await requestPermission();
    setNotificationPermission(perm);
    setNotificationPromptDismissed(true);
    setVisible(false);
  }

  function handleDismiss() {
    setNotificationPromptDismissed(true);
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={HEADING}
      className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-sm animate-in slide-in-from-bottom-4 duration-200"
    >
      <div className="rounded-2xl border border-border bg-card p-5 shadow-lg">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Bell className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{HEADING}</p>
            <p className="mt-1 text-xs text-muted-foreground">{BODY}</p>
          </div>
        </div>

        {/* Feature list */}
        <ul className="mt-4 space-y-1.5" aria-label="Notification types">
          {FEATURE_LIST.map((feature) => (
            <li key={feature} className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-chart-4" aria-hidden="true" />
              <span className="text-xs text-muted-foreground">{feature}</span>
            </li>
          ))}
        </ul>

        {/* Denied state */}
        {notificationPermission === 'denied' && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2">
            <BellOff className="h-4 w-4 flex-shrink-0 text-destructive" aria-hidden="true" />
            <p className="text-xs text-destructive">
              Notifications are blocked. Enable them in your browser settings.
            </p>
          </div>
        )}

        {/* Actions */}
        {notificationPermission !== 'denied' && (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleDismiss}
              className="flex-1 rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {BTN_LATER}
            </button>
            <button
              type="button"
              onClick={() => { void handleEnable(); }}
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {BTN_ENABLE}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
