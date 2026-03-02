import type { UUID, ISODateString, Currency } from './common.types';
import type { NotificationPreference } from './notification.types';

export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';

export type Theme = 'light' | 'dark' | 'system';

export type UserSettings = {
  readonly userId: UUID;
  readonly theme: Theme;
  readonly dateFormat: DateFormat;
  readonly baseCurrency: Currency;
  readonly defaultAlertThreshold: number;
  readonly budgetCycleStartDay: number;
  readonly notificationPreferences: readonly NotificationPreference[];
  readonly inactivityTimeoutMinutes: number;
  readonly updatedAt: ISODateString;
  readonly onboardingCompletedAt: ISODateString | null;
};
