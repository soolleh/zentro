/**
 * milestone-thresholds.ts
 *
 * All milestone threshold definitions. These are public constants —
 * no sensitive data. Used by the milestone service for evaluation.
 */
import type { MilestoneThreshold } from '@/shared/types/milestone.types';

export const NET_WORTH_THRESHOLDS: MilestoneThreshold[] = [
  { value: 1_000, label: 'Net worth: $1K', emoji: '🌱', tier: 'bronze' },
  { value: 5_000, label: 'Net worth: $5K', emoji: '🌿', tier: 'bronze' },
  { value: 10_000, label: 'Net worth: $10K', emoji: '💪', tier: 'silver' },
  { value: 25_000, label: 'Net worth: $25K', emoji: '🔥', tier: 'silver' },
  { value: 50_000, label: 'Net worth: $50K', emoji: '⭐', tier: 'gold' },
  { value: 100_000, label: 'Net worth: $100K', emoji: '💎', tier: 'gold' },
  { value: 250_000, label: 'Net worth: $250K', emoji: '🚀', tier: 'platinum' },
  { value: 500_000, label: 'Net worth: $500K', emoji: '👑', tier: 'platinum' },
  { value: 1_000_000, label: 'Net worth: $1M', emoji: '🏆', tier: 'diamond' },
  { value: 5_000_000, label: 'Net worth: $5M', emoji: '💫', tier: 'diamond' },
  { value: 10_000_000, label: 'Net worth: $10M', emoji: '🌟', tier: 'diamond' },
];

export const SAVINGS_THRESHOLDS: MilestoneThreshold[] = [
  { value: 10, label: 'Saving 10% of income', emoji: '💰', tier: 'bronze' },
  { value: 20, label: 'Saving 20% of income', emoji: '💸', tier: 'silver' },
  { value: 30, label: 'Saving 30% of income', emoji: '🏦', tier: 'gold' },
  { value: 50, label: 'Saving 50% of income', emoji: '🎯', tier: 'diamond' },
];

export const DEBT_FREE_THRESHOLD: MilestoneThreshold = {
  value: 0,
  label: 'Debt free!',
  emoji: '🎊',
  tier: 'gold',
};
