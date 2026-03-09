/**
 * NotificationsSection
 *
 * Per-notification-type toggles with optional sub-settings.
 * Uses a custom Toggle (switch) component built inline.
 */

import { Bell, BellDot, BellOff, TrendingUp, CalendarDays, BarChart2, Send, AlarmClock, Wallet } from 'lucide-react';
import { SettingsSection } from '../components/SettingsSection';
import { SettingsCard } from '../components/SettingsCard';
import { SettingsRow } from '../components/SettingsRow';
import { useNotificationPreferences } from '@/app/preferences.store';
import { usePreferencesStore } from '@/app/preferences.store';
import type { NotificationType, NotificationPreference } from '@/shared/types/notification.types';
import { usePWAStore } from '@/app/stores/pwa.store';
import {
  requestPermission,
  sendTestNotification,
  isNotificationSupported,
} from '@/services/notifications/notification.service';

// ---------------------------------------------------------------------------
// Custom Toggle (switch)
// ---------------------------------------------------------------------------

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
  id?: string;
};

function Toggle({ checked, onChange, disabled = false, ariaLabel, id }: ToggleProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => { onChange(!checked); }}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
        'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        checked ? 'bg-primary' : 'bg-input',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0',
          'transition-transform duration-150',
          checked ? 'translate-x-4' : 'translate-x-0',
        ].join(' ')}
        aria-hidden="true"
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Custom Checkbox
// ---------------------------------------------------------------------------

type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  id: string;
};

function Checkbox({ checked, onChange, label, id }: CheckboxProps) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => { onChange(e.target.checked); }}
        className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
      />
      {label}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getPref(
  prefs: readonly NotificationPreference[],
  type: NotificationType
): NotificationPreference {
  return prefs.find((p) => p.type === type) ?? { type, enabled: false };
}

// ---------------------------------------------------------------------------
// NotificationRow
// ---------------------------------------------------------------------------

type NotificationRowProps = {
  pref: NotificationPreference;
  onToggle: (enabled: boolean) => void;
  icon: React.ReactNode;
  label: string;
  description: string;
  children?: React.ReactNode;
};

