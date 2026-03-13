/**
 * milestone-config.ts
 *
 * 16 net worth milestones across 3 stages.
 * All amounts are in Indian Rupees (INR).
 * This is the single source of truth for all milestone metadata.
 * Never fetched from IDB — purely compile-time constants.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MilestoneStage = 'beginner' | 'growth' | 'advanced';

export type BadgeLevel = 1 | 2 | 3 | 4 | 5;

export interface MilestoneConfig {
  id: number; // 1–16
  stage: MilestoneStage;
  badgeLevel: BadgeLevel;
  threshold: number; // INR
  name: string;
  emoji: string;
  badgeTheme: string;
  tagline: string;
  celebrationMessage: string;
  nextHint: string;
}

// ---------------------------------------------------------------------------
// 16 Milestone definitions
// ---------------------------------------------------------------------------

export const MILESTONE_CONFIG: MilestoneConfig[] = [
  // ─── BEGINNER STAGE ───────────────────────────────────────
  {
    id: 1,
    stage: 'beginner',
    badgeLevel: 1,
    threshold: 0,
    name: 'Getting Started',
    emoji: '🌱',
    badgeTheme: 'Seed',
    tagline: 'Your journey begins.',
    celebrationMessage: 'Every great fortune starts with a single rupee.',
    nextHint: 'Grow your first ₹10,000 →',
  },
  {
    id: 2,
    stage: 'beginner',
    badgeLevel: 1,
    threshold: 10_000,
    name: 'First Savings',
    emoji: '🐷',
    badgeTheme: 'Piggy Bank',
    tagline: 'You saved your first ₹10K.',
    celebrationMessage: 'The piggy bank is getting heavier!',
    nextHint: 'Push to ₹50,000 →',
  },
  {
    id: 3,
    stage: 'beginner',
    badgeLevel: 1,
    threshold: 50_000,
    name: 'Saver',
    emoji: '💼',
    badgeTheme: 'Wallet',
    tagline: "Half a lakh. That's serious.",
    celebrationMessage: "You're building real financial discipline.",
    nextHint: 'One lakh is next →',
  },
  {
    id: 4,
    stage: 'beginner',
    badgeLevel: 1,
    threshold: 100_000, // ₹1 Lakh
    name: 'Money Builder',
    emoji: '🧱',
    badgeTheme: 'Brick',
    tagline: 'The first lakh is always the hardest.',
    celebrationMessage: 'One lakh unlocked. The foundation is set.',
    nextHint: '₹2.5 Lakh awaits →',
  },
  {
    id: 5,
    stage: 'beginner',
    badgeLevel: 1,
    threshold: 250_000, // ₹2.5 Lakh
    name: 'Wealth Starter',
    emoji: '🌿',
    badgeTheme: 'Plant',
    tagline: 'Your wealth is growing roots.',
    celebrationMessage: "You're in the top 20% of Indian savers.",
    nextHint: '₹5 Lakh is close →',
  },
  {
    id: 6,
    stage: 'beginner',
    badgeLevel: 2,
    threshold: 500_000, // ₹5 Lakh
    name: 'Rising Saver',
    emoji: '📈',
    badgeTheme: 'Growth Arrow',
    tagline: 'Five lakhs. The chart is pointing up.',
    celebrationMessage: "You've crossed the threshold most never reach.",
    nextHint: 'Ten lakhs — the next level →',
  },

  // ─── GROWTH STAGE ─────────────────────────────────────────
  {
    id: 7,
    stage: 'growth',
    badgeLevel: 2,
    threshold: 1_000_000, // ₹10 Lakh
    name: 'Wealth Builder',
    emoji: '🔨',
    badgeTheme: 'Hammer',
    tagline: "You're building something real.",
    celebrationMessage: "Ten lakhs. You're officially in wealth-building territory.",
    nextHint: '₹25 Lakh — Strong Foundation →',
  },
  {
    id: 8,
    stage: 'growth',
    badgeLevel: 2,
    threshold: 2_500_000, // ₹25 Lakh
    name: 'Strong Foundation',
    emoji: '🏢',
    badgeTheme: 'Building',
    tagline: 'The structure is solid.',
    celebrationMessage: 'Twenty-five lakhs. Most people only dream of this.',
    nextHint: 'Half a crore is within reach →',
  },
  {
    id: 9,
    stage: 'growth',
    badgeLevel: 3,
    threshold: 5_000_000, // ₹50 Lakh
    name: 'Half Million Club',
    emoji: '🛡️',
    badgeTheme: 'Shield',
    tagline: 'Fifty lakhs. You are protected.',
    celebrationMessage: 'Fifty lakhs is a fortress. You built it.',
    nextHint: '₹75 Lakh — keep going →',
  },
  {
    id: 10,
    stage: 'growth',
    badgeLevel: 3,
    threshold: 7_500_000, // ₹75 Lakh
    name: 'Serious Investor',
    emoji: '📊',
    badgeTheme: 'Chart',
    tagline: "The charts agree: you're serious.",
    celebrationMessage: 'Seventy-five lakhs. One crore is in sight.',
    nextHint: 'The crore milestone awaits →',
  },
  {
    id: 11,
    stage: 'growth',
    badgeLevel: 3,
    threshold: 10_000_000, // ₹1 Crore
    name: 'Crorepati',
    emoji: '👑',
    badgeTheme: 'Crown',
    tagline: 'You are a Crorepati.',
    celebrationMessage: 'ONE CRORE. A milestone fewer than 1% of Indians ever reach.',
    nextHint: 'Two crore — the next empire →',
  },

  // ─── ADVANCED STAGE ───────────────────────────────────────
  {
    id: 12,
    stage: 'advanced',
    badgeLevel: 3,
    threshold: 20_000_000, // ₹2 Crore
    name: 'Wealth Master',
    emoji: '💎',
    badgeTheme: 'Diamond',
    tagline: "Diamond tier. You've mastered wealth.",
    celebrationMessage: 'Two crore. You are in elite financial territory.',
    nextHint: 'Five crore — Elite Investor →',
  },
  {
    id: 13,
    stage: 'advanced',
    badgeLevel: 4,
    threshold: 50_000_000, // ₹5 Crore
    name: 'Elite Investor',
    emoji: '🏆',
    badgeTheme: 'Trophy',
    tagline: 'Five crore. The trophy is yours.',
    celebrationMessage: "You've entered the top 0.1% of wealth in India.",
    nextHint: '₹10 Crore — Tycoon status →',
  },
  {
    id: 14,
    stage: 'advanced',
    badgeLevel: 4,
    threshold: 100_000_000, // ₹10 Crore
    name: 'Tycoon',
    emoji: '🏰',
    badgeTheme: 'Castle',
    tagline: 'Ten crore. You built a castle.',
    celebrationMessage: 'Tycoon. The word fits.',
    nextHint: '₹25 Crore — Ultra Rich →',
  },
  {
    id: 15,
    stage: 'advanced',
    badgeLevel: 5,
    threshold: 250_000_000, // ₹25 Crore
    name: 'Ultra Rich',
    emoji: '🟨',
    badgeTheme: 'Gold Bar',
    tagline: 'Twenty-five crore. Legendary.',
    celebrationMessage: 'You have built generational wealth.',
    nextHint: 'One final milestone remains →',
  },
  {
    id: 16,
    stage: 'advanced',
    badgeLevel: 5,
    threshold: 500_000_000, // ₹50 Crore
    name: 'Financial Legend',
    emoji: '⭐',
    badgeTheme: 'Star',
    tagline: 'Fifty crore. The legend is complete.',
    celebrationMessage: 'You have achieved what almost no one does. You are a Financial Legend.',
    nextHint: 'You have reached the pinnacle. 🌟',
  },
];

// ---------------------------------------------------------------------------
// Badge level styles
// ---------------------------------------------------------------------------

export interface BadgeLevelStyle {
  level: BadgeLevel;
  label: string;
  containerClass: string;
  textClass: string;
  glowClass: string; // CSS box-shadow value
  borderClass: string;
  backgroundStyle: string; // inline style gradient
}

export const BADGE_LEVEL_STYLES: Record<BadgeLevel, BadgeLevelStyle> = {
  1: {
    level: 1,
    label: 'Simple',
    containerClass: 'bg-muted/60 border border-border',
    textClass: 'text-muted-foreground',
    glowClass: 'none',
    borderClass: 'border-border',
    backgroundStyle: '',
  },
  2: {
    level: 2,
    label: 'Colored',
    containerClass: 'border-2',
    textClass: 'text-foreground',
    glowClass: '0 0 8px rgba(99,102,241,0.4)',
    borderClass: 'border-indigo-400',
    backgroundStyle: 'background: linear-gradient(135deg, #eef2ff, #e0e7ff)',
  },
  3: {
    level: 3,
    label: 'Metallic',
    containerClass: 'border-2',
    textClass: 'text-gray-800',
    glowClass: '0 0 16px rgba(192,192,192,0.6)',
    borderClass: 'border-slate-400',
    backgroundStyle: 'background: linear-gradient(135deg, #f8fafc, #cbd5e1, #94a3b8, #e2e8f0)',
  },
  4: {
    level: 4,
    label: 'Gold',
    containerClass: 'border-2',
    textClass: 'text-amber-900',
    glowClass: '0 0 24px rgba(251,191,36,0.7)',
    borderClass: 'border-amber-400',
    backgroundStyle: 'background: linear-gradient(135deg, #fef3c7, #fcd34d, #f59e0b, #fde68a)',
  },
  5: {
    level: 5,
    label: 'Legendary',
    containerClass: 'border-2',
    textClass: 'text-white',
    glowClass: '0 0 32px rgba(167,139,250,0.9), 0 0 64px rgba(251,191,36,0.4)',
    borderClass: 'border-purple-400',
    backgroundStyle: `background: linear-gradient(135deg,
      #1e1b4b, #312e81, #4c1d95, #5b21b6, #6d28d9,
      #7c3aed, #8b5cf6, #a78bfa)`,
  },
};

// ---------------------------------------------------------------------------
// Progress data
// ---------------------------------------------------------------------------

export interface MilestoneProgressData {
  current: MilestoneConfig;
  next: MilestoneConfig | null;
  progressPercent: number; // 0–100
  amountAchieved: number; // netWorth - current.threshold
  amountRemaining: number; // next.threshold - netWorth (0 if at max)
  isMaxMilestone: boolean;
}

// ---------------------------------------------------------------------------
// Helper functions (pure — no IDB, no React)
// ---------------------------------------------------------------------------

export function getMilestoneById(id: number): MilestoneConfig {
  const found = MILESTONE_CONFIG.find((m) => m.id === id);
  if (!found) {
    // Fallback to first milestone if id is out of range
    return MILESTONE_CONFIG[0];
  }
  return found;
}

/**
 * Returns the highest milestone where threshold <= netWorth.
 * Always returns at least the first milestone (threshold = 0).
 */
