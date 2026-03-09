import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { UUID, ISODateString } from '@/shared/types/common.types';
import type { Transaction, TransactionQueryOptions } from '@/shared/types/transaction.types';
import { transactionStorage } from '@/services/storage/transaction.storage';
import { useSessionStore } from '@/app/stores/session.store';

// ---------------------------------------------------------------------------
// Bulk operation types
// ---------------------------------------------------------------------------

export type BulkOperationRecord = {
  type: 'edit' | 'delete' | 'categorize' | 'tag' | 'date-shift';
  affectedIds: UUID[];
  previousValues: Record<UUID, Partial<Transaction>>;
  description: string;
  performedAt: ISODateString;
};

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
  // Bulk selection
  isBulkMode: boolean;
  selectedTransactionIds: UUID[];
  lastBulkOperation: BulkOperationRecord | null;
  isBulkOperating: boolean;
  bulkOperationError: string | null;
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
  // Bulk actions
  enterBulkMode: () => void;
  exitBulkMode: () => void;
  toggleTransactionSelection: (id: UUID) => void;
  selectAllVisible: () => void;
  clearSelection: () => void;
  setBulkOperating: (value: boolean) => void;
  setBulkOperationError: (error: string | null) => void;
  applyBulkUpdates: (updates: Record<UUID, Partial<Transaction>>) => void;
  removeBulkDeleted: (ids: UUID[]) => void;
  setLastBulkOperation: (record: BulkOperationRecord | null) => void;
  undoLastBulkOperation: () => Promise<void>;
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

// Module-level timer for undo auto-dismiss (can't store in Zustand state)
let undoTimer: ReturnType<typeof setTimeout> | null = null;

function clearUndoTimer() {
  if (undoTimer !== null) {
    clearTimeout(undoTimer);
    undoTimer = null;
  }
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
  // Bulk selection
  isBulkMode: false,
  selectedTransactionIds: [],
  lastBulkOperation: null,
  isBulkOperating: false,
  bulkOperationError: null,

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

  // -------------------------------------------------------------------------
  // Bulk actions
  // -------------------------------------------------------------------------

  enterBulkMode() {
    set({ isBulkMode: true, selectedTransactionIds: [], bulkOperationError: null });
  },

  exitBulkMode() {
    clearUndoTimer();
    set({
      isBulkMode: false,
      selectedTransactionIds: [],
      lastBulkOperation: null,
      bulkOperationError: null,
    });
  },

  toggleTransactionSelection(id) {
    set((s) => {
      const exists = s.selectedTransactionIds.includes(id);
      return {
        selectedTransactionIds: exists
          ? s.selectedTransactionIds.filter((x) => x !== id)
          : [...s.selectedTransactionIds, id],
      };
    });
  },

  selectAllVisible() {
    const ids = get().transactions.map((t) => t.id);
    set({ selectedTransactionIds: ids });
  },

  clearSelection() {
    set({ selectedTransactionIds: [] });
  },

  setBulkOperating(value) {
    set({ isBulkOperating: value });
  },

  setBulkOperationError(error) {
    set({ bulkOperationError: error });
  },

  applyBulkUpdates(updates) {
    set((s) => ({
      transactions: s.transactions.map((t) => {
        const patch = updates[t.id as UUID];
        return patch ? { ...t, ...patch } : t;
      }),
    }));
  },

  removeBulkDeleted(ids) {
    const idSet = new Set(ids);
    set((s) => ({
      transactions: s.transactions.filter((t) => !idSet.has(t.id as UUID)),
      totalCount: Math.max(0, s.totalCount - ids.length),
    }));
  },

  setLastBulkOperation(record) {
    clearUndoTimer();
    set({ lastBulkOperation: record });
    if (record !== null) {
      undoTimer = setTimeout(() => {
        set({ lastBulkOperation: null });
        undoTimer = null;
      }, 30_000);
    }
  },

  async undoLastBulkOperation() {
    const { lastBulkOperation, filters } = get();
    if (!lastBulkOperation) return;
    const key = useSessionStore.getState().derivedKey;
    if (!key) return;

    clearUndoTimer();
    set({ isBulkOperating: true });

    try {
      const { type, previousValues } = lastBulkOperation;

      if (type === 'delete') {
        // Re-create each deleted transaction from snapshot
        for (const [, tx] of Object.entries(previousValues)) {
          const full = tx as Transaction;
          await transactionStorage.createTransaction(
            {
              userId: full.userId,
              accountId: full.accountId,
              type: full.type,
              amount: full.amount,
              currency: full.currency,
              categoryId: full.categoryId,
              date: full.date,
              notes: full.notes,
              isReconciled: full.isReconciled,
            },
            key
          );
        }
        // Full reload to restore list order
        await get().loadTransactions(filters);
      } else {
        // Restore previous field values via updateTransaction
        const restoredMap: Record<UUID, Partial<Transaction>> = {};
        for (const [id, prev] of Object.entries(previousValues)) {
          const result = await transactionStorage.updateTransaction(
            id as UUID,
            prev as Partial<Omit<Transaction, 'id' | 'createdAt'>>,
            key
          );
          if (result.success) {
            restoredMap[id as UUID] = result.data;
          }
        }
        get().applyBulkUpdates(restoredMap);
      }
    } finally {
      set({ isBulkOperating: false, lastBulkOperation: null });
    }
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

export function useBulkMode() {
  return useTransactionStore(
    useShallow((s) => ({
      isBulkMode: s.isBulkMode,
      selectedTransactionIds: s.selectedTransactionIds,
      enterBulkMode: s.enterBulkMode,
      exitBulkMode: s.exitBulkMode,
      toggleTransactionSelection: s.toggleTransactionSelection,
      selectAllVisible: s.selectAllVisible,
      clearSelection: s.clearSelection,
    }))
  );
}

export function useBulkOperation() {
  return useTransactionStore(
    useShallow((s) => ({
      isBulkOperating: s.isBulkOperating,
      bulkOperationError: s.bulkOperationError,
      lastBulkOperation: s.lastBulkOperation,
      undoLastBulkOperation: s.undoLastBulkOperation,
      setBulkOperating: s.setBulkOperating,
      setBulkOperationError: s.setBulkOperationError,
    }))
  );
}
