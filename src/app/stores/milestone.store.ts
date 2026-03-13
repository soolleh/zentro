/**
 * milestone.store.ts
 *
 * Zustand store for the net worth milestone gamification system.
 * Manages the celebration queue, trophy room, and journey timeline state.
 */
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { UUID } from '@/shared/types/common.types';
import type { AchievedMilestone } from '@/shared/types/milestone.types';
import { milestoneStorage } from '@/services/storage/milestone.storage';
import { getMilestoneProgress, type MilestoneProgressData } from '@/services/milestones/milestone-config';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

type MilestoneState = {
  /** All achieved milestones for the current user */
  achieved: AchievedMilestone[];
  /** Milestones the user has not yet seen the celebration for */
  unacknowledged: AchievedMilestone[];
  /** Queue of milestones to celebrate (processed one at a time) */
  celebrationQueue: AchievedMilestone[];
  /** The milestone currently shown in the overlay */
  activeCelebration: AchievedMilestone | null;
  isCelebrating: boolean;
  isTrophyRoomOpen: boolean;
  isJourneyOpen: boolean;
};

type MilestoneActions = {
  loadMilestones(userId: UUID): Promise<void>;
  /**
   * Add new milestones to the celebration queue.
   * Automatically starts celebrating the first item if not already celebrating.
   */
  pushNewAchievements(items: AchievedMilestone[]): void;
  /**
   * Acknowledge the current celebration and advance to the next in queue.
   */
  advanceCelebration(): Promise<void>;
  /**
   * Acknowledge all queued celebrations at once.
   */
  skipAllCelebrations(userId: UUID): Promise<void>;
  openTrophyRoom(): void;
  closeTrophyRoom(): void;
  openJourney(): void;
  closeJourney(): void;
  /** @deprecated Use pushNewAchievements instead */
  addMilestoneToast(milestone: AchievedMilestone): void;
  /** @deprecated No-op — dismiss is handled by advanceCelebration */
  dismissMilestoneToast(id: UUID): void;
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useMilestoneStore = create<MilestoneState & MilestoneActions>()(
  (set, get) => ({
    achieved: [],
    unacknowledged: [],
    celebrationQueue: [],
    activeCelebration: null,
    isCelebrating: false,
    isTrophyRoomOpen: false,
    isJourneyOpen: false,

    async loadMilestones(userId) {
      const [allResult, unackedResult] = await Promise.all([
        milestoneStorage.listAchievedByUser(userId),
        milestoneStorage.listUnacknowledged(userId),
      ]);

      const achieved = allResult.success ? allResult.data : [];
      const unacknowledged = unackedResult.success ? unackedResult.data : [];

      set({
        achieved,
        unacknowledged,
        // Prime the celebration queue with any unacknowledged items from a
        // previous session (e.g. milestone reached while offline)
        celebrationQueue: unacknowledged,
        activeCelebration: unacknowledged.length > 0 ? (unacknowledged[0] ?? null) : null,
        isCelebrating: unacknowledged.length > 0,
      });
    },

    pushNewAchievements(items) {
      set((state) => {
        const newQueue = [
          ...state.celebrationQueue,
          ...items.filter(
            (m) => !state.celebrationQueue.some((q) => q.id === m.id)
          ),
        ];
        const isAlreadyCelebrating = state.isCelebrating;
        return {
          celebrationQueue: newQueue,
          achieved: [
            ...state.achieved,
            ...items.filter((m) => !state.achieved.some((a) => a.id === m.id)),
          ],
          unacknowledged: [
            ...state.unacknowledged,
            ...items.filter(
              (m) => !state.unacknowledged.some((u) => u.id === m.id)
            ),
          ],
          activeCelebration:
            isAlreadyCelebrating
              ? state.activeCelebration
              : (newQueue[0] ?? null),
          isCelebrating: newQueue.length > 0,
        };
      });
    },

    async advanceCelebration() {
      const { activeCelebration, celebrationQueue } = get();
      if (!activeCelebration) return;

      // Acknowledge current in IDB
      await milestoneStorage.acknowledge(activeCelebration.id);

      // Update in-memory acknowledged state
      const updatedAchieved = get().achieved.map((m) =>
        m.id === activeCelebration.id ? { ...m, acknowledged: true } : m
      );
      const remainingQueue = celebrationQueue.filter(
        (m) => m.id !== activeCelebration.id
      );
      const remainingUnacked = get().unacknowledged.filter(
        (m) => m.id !== activeCelebration.id
      );
      const nextCelebration = remainingQueue.length > 0 ? (remainingQueue[0] ?? null) : null;

      set({
        achieved: updatedAchieved,
        unacknowledged: remainingUnacked,
        celebrationQueue: remainingQueue,
        activeCelebration: nextCelebration,
        isCelebrating: nextCelebration !== null,
      });
    },

    async skipAllCelebrations(userId) {
      await milestoneStorage.acknowledgeAll(userId);
      const updatedAchieved = get().achieved.map((m) => ({
        ...m,
        acknowledged: true,
      }));
      set({
        achieved: updatedAchieved,
        unacknowledged: [],
        celebrationQueue: [],
        activeCelebration: null,
        isCelebrating: false,
      });
    },

    openTrophyRoom() {
      set({ isTrophyRoomOpen: true });
    },
    closeTrophyRoom() {
      set({ isTrophyRoomOpen: false });
    },
    openJourney() {
      set({ isJourneyOpen: true });
    },
    closeJourney() {
      set({ isJourneyOpen: false });
    },

    // Backward compat aliases
    addMilestoneToast(milestone) {
      get().pushNewAchievements([milestone]);
    },
    dismissMilestoneToast(_id) {
      // No-op — dismissal handled by advanceCelebration
    },
  })
);

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/**
 * Celebration state — used by MilestoneCelebrationOverlay and AppLayout.
 * Returns pendingCelebration as alias for activeCelebration for compat.
 */
export function useCelebration() {
  const activeCelebration = useMilestoneStore((s) => s.activeCelebration);
  const isCelebrating = useMilestoneStore((s) => s.isCelebrating);
  const celebrationQueue = useMilestoneStore((s) => s.celebrationQueue);
  const advanceCelebration = useMilestoneStore((s) => s.advanceCelebration);
  const skipAllCelebrations = useMilestoneStore((s) => s.skipAllCelebrations);

  return {
    // pendingCelebration is an alias for activeCelebration (AppLayout compat)
    pendingCelebration: activeCelebration,
    activeCelebration,
    isCelebrating,
    celebrationQueue,
    acknowledgeCelebration: advanceCelebration,
    advanceCelebration,
    skipAllCelebrations,
  };
}

/**
 * Computed live progress — pure calculation, no IDB.
 */
export function useMilestoneProgress(currentNetWorth: number): MilestoneProgressData {
  return getMilestoneProgress(currentNetWorth);
}

/**
 * Achievement data for trophy room and journey timeline.
 */
export function useMilestones() {
  return useMilestoneStore(
    useShallow((s) => ({
      achieved: s.achieved,
      unacknowledged: s.unacknowledged,
      // Legacy alias
      milestones: s.achieved,
      unacknowledgedMilestones: s.unacknowledged,
    }))
  );
}

export function useTrophyRoom() {
  return useMilestoneStore(
    useShallow((s) => ({
      isTrophyRoomOpen: s.isTrophyRoomOpen,
      openTrophyRoom: s.openTrophyRoom,
      closeTrophyRoom: s.closeTrophyRoom,
    }))
  );
}

export function useJourney() {
  return useMilestoneStore(
    useShallow((s) => ({
      isJourneyOpen: s.isJourneyOpen,
      openJourney: s.openJourney,
      closeJourney: s.closeJourney,
    }))
  );
}

/** @deprecated Use useCelebration instead */
export function useToastMilestones() {
  return {
    toastMilestones: [] as AchievedMilestone[],
    dismissMilestoneToast: (_id: UUID) => undefined,
    triggerCelebration: (_m: AchievedMilestone) => undefined,
  };
}
