import { create } from 'zustand';
import type { Currency } from '@/shared/types/common.types';
import type { NotificationPreference } from '@/shared/types/notification.types';
import type { UserSettings, DateFormat } from '@/shared/types/settings.types';

type PreferencesState = {
  dateFormat: DateFormat;
  baseCurrency: Currency;
  defaultAlertThreshold: number;
  inactivityTimeoutMinutes: number;
  notificationPreferences: readonly NotificationPreference[];
};

type PreferencesActions = {
  loadPreferences: (settings: UserSettings) => void;
  updatePreference: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
};

const DEFAULT_CURRENCY = 'USD' as Currency;

export const usePreferencesStore = create<PreferencesState & PreferencesActions>((set) => ({
  dateFormat: 'DD/MM/YYYY',
  baseCurrency: DEFAULT_CURRENCY,
  defaultAlertThreshold: 80,
  inactivityTimeoutMinutes: 5,
  notificationPreferences: [],

  loadPreferences(settings) {
    set({
      dateFormat: settings.dateFormat,
      baseCurrency: settings.baseCurrency,
      defaultAlertThreshold: settings.defaultAlertThreshold,
      inactivityTimeoutMinutes: settings.inactivityTimeoutMinutes,
      notificationPreferences: settings.notificationPreferences,
    });
  },

  updatePreference(key, value) {
    set((state) => ({ ...state, [key]: value }));
  },
}));
