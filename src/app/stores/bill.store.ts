/**
 * bill.store.ts
 *
 * Zustand store for the Bills & Recurring module.
 */

import { create } from 'zustand';
import type { UUID, ISODateString } from '@/shared/types/common.types';
import type {
  Bill,
  BillsSummary,
  EnrichedBillEntry,
  CreateBillInput,
  UpdateBillInput,
  PayBillParams,
  SnoozeParams,
} from '@/shared/types/bill.types';
import {
  createBill,
  updateBill,
  deleteBill,
  getBillsByUser,
  payBill,
  snoozeBill,
  skipBill,
  undoPayBill,
  bulkPayBills,
  getBillsSummary,
  getMonthEntriesEnriched,
} from '@/services/bills/bill.service';
import { useSessionStore } from '@/app/stores/session.store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BillState = {
  readonly bills: Bill[];
  readonly entries: EnrichedBillEntry[];
  readonly summary: BillsSummary | null;
  readonly monthOffset: number;
  readonly isLoading: boolean;
  readonly error: string | null;
  // Bulk mode
  readonly isBulkMode: boolean;
  readonly selectedEntryIds: UUID[];
  // Bill form
  readonly isFormOpen: boolean;
  readonly editingBill: Bill | null;
  // Quick pay sheet
  readonly isQuickPayOpen: boolean;
  readonly quickPayEntry: EnrichedBillEntry | null;
  // Snooze picker
  readonly isSnoozeOpen: boolean;
  readonly activeSnoozeEntry: EnrichedBillEntry | null;
};

