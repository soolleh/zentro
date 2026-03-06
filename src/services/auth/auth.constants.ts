import type { ISODateString, UUID, Currency } from '@/shared/types/common.types';
import type { UserSettings } from '@/shared/types/settings.types';
import type { NotificationPreference } from '@/shared/types/notification.types';

// ---------------------------------------------------------------------------
// Default notification preferences applied to every new user account.
// ---------------------------------------------------------------------------
const DEFAULT_NOTIFICATION_PREFERENCES: readonly NotificationPreference[] = [
  { type: 'BudgetAlert', enabled: true, thresholdOverride: undefined },
  { type: 'BillDue', enabled: true },
  { type: 'GoalReminder', enabled: true, dayOfWeek: 1 },
  { type: 'WeeklySummary', enabled: true, dayOfWeek: 0, timeOfDay: '09:00' },
  { type: 'DailyReminder', enabled: true, timeOfDay: '21:00' },
];

// ---------------------------------------------------------------------------
// Default UserSettings for newly registered users.
// userId and updatedAt are filled in at registration time.
// ---------------------------------------------------------------------------
export function buildDefaultSettings(userId: UUID, now: ISODateString): UserSettings {
  return {
    userId,
    theme: 'system',
    dateFormat: 'DD/MM/YYYY',
    baseCurrency: 'USD' as Currency,
    defaultAlertThreshold: 80,
    budgetCycleStartDay: 1,
    notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
    inactivityTimeoutMinutes: 5,
    updatedAt: now,
    onboardingCompletedAt: null,
  };
}

// ---------------------------------------------------------------------------
// Password policy (used by both the service and the UI strength meter).
// ---------------------------------------------------------------------------
export const PASSWORD_MIN_LENGTH = 12;

export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

export function getPasswordStrength(password: string): PasswordStrength {
  if (password.length === 0) return 0;
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(4, score) as PasswordStrength;
}
