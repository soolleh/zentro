import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { UUID } from '@/shared/types/common.types';
import type { Transaction, TransactionQueryOptions } from '@/shared/types/transaction.types';
import { transactionStorage } from '@/services/storage/transaction.storage';
import { useSessionStore } from '@/app/stores/session.store';

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

type TransactionState = {
  transactions: Transaction[];
  nextCursor: UUID | null;
  totalCount: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  filters: TransactionQueryOptions;
  activeTransaction: Transaction | null;
  isPanelOpen: boolean;
  panelMode: 'view' | 'add' | 'edit' | 'csv';
};

type TransactionActions = {
  loadTransactions: (options: TransactionQueryOptions) => Promise<void>;
  loadMore: () => Promise<void>;
  setFilters: (filters: Partial<TransactionQueryOptions>) => void;
  clearFilters: () => void;
  openPanel: (mode: 'view' | 'add' | 'edit' | 'csv', transaction?: Transaction) => void;
  closePanel: () => void;
  setActiveTransaction: (tx: Transaction | null) => void;
  addTransactionToList: (tx: Transaction) => void;
  updateTransactionInList: (tx: Transaction) => void;
  removeTransactionFromList: (id: UUID) => void;
};

const DEFAULT_LIMIT = 30;

function getDefaultFilters(): TransactionQueryOptions {
  // userId will be overwritten on load; placeholder needed for type
  return {
    userId: '' as UUID,
    limit: DEFAULT_LIMIT,
    sortBy: 'date',
    sortOrder: 'desc',
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useTransactionStore = create<TransactionState & TransactionActions>((set, get) => ({
  transactions: [],
  nextCursor: null,
  totalCount: 0,
  isLoading: false,
  isLoadingMore: false,
  filters: getDefaultFilters(),
  activeTransaction: null,
  isPanelOpen: false,
  panelMode: 'view' as 'view' | 'add' | 'edit' | 'csv',

  async loadTransactions(options) {
    const { derivedKey } = useSessionStore.getState();
    if (!derivedKey) return;

    set({ isLoading: true });
    const optionsWithoutCursor: TransactionQueryOptions = { ...options, cursor: undefined };
    const result = await transactionStorage.listTransactionsByUser(
      options.userId,
      optionsWithoutCursor,
      derivedKey
    );
    set({ isLoading: false });

    if (result.success) {
      set({
        transactions: result.data.transactions,
        nextCursor: result.data.nextCursor,
        totalCount: result.data.totalCount,
        filters: optionsWithoutCursor,
      });
    }
  },

  async loadMore() {
    const { nextCursor, filters, transactions, isLoadingMore } = get();
    if (!nextCursor || isLoadingMore) return;
    const { derivedKey } = useSessionStore.getState();
    if (!derivedKey) return;

    set({ isLoadingMore: true });
    const result = await transactionStorage.listTransactionsByUser(
      filters.userId,
      { ...filters, cursor: nextCursor },
      derivedKey
    );
    set({ isLoadingMore: false });

    if (result.success) {
      set({
        transactions: [...transactions, ...result.data.transactions],
        nextCursor: result.data.nextCursor,
      });
    }
  },

  setFilters(partial) {
    const current = get().filters;
    const merged: TransactionQueryOptions = { ...current, ...partial, cursor: undefined };
    set({ filters: merged });
    void get().loadTransactions(merged);
  },

  clearFilters() {
    const { filters } = get();
    const reset = getDefaultFilters();
    reset.userId = filters.userId;
    set({ filters: reset });
    void get().loadTransactions(reset);
  },

  openPanel(mode, transaction) {
    set({
      isPanelOpen: true,
      panelMode: mode,
      activeTransaction: transaction ?? null,
    });
  },

  closePanel() {
    set({ isPanelOpen: false, activeTransaction: null });
  },

  setActiveTransaction(tx) {
    set({ activeTransaction: tx });
  },

  addTransactionToList(tx) {
    set((state) => ({
      transactions: [tx, ...state.transactions],
      totalCount: state.totalCount + 1,
    }));
  },

  updateTransactionInList(tx) {
    set((state) => ({
      transactions: state.transactions.map((t) => (t.id === tx.id ? tx : t)),
    }));
  },

  removeTransactionFromList(id) {
    set((state) => ({
      transactions: state.transactions.filter((t) => t.id !== id),
      totalCount: Math.max(0, state.totalCount - 1),
    }));
  },
}));

// ---------------------------------------------------------------------------
// Selectors (useShallow for all object-returning selectors)
// ---------------------------------------------------------------------------

export function useTransactions() {
  return useTransactionStore(
    useShallow((s) => ({
      transactions: s.transactions,
      isLoading: s.isLoading,
      isLoadingMore: s.isLoadingMore,
      totalCount: s.totalCount,
    }))
  );
}

export function useTransactionFilters() {
  return useTransactionStore(
    useShallow((s) => ({
      filters: s.filters,
      setFilters: s.setFilters,
      clearFilters: s.clearFilters,
    }))
  );
}

export function useTransactionPanel() {
  return useTransactionStore(
    useShallow((s) => ({
      isPanelOpen: s.isPanelOpen,
      panelMode: s.panelMode,
      activeTransaction: s.activeTransaction,
      openPanel: s.openPanel,
      closePanel: s.closePanel,
    }))
  );
}
