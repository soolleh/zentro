/**
 * milestone.store.ts
 *
 * Zustand store for net worth milestones and celebration state.
 */
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { UUID } from '@/shared/types/common.types';
import type {
  NetWorthMilestone,
  MilestoneThreshold,
  MilestoneProgress,
} from '@/shared/types/milestone.types';
import { milestoneStorage } from '@/services/storage/milestone.storage';
import {
  getProgressToNextMilestone,
  getNextMilestone,
} from '@/services/milestones/milestone.service';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type MilestoneState = {
  milestones: NetWorthMilestone[];
  unacknowledgedMilestones: NetWorthMilestone[];
  /** The milestone currently shown in the full-screen overlay (login flow). */
  pendingCelebration: NetWorthMilestone | null;
  isCelebrating: boolean;
  /** Toast queue for milestones detected during app use (transaction flow). */
  toastMilestones: NetWorthMilestone[];
  isHistoryOpen: boolean;
  nextMilestone: MilestoneThreshold | null;
  milestoneProgress: MilestoneProgress | null;
};

type MilestoneActions = {
  loadMilestones(userId: UUID): Promise<void>;
  triggerCelebration(milestone: NetWorthMilestone): void;
  acknowledgeCelebration(): Promise<void>;
  loadNextMilestone(userId: UUID, currentNetWorth: number): Promise<void>;
  openHistory(): void;
  closeHistory(): void;
  /** Add a milestone to the toast queue (transaction flow — during app use). */
  addMilestoneToast(milestone: NetWorthMilestone): void;
  /** Remove a milestone toast by ID after it has been dismissed. */
  dismissMilestoneToast(id: UUID): void;
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useMilestoneStore = create<MilestoneState & MilestoneActions>()((set, get) => ({
  milestones: [],
  unacknowledgedMilestones: [],
  pendingCelebration: null,
  isCelebrating: false,
  toastMilestones: [],
  isHistoryOpen: false,
  nextMilestone: null,
  milestoneProgress: null,

  async loadMilestones(userId) {
    const [allResult, unackedResult] = await Promise.all([
      milestoneStorage.listMilestonesByUser(userId),
      milestoneStorage.listUnacknowledgedMilestones(userId),
    ]);

    const milestones = allResult.success ? allResult.data : [];
    const unacknowledged = unackedResult.success ? unackedResult.data : [];

    set({
      milestones,
      unacknowledgedMilestones: unacknowledged,
      // Auto-set first unacknowledged as pending celebration
      pendingCelebration: unacknowledged.length > 0 ? (unacknowledged[0] ?? null) : null,
      isCelebrating: unacknowledged.length > 0,
    });
  },

  triggerCelebration(milestone) {
    set({
      pendingCelebration: milestone,
      isCelebrating: true,
    });
  },

  async acknowledgeCelebration() {
    const { pendingCelebration, unacknowledgedMilestones } = get();
    if (!pendingCelebration) return;

    // Mark as acknowledged in IDB
    await milestoneStorage.acknowledgeMilestone(pendingCelebration.id);

    // Update in-memory acknowledged state
    const updatedMilestones = get().milestones.map((m) =>
      m.id === pendingCelebration.id ? { ...m, acknowledged: true } : m
    );
    const remainingUnacked = unacknowledgedMilestones.filter((m) => m.id !== pendingCelebration.id);

    const nextPending = remainingUnacked.length > 0 ? (remainingUnacked[0] ?? null) : null;

    set({
      milestones: updatedMilestones,
      unacknowledgedMilestones: remainingUnacked,
      // Cycle to next unacknowledged after 300ms delay (caller manages timing)
      pendingCelebration: nextPending,
      isCelebrating: nextPending !== null,
    });
  },

  async loadNextMilestone(userId, currentNetWorth) {
    const [progressResult, nextResult] = await Promise.all([
      getProgressToNextMilestone(userId, currentNetWorth),
      getNextMilestone(userId, currentNetWorth),
    ]);

    set({
      milestoneProgress: progressResult.success ? progressResult.data : null,
      nextMilestone: nextResult.success ? nextResult.data : null,
    });
  },

  openHistory() {
    set({ isHistoryOpen: true });
  },

  closeHistory() {
    set({ isHistoryOpen: false });
  },

  addMilestoneToast(milestone) {
    // Add to toast queue if not already present
    set((state) => ({
      toastMilestones: state.toastMilestones.some((m) => m.id === milestone.id)
        ? state.toastMilestones
        : [...state.toastMilestones, milestone],
      milestones: state.milestones.some((m) => m.id === milestone.id)
        ? state.milestones
        : [milestone, ...state.milestones],
      unacknowledgedMilestones: state.unacknowledgedMilestones.some((m) => m.id === milestone.id)
        ? state.unacknowledgedMilestones
        : [...state.unacknowledgedMilestones, milestone],
    }));
  },

  dismissMilestoneToast(id) {
    set((state) => ({
      toastMilestones: state.toastMilestones.filter((m) => m.id !== id),
    }));
  },
}));

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function useMilestones() {
  return useMilestoneStore(
    useShallow((s) => ({
      milestones: s.milestones,
      unacknowledgedMilestones: s.unacknowledgedMilestones,
    }))
  );
}

export function useCelebration() {
  const pendingCelebration = useMilestoneStore((s) => s.pendingCelebration);
  const isCelebrating = useMilestoneStore((s) => s.isCelebrating);
  const acknowledgeCelebration = useMilestoneStore((s) => s.acknowledgeCelebration);
  return { pendingCelebration, isCelebrating, acknowledgeCelebration };
}

export function useMilestoneProgress() {
  return useMilestoneStore(
    useShallow((s) => ({
      nextMilestone: s.nextMilestone,
      milestoneProgress: s.milestoneProgress,
    }))
  );
}

export function useToastMilestones() {
  return useMilestoneStore(
    useShallow((s) => ({
      toastMilestones: s.toastMilestones,
      dismissMilestoneToast: s.dismissMilestoneToast,
      triggerCelebration: s.triggerCelebration,
    }))
  );
}
