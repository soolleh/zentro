/**
 * account.store.ts
 *
 * Zustand store for the Accounts module.
 * Follows the same pattern as ui.store.ts.
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { UUID } from '@/shared/types/common.types';
import type { AccountWithBalance, NetWorthSummary } from '@/shared/types/account.types';
import {
  getAllAccountsWithBalances,
  getAccountBalance,
  getNetWorth,
} from '@/services/accounts/account.service';
import { accountStorage } from '@/services/storage/account.storage';
import { useSessionStore } from '@/app/stores/session.store';
import { usePreferencesStore } from '@/app/preferences.store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PanelMode = 'view' | 'add' | 'edit' | 'transfer' | 'reconcile';

type AccountState = {
  readonly accounts: AccountWithBalance[];
  readonly isLoading: boolean;
  readonly loadError: string | null;
  readonly activeAccount: AccountWithBalance | null;
  readonly isPanelOpen: boolean;
  readonly panelMode: PanelMode;
  readonly netWorth: NetWorthSummary | null;
};

type AccountActions = {
  loadAccounts: (userId: UUID) => Promise<void>;
  loadNetWorth: (userId: UUID) => Promise<void>;
  openPanel: (mode: PanelMode, account?: AccountWithBalance) => void;
  closePanel: () => void;
  setActiveAccount: (account: AccountWithBalance | null) => void;
  addAccountToList: (account: AccountWithBalance) => void;
  updateAccountInList: (account: AccountWithBalance) => void;
  removeAccountFromList: (id: UUID) => void;
  refreshAccount: (accountId: UUID) => Promise<void>;
  reset: () => void;
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const DEFAULTS: AccountState = {
  accounts: [],
  isLoading: false,
  loadError: null,
  activeAccount: null,
  isPanelOpen: false,
  panelMode: 'view',
  netWorth: null,
};

export const useAccountStore = create<AccountState & AccountActions>((set, get) => ({
  ...DEFAULTS,

  async loadAccounts(userId) {
    const key = useSessionStore.getState().derivedKey;
    if (!key) return;
    set({ isLoading: true, loadError: null });
    const result = await getAllAccountsWithBalances(userId, key);
    if (result.success) {
      set({ accounts: result.data, isLoading: false });
    } else {
      set({ isLoading: false, loadError: result.error.message });
    }
  },

  async loadNetWorth(userId) {
    const key = useSessionStore.getState().derivedKey;
    if (!key) return;
    const baseCurrency = usePreferencesStore.getState().baseCurrency;
    const result = await getNetWorth(userId, key, baseCurrency);
    if (result.success) {
      set({ netWorth: result.data });
    }
  },

  openPanel(mode, account) {
    set({ isPanelOpen: true, panelMode: mode, activeAccount: account ?? null });
  },

  closePanel() {
    set({ isPanelOpen: false, activeAccount: null });
  },

  setActiveAccount(account) {
    set({ activeAccount: account });
  },

  addAccountToList(account) {
    set((state) => ({ accounts: [...state.accounts, account] }));
  },

  updateAccountInList(account) {
    set((state) => ({
      accounts: state.accounts.map((a) => (a.account.id === account.account.id ? account : a)),
      activeAccount:
        state.activeAccount?.account.id === account.account.id ? account : state.activeAccount,
    }));
  },

  removeAccountFromList(id) {
    set((state) => ({
      accounts: state.accounts.filter((a) => a.account.id !== id),
      activeAccount: state.activeAccount?.account.id === id ? null : state.activeAccount,
    }));
  },

  async refreshAccount(accountId) {
    const key = useSessionStore.getState().derivedKey;
    if (!key) return;
    const accountResult = await accountStorage.getAccountById(accountId, key);
    if (!accountResult.success || !accountResult.data) return;

    const balanceResult = await getAccountBalance(accountId, key);
    if (!balanceResult.success) return;

    const account = accountResult.data;
    const updated: AccountWithBalance = {
      account,
      currentBalance: balanceResult.data,
      isAsset: ['Cash', 'Bank', 'Checking', 'Savings', 'Investment'].includes(account.type),
      isLiability: ['CreditCard', 'Loan'].includes(account.type),
    };
    get().updateAccountInList(updated);
  },

  reset() {
    set(DEFAULTS);
  },
}));

// ---------------------------------------------------------------------------
// Selector hooks
// ---------------------------------------------------------------------------

export function useAccounts() {
  return useAccountStore(
    useShallow((s) => ({
      accounts: s.accounts,
      isLoading: s.isLoading,
      loadError: s.loadError,
      loadAccounts: s.loadAccounts,
    }))
  );
}

export function useNetWorth() {
  return useAccountStore(
    useShallow((s) => ({
      netWorth: s.netWorth,
      loadNetWorth: s.loadNetWorth,
    }))
  );
}

export function useAccountPanel() {
  return useAccountStore(
    useShallow((s) => ({
      isPanelOpen: s.isPanelOpen,
      panelMode: s.panelMode,
      activeAccount: s.activeAccount,
      openPanel: s.openPanel,
      closePanel: s.closePanel,
    }))
  );
}

export function useAssets(): AccountWithBalance[] {
  return useAccountStore(useShallow((s) => s.accounts.filter((a) => a.isAsset)));
}

export function useLiabilities(): AccountWithBalance[] {
  return useAccountStore(useShallow((s) => s.accounts.filter((a) => a.isLiability)));
}
