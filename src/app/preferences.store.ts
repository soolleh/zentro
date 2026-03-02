import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { Currency, ISODateString } from '@/shared/types/common.types';
import type { NotificationPreference } from '@/shared/types/notification.types';
import type { UserSettings, DateFormat, Theme } from '@/shared/types/settings.types';
import { settingsStorage } from '@/services/storage/settings.storage';
import { useSessionStore } from '@/app/stores/session.store';
import { useUIStore } from '@/app/ui.store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUpdatedSettings(
  current: PreferencesState,
  patch: Partial<Omit<UserSettings, 'userId' | 'updatedAt'>>
): UserSettings | null {
  const userId = useSessionStore.getState().currentUser?.id;
  if (!userId) return null;
  return {
    userId,
    theme: patch.theme ?? current.theme,
    dateFormat: patch.dateFormat ?? current.dateFormat,
    baseCurrency: patch.baseCurrency ?? current.baseCurrency,
    defaultAlertThreshold: patch.defaultAlertThreshold ?? current.defaultAlertThreshold,
    budgetCycleStartDay: patch.budgetCycleStartDay ?? current.budgetCycleStartDay,
    notificationPreferences: patch.notificationPreferences ?? current.notificationPreferences,
    inactivityTimeoutMinutes: patch.inactivityTimeoutMinutes ?? current.inactivityTimeoutMinutes,
    onboardingCompletedAt:
      patch.onboardingCompletedAt !== undefined
        ? patch.onboardingCompletedAt
        : current.onboardingCompletedAt,
    updatedAt: new Date().toISOString() as UserSettings['updatedAt'],
  };
}