function NotificationRow({
  pref,
  onToggle,
  label,
  description,
  children,
}: NotificationRowProps) {
  return (
    <div className="flex flex-col divide-y divide-border">
      <SettingsRow
        label={label}
        description={description}
        control={
          <Toggle
            checked={pref.enabled}
            onChange={onToggle}
            ariaLabel={`Toggle ${label} notifications`}
          />
        }
      >
        {/* Icon placed in the label via SettingsRow's icon prop is LucideIcon type,
            but we want JSX icon here — wrap it in the description area */}
      </SettingsRow>
      {/* Sub-settings shown only when enabled */}
      {pref.enabled && children && (
        <div className="px-4 py-3 bg-muted/30">{children}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function NotificationsSection() {
  const { notificationPreferences, updateNotificationPreference } = useNotificationPreferences();
  const defaultAlertThreshold = usePreferencesStore((s) => s.defaultAlertThreshold);
  const { notificationPermission, setNotificationPermission } = usePWAStore();

  const budgetPref = getPref(notificationPreferences, 'BudgetAlert');
  const billPref = getPref(notificationPreferences, 'BillDue');
  const goalPref = getPref(notificationPreferences, 'GoalReminder');
  const weeklySummaryPref = getPref(notificationPreferences, 'WeeklySummary');
  const dailyReminderPref = getPref(notificationPreferences, 'DailyReminder');
  const balanceAlertPref = getPref(notificationPreferences, 'AccountBalanceAlert');

  async function toggle(type: NotificationType, enabled: boolean) {
    if (enabled && notificationPermission === 'default' && isNotificationSupported()) {
      const perm = await requestPermission();
      setNotificationPermission(perm);
      if (perm !== 'granted') return; // don't enable if blocked
    }
    const existing = getPref(notificationPreferences, type);
    updateNotificationPreference({ ...existing, enabled });
  }

  function update(pref: NotificationPreference) {
    updateNotificationPreference(pref);
  }

  const isBlocked = notificationPermission === 'denied' || !isNotificationSupported();

  // Bill due day helpers
  const billDays = (billPref as NotificationPreference & { daysBefore?: number[] }).daysBefore ?? [1, 3];
  function toggleBillDay(day: number, checked: boolean) {
    const current = billDays;
    const updated = checked
      ? [...new Set([...current, day])].sort()
      : current.filter((d) => d !== day);
    update({ ...billPref, daysBefore: updated } as NotificationPreference);
  }

  return (
    <SettingsSection
      id="notifications"
      title="Notifications"
      description="Choose which in-app and local notifications Zentro sends. No server is involved — all alerts are generated on this device."
    >
      {/* Permission denied banner */}
      {isBlocked && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <BellOff size={15} className="text-destructive mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-xs text-destructive leading-relaxed">
            {!isNotificationSupported()
              ? 'Your browser does not support notifications.'
              : 'Notifications are blocked. Open your browser site settings, allow notifications for Zentro, then reload the page.'}
          </p>
        </div>
      )}

      {/* Default permission note */}
      {notificationPermission !== 'denied' && isNotificationSupported() && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 px-4 py-3">
          <Bell size={15} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            Notifications require browser permission. If permission has been denied, use your
            browser's site settings to re-enable it. In-app banners are always shown as a fallback.
          </p>
        </div>
      )}

      <SettingsCard>
        {/* Budget Alert */}
        <NotificationRow
          pref={budgetPref}
          onToggle={(enabled) => { void toggle('BudgetAlert', enabled); }}
          icon={<BellDot size={16} />}
          label="Budget Alerts"
          description="Get notified when a budget category reaches its threshold."
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="budget-threshold-override" className="text-xs text-muted-foreground">
              Custom threshold (leave empty to use global default: {defaultAlertThreshold}%)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="budget-threshold-override"
                type="number"
                min={50}
                max={100}
                step={5}
                placeholder={String(defaultAlertThreshold)}
                value={budgetPref.thresholdOverride ?? ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? undefined : Number(e.target.value);
                  update({ ...budgetPref, thresholdOverride: val });
                }}
                className="w-20 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        </NotificationRow>

        {/* Bill Due */}
        <NotificationRow
          pref={billPref}
          onToggle={(enabled) => { void toggle('BillDue', enabled); }}
          icon={<CalendarDays size={16} />}
          label="Bill Reminders"
          description="Reminders before a recurring bill is due."
        >
          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground">Remind me this many days before:</span>
            <div className="flex gap-4">
              <Checkbox
                id="bill-due-1"
                checked={billDays.includes(1)}
                onChange={(c) => { toggleBillDay(1, c); }}
                label="1 day before"
              />
              <Checkbox
                id="bill-due-3"
                checked={billDays.includes(3)}
                onChange={(c) => { toggleBillDay(3, c); }}
                label="3 days before"
              />
            </div>
          </div>
        </NotificationRow>

        {/* Goal Reminder */}
        <NotificationRow
          pref={goalPref}
          onToggle={(enabled) => { void toggle('GoalReminder', enabled); }}
          icon={<TrendingUp size={16} />}
          label="Savings Goal Reminders"
          description="Weekly reminders when a savings goal is behind target pace."
        />

        {/* Daily Transaction Reminder */}
        <NotificationRow
          pref={dailyReminderPref}
          onToggle={(enabled) => { void toggle('DailyReminder', enabled); }}
          icon={<AlarmClock size={16} />}
          label="Daily Transaction Reminder"
          description="A daily nudge to log your transactions and keep your records current."
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="daily-reminder-time" className="text-xs text-muted-foreground">
              Remind me at
            </label>
            <input
              id="daily-reminder-time"
              type="time"
              value={dailyReminderPref.timeOfDay ?? '21:00'}
              onChange={(e) => {
                update({ ...dailyReminderPref, timeOfDay: e.target.value });
              }}
              className="w-32 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </NotificationRow>

        {/* Account Balance Alerts */}
        <NotificationRow
          pref={balanceAlertPref}
          onToggle={(enabled) => { void toggle('AccountBalanceAlert', enabled); }}
          icon={<Wallet size={16} />}
          label="Account Balance Alerts"
          description="Get notified when an account balance crosses a threshold you've set."
        />

        {/* Weekly Summary */}
        <NotificationRow
          pref={weeklySummaryPref}
          onToggle={(enabled) => { void toggle('WeeklySummary', enabled); }}
          icon={<BarChart2 size={16} />}
          label="Weekly Summary"
          description="A digest of your income, expenses, and savings every week."
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="weekly-summary-day" className="text-xs text-muted-foreground">
              Send on
            </label>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Select day of week">
              {DAY_NAMES.map((day, idx) => {
                const isSelected = (weeklySummaryPref.dayOfWeek ?? 1) === idx;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => { update({ ...weeklySummaryPref, dayOfWeek: idx }); }}
                    aria-pressed={isSelected}
                    className={[
                      'rounded-md px-2.5 py-1 text-xs font-medium border transition-colors',
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-foreground border-border hover:bg-muted',
                    ].join(' ')}
                  >
                    {day.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>
        </NotificationRow>
      </SettingsCard>

      {/* Test notification */}
      {notificationPermission === 'granted' && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">Test notifications</p>
            <p className="text-xs text-muted-foreground mt-0.5">Send a test notification to confirm everything is working.</p>
          </div>
          <button
            type="button"
            onClick={() => { void sendTestNotification(); }}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            Send test
          </button>
        </div>
      )}
    </SettingsSection>
  );
}
