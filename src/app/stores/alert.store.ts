/**
 * alert.store.ts
 *
 * Zustand store for account balance alert state.
 * Manages alerts list, form state, and triggered alerts.
 */
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { UUID } from '@/shared/types/common.types';
import type {
  AccountAlert,
  AlertEvaluationResult,
  EnrichedAccountAlert,
} from '@/shared/types/alert.types';
import type { Account } from '@/shared/types/account.types';
import { getEnrichedAlerts, snoozeAlertById } from '@/services/alerts/alert.service';
import { alertStorage } from '@/services/storage/alert.storage';
import { useSessionStore } from '@/app/stores/session.store';

// ---------------------------------------------------------------------------
// State types
// ---------------------------------------------------------------------------

type AlertState = {
  alerts: EnrichedAccountAlert[];
  isLoading: boolean;
  isFormOpen: boolean;
  formMode: 'add' | 'edit';
  activeAlert: AccountAlert | null;
  /** Pre-selected account when opening form from account detail */
  activeAccountId: UUID | null;
  triggeredAlerts: AlertEvaluationResult[];
};

type AlertActions = {
  loadAlerts: (userId: UUID) => Promise<void>;
  openAddForm: (accountId: UUID) => void;
  openEditForm: (alert: AccountAlert) => void;
  closeForm: () => void;
  addAlertToList: (alert: AccountAlert, account: Account) => void;
  updateAlertInList: (alert: AccountAlert) => void;
  removeAlertFromList: (alertId: UUID) => void;
  setTriggeredAlerts: (results: AlertEvaluationResult[]) => void;
  snoozeAlert: (alertId: UUID, hours: 1 | 4 | 24) => Promise<void>;
  toggleAlertEnabled: (alertId: UUID) => Promise<void>;
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAlertStore = create<AlertState & AlertActions>((set, get) => ({
  alerts: [],
  isLoading: false,
  isFormOpen: false,
  formMode: 'add',
  activeAlert: null,
  activeAccountId: null,
  triggeredAlerts: [],

  async loadAlerts(userId) {
    set({ isLoading: true });
    try {
      const result = await getEnrichedAlerts(userId);
      if (result.success) {
        set({ alerts: result.data });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  openAddForm(accountId) {
    set({ isFormOpen: true, formMode: 'add', activeAlert: null, activeAccountId: accountId });
  },

  openEditForm(alert) {
    set({
      isFormOpen: true,
      formMode: 'edit',
      activeAlert: alert,
      activeAccountId: alert.accountId,
    });
  },

  closeForm() {
    set({ isFormOpen: false, activeAlert: null, activeAccountId: null });
  },

  addAlertToList(alert, account) {
    const isCurrentlyTriggered =
      alert.condition === 'below'
        ? false // newly created — not yet evaluated
        : false;
    set((s) => ({
      alerts: [...s.alerts, { alert, account, isCurrentlyTriggered }],
    }));
  },

  updateAlertInList(alert) {
    set((s) => ({
      alerts: s.alerts.map((ea) =>
        ea.alert.id === alert.id
          ? {
              ...ea,
              alert,
              isCurrentlyTriggered:
                alert.condition === 'below' ? ea.isCurrentlyTriggered : ea.isCurrentlyTriggered,
            }
          : ea
      ),
    }));
  },

  removeAlertFromList(alertId) {
    set((s) => ({
      alerts: s.alerts.filter((ea) => ea.alert.id !== alertId),
    }));
  },

  setTriggeredAlerts(results) {
    set({ triggeredAlerts: results });
  },

  async snoozeAlert(alertId, hours) {
    const result = await snoozeAlertById(alertId, hours);
    if (result.success) {
      // Update in list
      set((s) => ({
        alerts: s.alerts.map((ea) => {
          if (ea.alert.id !== alertId) return ea;
          const snoozedAlert: AccountAlert = {
            ...ea.alert,
            status: 'snoozed',
          };
          return { ...ea, alert: snoozedAlert };
        }),
        triggeredAlerts: s.triggeredAlerts.filter((r) => r.alert.id !== alertId),
      }));
    }
  },

  async toggleAlertEnabled(alertId) {
    const key = useSessionStore.getState().derivedKey;
    if (!key) return;

    const existing = get().alerts.find((ea) => ea.alert.id === alertId);
    if (!existing) return;

    const newEnabled = !existing.alert.isEnabled;
    const result = await alertStorage.updateAlert(alertId, { isEnabled: newEnabled }, key);
    if (result.success) {
      get().updateAlertInList(result.data);
    }
  },
}));

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function useAlerts() {
  return useAlertStore(
    useShallow((s) => ({
      alerts: s.alerts,
      isLoading: s.isLoading,
    }))
  );
}

export function useAlertsForAccount(accountId: UUID) {
  return useAlertStore(
    useShallow((s) => s.alerts.filter((ea) => ea.alert.accountId === accountId))
  );
}

export function useTriggeredAlerts() {
  return useAlertStore(useShallow((s) => ({ triggeredAlerts: s.triggeredAlerts })));
}

export function useAlertForm() {
  return useAlertStore(
    useShallow((s) => ({
      isFormOpen: s.isFormOpen,
      formMode: s.formMode,
      activeAlert: s.activeAlert,
      activeAccountId: s.activeAccountId,
      openAddForm: s.openAddForm,
      openEditForm: s.openEditForm,
      closeForm: s.closeForm,
    }))
  );
}