async function persistSettings(settings: UserSettings): Promise<boolean> {
  const key = useSessionStore.getState().derivedKey;
  if (!key) return false;
  const result = await settingsStorage.upsertSettings(settings, key);
  if (!result.success) {
    useUIStore.getState().addToast({
      type: 'error',
      message: `Settings failed to save: ${result.error.message}`,
      duration: 5000,
    });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

type PreferencesState = {
  readonly theme: Theme;
  readonly dateFormat: DateFormat;
  readonly baseCurrency: Currency;
  readonly defaultAlertThreshold: number;
  readonly budgetCycleStartDay: number;
  readonly inactivityTimeoutMinutes: number;
  readonly notificationPreferences: readonly NotificationPreference[];
  readonly onboardingCompletedAt: ISODateString | null;
  readonly isLoaded: boolean;
};

type PreferencesActions = {
  /** Hydrates all state from a UserSettings record. Called on login. */
  loadPreferences: (settings: UserSettings) => void;
  updateTheme: (theme: Theme) => void;
  updateDateFormat: (format: DateFormat) => void;
  updateBaseCurrency: (currency: Currency) => void;
  updateAlertThreshold: (threshold: number) => void;
  updateBudgetCycleStartDay: (day: number) => void;
  updateInactivityTimeout: (minutes: number) => void;
  updateNotificationPreference: (pref: NotificationPreference) => void;
  reset: () => void;
};

const DEFAULTS: PreferencesState = {
  theme: 'system',
  dateFormat: 'DD/MM/YYYY',
  baseCurrency: 'USD' as Currency,
  defaultAlertThreshold: 80,
  budgetCycleStartDay: 1,
  inactivityTimeoutMinutes: 5,
  notificationPreferences: [],
  onboardingCompletedAt: null,
  isLoaded: false,
};

export const usePreferencesStore = create<PreferencesState & PreferencesActions>((set, get) => ({
  ...DEFAULTS,

  loadPreferences(settings) {
    // Sync theme with ui store on login
    useUIStore.getState().setTheme(settings.theme);
    set({
      theme: settings.theme,
      dateFormat: settings.dateFormat,
      baseCurrency: settings.baseCurrency,
      defaultAlertThreshold: settings.defaultAlertThreshold,
      budgetCycleStartDay: (settings.budgetCycleStartDay as number | undefined) ?? 1,
      inactivityTimeoutMinutes: settings.inactivityTimeoutMinutes,
      notificationPreferences: settings.notificationPreferences,
      onboardingCompletedAt: settings.onboardingCompletedAt ?? null,
      isLoaded: true,
    });
  },

  updateTheme(theme) {
    const prev = get().theme;
    set({ theme });
    useUIStore.getState().setTheme(theme);
    const updated = makeUpdatedSettings(get(), { theme });
    if (!updated) {
      set({ theme: prev });
      return;
    }
    void persistSettings(updated).then((ok) => {
      if (!ok) {
        set({ theme: prev });
        useUIStore.getState().setTheme(prev);
      }
    });
  },

  updateDateFormat(dateFormat) {
    const prev = get().dateFormat;
    set({ dateFormat });
    const updated = makeUpdatedSettings(get(), { dateFormat });
    if (!updated) {
      set({ dateFormat: prev });
      return;
    }
    void persistSettings(updated).then((ok) => {
      if (!ok) set({ dateFormat: prev });
    });
  },

  updateBaseCurrency(baseCurrency) {
    const prev = get().baseCurrency;
    set({ baseCurrency });
    const updated = makeUpdatedSettings(get(), { baseCurrency });
    if (!updated) {
      set({ baseCurrency: prev });
      return;
    }
    void persistSettings(updated).then((ok) => {
      if (!ok) set({ baseCurrency: prev });
    });
  },

  updateAlertThreshold(defaultAlertThreshold) {
    const prev = get().defaultAlertThreshold;
    set({ defaultAlertThreshold });
    const updated = makeUpdatedSettings(get(), { defaultAlertThreshold });
    if (!updated) {
      set({ defaultAlertThreshold: prev });
      return;
    }
    void persistSettings(updated).then((ok) => {
      if (!ok) set({ defaultAlertThreshold: prev });
    });
  },

  updateBudgetCycleStartDay(budgetCycleStartDay) {
    const prev = get().budgetCycleStartDay;
    set({ budgetCycleStartDay });
    const updated = makeUpdatedSettings(get(), { budgetCycleStartDay });
    if (!updated) {
      set({ budgetCycleStartDay: prev });
      return;
    }
    void persistSettings(updated).then((ok) => {
      if (!ok) set({ budgetCycleStartDay: prev });
    });
  },

  updateInactivityTimeout(inactivityTimeoutMinutes) {
    const prev = get().inactivityTimeoutMinutes;
    set({ inactivityTimeoutMinutes });
    // Keep session store in sync
    useSessionStore
      .getState()
      .setInactivityTimeout(inactivityTimeoutMinutes <= 0 ? 999999 : inactivityTimeoutMinutes);
    const updated = makeUpdatedSettings(get(), { inactivityTimeoutMinutes });
    if (!updated) {
      set({ inactivityTimeoutMinutes: prev });
      return;
    }
    void persistSettings(updated).then((ok) => {
      if (!ok) {
        set({ inactivityTimeoutMinutes: prev });
        useSessionStore.getState().setInactivityTimeout(prev <= 0 ? 999999 : prev);
      }
    });
  },

  updateNotificationPreference(pref) {
    const prev = get().notificationPreferences;
    const updated_prefs = prev.some((p) => p.type === pref.type)
      ? prev.map((p) => (p.type === pref.type ? pref : p))
      : [...prev, pref];
    set({ notificationPreferences: updated_prefs });
    const updated = makeUpdatedSettings(get(), { notificationPreferences: updated_prefs });
    if (!updated) {
      set({ notificationPreferences: prev });
      return;
    }
    void persistSettings(updated).then((ok) => {
      if (!ok) set({ notificationPreferences: prev });
    });
  },

  reset() {
    set(DEFAULTS);
  },
}));

// ---------------------------------------------------------------------------
// Selector hooks
// ---------------------------------------------------------------------------

export function useDateFormat() {
  return usePreferencesStore(
    useShallow((s) => ({
      dateFormat: s.dateFormat,
      updateDateFormat: s.updateDateFormat,
    }))
  );
}

export function useBaseCurrency() {
  return usePreferencesStore(
    useShallow((s) => ({
      baseCurrency: s.baseCurrency,
      updateBaseCurrency: s.updateBaseCurrency,
    }))
  );
}

export function useAlertThreshold() {
  return usePreferencesStore(
    useShallow((s) => ({
      defaultAlertThreshold: s.defaultAlertThreshold,
      updateAlertThreshold: s.updateAlertThreshold,
    }))
  );
}

export function useInactivityTimeout() {
  return usePreferencesStore(
    useShallow((s) => ({
      inactivityTimeoutMinutes: s.inactivityTimeoutMinutes,
      updateInactivityTimeout: s.updateInactivityTimeout,
    }))
  );
}

export function useNotificationPreferences() {
  return usePreferencesStore(
    useShallow((s) => ({
      notificationPreferences: s.notificationPreferences,
      updateNotificationPreference: s.updateNotificationPreference,
    }))
  );
}

export function usePreferencesLoaded() {
  return usePreferencesStore((s) => s.isLoaded);
}
