/**
 * NotificationsSection
 *
 * Per-notification-type toggles with optional sub-settings.
 * Uses a custom Toggle (switch) component built inline.
 */

import { Bell, BellDot, TrendingUp, CalendarDays, BarChart2 } from 'lucide-react';
import { SettingsSection } from '../components/SettingsSection';
import { SettingsCard } from '../components/SettingsCard';
import { SettingsRow } from '../components/SettingsRow';
import { useNotificationPreferences } from '@/app/preferences.store';
import { usePreferencesStore } from '@/app/preferences.store';
import type { NotificationType, NotificationPreference } from '@/shared/types/notification.types';

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
  _icon,
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

  const budgetPref = getPref(notificationPreferences, 'BudgetAlert');
  const billPref = getPref(notificationPreferences, 'BillDue');
  const goalPref = getPref(notificationPreferences, 'GoalReminder');
  const weeklySummaryPref = getPref(notificationPreferences, 'WeeklySummary');

  function toggle(type: NotificationType, enabled: boolean) {
    const existing = getPref(notificationPreferences, type);
    updateNotificationPreference({ ...existing, enabled });
  }

  function update(pref: NotificationPreference) {
    updateNotificationPreference(pref);
  }

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
      {/* Permission note */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 px-4 py-3">
        <Bell size={15} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
          Notifications require browser permission. If permission has been denied, use your
          browser's site settings to re-enable it. In-app banners are always shown as a fallback.
        </p>
      </div>

      <SettingsCard>
        {/* Budget Alert */}
        <NotificationRow
          pref={budgetPref}
          onToggle={(enabled) => { toggle('BudgetAlert', enabled); }}
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
          onToggle={(enabled) => { toggle('BillDue', enabled); }}
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
          onToggle={(enabled) => { toggle('GoalReminder', enabled); }}
          icon={<TrendingUp size={16} />}
          label="Savings Goal Reminders"
          description="Weekly reminders when a savings goal is behind target pace."
        />

        {/* Weekly Summary */}
        <NotificationRow
          pref={weeklySummaryPref}
          onToggle={(enabled) => { toggle('WeeklySummary', enabled); }}
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
    </SettingsSection>
  );
}
