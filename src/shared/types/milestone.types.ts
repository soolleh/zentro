/**
 * milestone.types.ts
 *
 * Type definitions for the net worth milestone / celebration system.
 */
import type { UUID, ISODateString } from '@/shared/types/common.types';

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export type MilestoneType = 'net_worth' | 'savings' | 'debt_free';

export type MilestoneTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export type NetWorthMilestone = {
  readonly id: UUID;
  readonly userId: UUID;
  readonly type: MilestoneType;
  /** The threshold value that was crossed */
  readonly threshold: number;
  readonly label: string;
  readonly emoji: string;
  readonly tier: MilestoneTier;
  readonly achievedAt: ISODateString;
  /** Actual net worth at the moment of achievement */
  readonly netWorthAtAchievement: number;
  /** Whether the user has seen the celebration overlay */
  acknowledged: boolean;
};

/** A configured threshold definition in the constants list */
export type MilestoneThreshold = {
  readonly value: number;
  readonly label: string;
  readonly emoji: string;
  readonly tier: MilestoneTier;
};

/** Progress toward the next unachieved milestone */
export type MilestoneProgress = {
  readonly current: number;
  readonly next: MilestoneThreshold;
  readonly previous: MilestoneThreshold | null;
  readonly progressPercent: number;
  readonly amountRemaining: number;
};