export function getCurrentMilestone(netWorth: number): MilestoneConfig {
  let current = MILESTONE_CONFIG[0];
  for (const m of MILESTONE_CONFIG) {
    if (m.threshold <= netWorth) {
      current = m;
    }
  }
  return current;
}

/**
 * Returns the next milestone above netWorth, or null if at the maximum.
 */
export function getNextMilestone(netWorth: number): MilestoneConfig | null {
  return MILESTONE_CONFIG.find((m) => m.threshold > netWorth) ?? null;
}

/**
 * Computes full progress data for a given net worth.
 */
export function getMilestoneProgress(netWorth: number): MilestoneProgressData {
  const current = getCurrentMilestone(netWorth);
  const next = getNextMilestone(netWorth);

  const amountAchieved = netWorth - current.threshold;
  const amountRemaining = next ? next.threshold - netWorth : 0;

  let progressPercent = 0;
  if (next) {
    const range = next.threshold - current.threshold;
    progressPercent = range > 0 ? (amountAchieved / range) * 100 : 100;
  } else {
    progressPercent = 100;
  }

  return {
    current,
    next,
    progressPercent: Math.min(100, Math.max(0, progressPercent)),
    amountAchieved,
    amountRemaining,
    isMaxMilestone: next === null,
  };
}

/**
 * Indian number formatting with compact labels for milestones.
 * Uses Indian lakh/crore notation.
 *
 * Examples:
 *   9_999      → "₹9,999"
 *   10_000     → "₹10,000"
 *   100_000    → "₹1.0 Lakh"
 *   10_000_000 → "₹10 Lakh"   (corrected: should be ₹1.0 Crore)
 *   10_000_000 → "₹1.0 Crore"
 *   500_000_000→ "₹50 Crore"
 */
export function formatINR(amount: number): string {
  const abs = Math.abs(amount);

  if (abs >= 10_000_000) {
    // Crore range
    const crores = amount / 10_000_000;
    const formatted =
      crores % 1 === 0 ? crores.toFixed(0) : crores >= 10 ? crores.toFixed(0) : crores.toFixed(1);
    return `₹${formatted} Crore`;
  }

  if (abs >= 100_000) {
    // Lakh range
    const lakhs = amount / 100_000;
    const formatted =
      lakhs % 1 === 0 ? lakhs.toFixed(0) : lakhs >= 10 ? lakhs.toFixed(0) : lakhs.toFixed(1);
    return `₹${formatted} Lakh`;
  }

  // Below 1 lakh — use Indian locale formatting
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
