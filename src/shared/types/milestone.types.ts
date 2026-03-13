/**
 * milestone.types.ts
 *
 * Type definitions for the net worth milestone / gamification system.
 * Uses the 16-milestone INR config from milestone-config.ts.
 */
import type { UUID, ISODateString } from '@/shared/types/common.types';

// ---------------------------------------------------------------------------
// Primary type — new gamification system
// ---------------------------------------------------------------------------

/**
 * An achieved milestone record stored in IndexedDB (achieved_milestones store).
 * Not encrypted — threshold constants are public; dates/amounts are non-sensitive.
 */
export type AchievedMilestone = {
  readonly id: UUID;
  readonly userId: UUID;
  /** References MILESTONE_CONFIG[].id (1–16) */
  readonly milestoneId: number;
  readonly achievedAt: ISODateString;
  /** Actual net worth at the moment the threshold was crossed */
  readonly netWorthAtAchievement: number;
  /** Whether the user has dismissed the celebration overlay for this milestone */
  acknowledged: boolean;
};

// ---------------------------------------------------------------------------
// Legacy types — retained for backward compatibility with net_worth_milestones
// IDB store. New code must NOT use these types.
// ---------------------------------------------------------------------------

/** @deprecated Use AchievedMilestone instead */
export type MilestoneType = 'net_worth' | 'savings' | 'debt_free';

/** @deprecated Use BadgeLevel from milestone-config.ts instead */
export type MilestoneTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

/** @deprecated Use AchievedMilestone instead */
export type NetWorthMilestone = {
  readonly id: UUID;
  readonly userId: UUID;
  readonly type: MilestoneType;
  readonly threshold: number;
  readonly label: string;
  readonly emoji: string;
  readonly tier: MilestoneTier;
  readonly achievedAt: ISODateString;
  readonly netWorthAtAchievement: number;
  acknowledged: boolean;
};

/** @deprecated */
export type MilestoneThreshold = {
  readonly value: number;
  readonly label: string;
  readonly emoji: string;
  readonly tier: MilestoneTier;
};

/** @deprecated */
export type MilestoneProgress = {
  readonly current: number;
  readonly next: MilestoneThreshold;
  readonly previous: MilestoneThreshold | null;
  readonly progressPercent: number;
  readonly amountRemaining: number;
};