type BillActions = {
  // Data loading
  loadBills: (userId: UUID) => Promise<void>;
  loadEntries: (userId: UUID) => Promise<void>;
  loadSummary: (userId: UUID) => Promise<void>;
  // Bill CRUD
  addBill: (userId: UUID, input: CreateBillInput) => Promise<void>;
  editBill: (id: UUID, updates: UpdateBillInput) => Promise<void>;
  removeBill: (id: UUID, userId: UUID) => Promise<void>;
  // Entry actions
  payEntry: (params: PayBillParams, entry: EnrichedBillEntry, userId: UUID) => Promise<void>;
  snoozeEntry: (params: SnoozeParams) => Promise<void>;
  skipEntry: (entryId: UUID) => Promise<void>;
  undoPayEntry: (entryId: UUID) => Promise<void>;
  // Bulk
  bulkPaySelected: (userId: UUID, paidDate: ISODateString) => Promise<void>;
  toggleBulkMode: () => void;
  toggleEntrySelection: (id: UUID) => void;
  selectAllPending: () => void;
  clearSelection: () => void;
  // Month navigation
  setMonthOffset: (offset: number) => void;
  // UI panels
  openForm: (bill?: Bill) => void;
  closeForm: () => void;
  openQuickPay: (entry: EnrichedBillEntry) => void;
  closeQuickPay: () => void;
  openSnooze: (entry: EnrichedBillEntry) => void;
  closeSnooze: () => void;
  // Reset
  reset: () => void;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULTS: BillState = {
  bills: [],
  entries: [],
  summary: null,
  monthOffset: 0,
  isLoading: false,
  error: null,
  isBulkMode: false,
  selectedEntryIds: [],
  isFormOpen: false,
  editingBill: null,
  isQuickPayOpen: false,
  quickPayEntry: null,
  isSnoozeOpen: false,
  activeSnoozeEntry: null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useBillStore = create<BillState & BillActions>((set, get) => ({
  ...DEFAULTS,

  async loadBills(userId) {
    const key = useSessionStore.getState().derivedKey;
    if (!key) return;
    set({ isLoading: true, error: null });
    const result = await getBillsByUser(userId, key);
    if (result.success) {
      set({ bills: result.data, isLoading: false });
    } else {
      set({ isLoading: false, error: result.error.message });
    }
  },

  async loadEntries(userId) {
    const key = useSessionStore.getState().derivedKey;
    if (!key) return;
    const { monthOffset } = get();
    set({ isLoading: true, error: null });
    const result = await getMonthEntriesEnriched(userId, key, monthOffset);
    if (result.success) {
      set({ entries: result.data, isLoading: false });
    } else {
      set({ isLoading: false, error: result.error.message });
    }
  },

  async loadSummary(userId) {
    const key = useSessionStore.getState().derivedKey;
    if (!key) return;
    const result = await getBillsSummary(userId, key);
    if (result.success) {
      set({ summary: result.data });
    }
  },

  async addBill(userId, input) {
    const key = useSessionStore.getState().derivedKey;
    if (!key) return;
    const result = await createBill({ ...input, userId }, key);
    if (!result.success) {
      set({ error: result.error.message });
      return;
    }
    set((s) => ({ bills: [...s.bills, result.data] }));
    await get().loadEntries(userId);
    await get().loadSummary(userId);
  },

  async editBill(id, updates) {
    const key = useSessionStore.getState().derivedKey;
    if (!key) return;
    const result = await updateBill(id, updates, key);
    if (!result.success) {
      set({ error: result.error.message });
      return;
    }
    set((s) => ({
      bills: s.bills.map((b) => (b.id === id ? result.data : b)),
    }));
  },

  async removeBill(id, userId) {
    const key = useSessionStore.getState().derivedKey;
    if (!key) return;
    const result = await deleteBill(id, key);
    if (!result.success) {
      set({ error: result.error.message });
      return;
    }
    set((s) => ({
      bills: s.bills.filter((b) => b.id !== id),
      entries: s.entries.filter((e) => e.billId !== id),
    }));
    await get().loadSummary(userId);
  },

  async payEntry(params, entry, userId) {
    const key = useSessionStore.getState().derivedKey;
    if (!key) return;
    const result = await payBill(params, entry.bill, userId, key);
    if (!result.success) {
      set({ error: result.error.message });
      return;
    }
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === entry.id ? { ...result.data, bill: entry.bill } : e
      ),
      isQuickPayOpen: false,
      quickPayEntry: null,
    }));
    await get().loadSummary(userId);
  },

  async snoozeEntry(params) {
    const key = useSessionStore.getState().derivedKey;
    if (!key) return;
    const result = await snoozeBill(params, key);
    if (!result.success) {
      set({ error: result.error.message });
      return;
    }
    set((s) => ({
      entries: s.entries.map((e) => {
        if (e.id !== params.entryId) return e;
        return { ...result.data, bill: e.bill };
      }),
      isSnoozeOpen: false,
      activeSnoozeEntry: null,
    }));
  },

  async skipEntry(entryId) {
    const key = useSessionStore.getState().derivedKey;
    if (!key) return;
    const result = await skipBill(entryId, key);
    if (!result.success) {
      set({ error: result.error.message });
      return;
    }
    set((s) => ({
      entries: s.entries.map((e) => {
        if (e.id !== entryId) return e;
        return { ...result.data, bill: e.bill };
      }),
    }));
  },

  async undoPayEntry(entryId) {
    const key = useSessionStore.getState().derivedKey;
    if (!key) return;
    const result = await undoPayBill(entryId, key);
    if (!result.success) {
      set({ error: result.error.message });
      return;
    }
    set((s) => ({
      entries: s.entries.map((e) => {
        if (e.id !== entryId) return e;
        return { ...result.data, bill: e.bill };
      }),
    }));
  },

  async bulkPaySelected(userId, paidDate) {
    const key = useSessionStore.getState().derivedKey;
    if (!key) return;
    const { selectedEntryIds, entries } = get();
    const selected = entries.filter((e) => selectedEntryIds.includes(e.id) && e.status !== 'paid');
    if (selected.length === 0) return;
    const billMap = new Map(selected.map((e) => [e.billId, e.bill]));
    const result = await bulkPayBills(selected, billMap, userId, paidDate, key);
    if (!result.success) {
      set({ error: result.error.message });
      return;
    }
    const updatedMap = new Map(result.data.map((e) => [e.id, e]));
    set((s) => ({
      entries: s.entries.map((e) => {
        const updated = updatedMap.get(e.id);
        if (!updated) return e;
        return { ...updated, bill: e.bill };
      }),
      isBulkMode: false,
      selectedEntryIds: [],
    }));
    await get().loadSummary(userId);
  },

  toggleBulkMode() {
    set((s) => ({
      isBulkMode: !s.isBulkMode,
      selectedEntryIds: [],
    }));
  },

  toggleEntrySelection(id) {
    set((s) => {
      const exists = s.selectedEntryIds.includes(id);
      return {
        selectedEntryIds: exists
          ? s.selectedEntryIds.filter((i) => i !== id)
          : [...s.selectedEntryIds, id],
      };
    });
  },

  selectAllPending() {
    set((s) => ({
      selectedEntryIds: s.entries
        .filter((e) => e.status === 'pending' || e.status === 'snoozed')
        .map((e) => e.id),
    }));
  },

  clearSelection() {
    set({ selectedEntryIds: [] });
  },

  setMonthOffset(offset) {
    set({ monthOffset: offset });
  },

  openForm(bill) {
    set({ isFormOpen: true, editingBill: bill ?? null });
  },

  closeForm() {
    set({ isFormOpen: false, editingBill: null });
  },

  openQuickPay(entry) {
    set({ isQuickPayOpen: true, quickPayEntry: entry });
  },

  closeQuickPay() {
    set({ isQuickPayOpen: false, quickPayEntry: null });
  },

  openSnooze(entry) {
    set({ isSnoozeOpen: true, activeSnoozeEntry: entry });
  },

  closeSnooze() {
    set({ isSnoozeOpen: false, activeSnoozeEntry: null });
  },

  reset() {
    set(DEFAULTS);
  },
}));
