/**
 * MilestoneToast.tsx
 *
 * Small toast notification shown when a milestone is detected during app use
 * (transaction flow). Stacks up to 3 visible at once. Auto-dismisses after 8s.
 *
 * The full overlay celebration is triggered only on login for unacknowledged
 * milestones — this toast is the lighter, in-session variant.
 */
import { useEffect } from 'react';
import { Trophy } from 'lucide-react';
import type { NetWorthMilestone, MilestoneTier } from '@/shared/types/milestone.types';
import { useToastMilestones, useMilestoneStore } from '@/app/stores/milestone.store';
import type { UUID } from '@/shared/types/common.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOAST_DURATION_MS = 8_000;
const MAX_VISIBLE_TOASTS = 3;

const TOAST_DISMISSED = 'dismissed';

const TIER_BORDER: Record<MilestoneTier, string> = {
  bronze: 'border-[#cd7f32]/50',
  silver: 'border-[#c0c0c0]/50',
  gold: 'border-[#ffd700]/60',
  platinum: 'border-[#e5e4e2]/60',
  diamond: 'border-blue-400/60',
};

const TIER_GLOW: Record<MilestoneTier, string> = {
  bronze: 'shadow-[#cd7f32]/15',
  silver: 'shadow-[#c0c0c0]/15',
  gold: 'shadow-[#ffd700]/20',
  platinum: 'shadow-[#e5e4e2]/20',
  diamond: 'shadow-blue-400/20',
};

// ---------------------------------------------------------------------------
// Single toast item
// ---------------------------------------------------------------------------

type MilestoneToastItemProps = {
  milestone: NetWorthMilestone;
};

function MilestoneToastItem({ milestone }: MilestoneToastItemProps) {
  const { dismissMilestoneToast, triggerCelebration } = useToastMilestones();

  // Auto-dismiss after TOAST_DURATION_MS
  useEffect(() => {
    const timer = window.setTimeout(() => {
      dismissMilestoneToast(milestone.id as UUID);
    }, TOAST_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [milestone.id, dismissMilestoneToast]);

  function handleOpenCelebration() {
    triggerCelebration(milestone);
    dismissMilestoneToast(milestone.id as UUID);
  }

  const borderClass = TIER_BORDER[milestone.tier];
  const glowClass = TIER_GLOW[milestone.tier];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Milestone reached: ${milestone.label}`}
      className={[
        'pointer-events-auto',
        'flex items-center gap-3',
        'p-4 rounded-2xl border shadow-lg',
        'min-w-[300px] max-w-[360px]',
        'bg-card',
        borderClass,
        glowClass,
        'animate-in slide-in-from-right-4 fade-in duration-300',
      ].join(' ')}
    >
      {/* Emoji */}
      <span className="text-3xl leading-none select-none" aria-hidden="true">
        {milestone.emoji}
      </span>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground leading-snug">
          Milestone reached! 🎉
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug truncate">
          {milestone.label}
        </p>
      </div>

      {/* Open full overlay button */}
      <button
        type="button"
        onClick={handleOpenCelebration}
        title="Open full celebration"
        aria-label="Open full milestone celebration"
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted/60 transition-colors"
      >
        <Trophy className="w-4 h-4 text-[#ffd700]" aria-hidden="true" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toast stack (rendered in AppLayout)
// ---------------------------------------------------------------------------

export const MILESTONE_TOAST_ARIA_DISMISSED = TOAST_DISMISSED;

export function MilestoneToastStack() {
  const { toastMilestones } = useToastMilestones();

  if (toastMilestones.length === 0) return null;

  // Show only the most recent MAX_VISIBLE_TOASTS
  const visible = toastMilestones.slice(-MAX_VISIBLE_TOASTS);

  return (
    <div
      className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      aria-label="Milestone notifications"
    >
      {visible.map((milestone) => (
        <MilestoneToastItem key={milestone.id} milestone={milestone} />
      ))}
    </div>
  );
}

// Convenience re-export of the store's addMilestoneToast for callers
export function addMilestoneToast(milestone: NetWorthMilestone) {
  useMilestoneStore.getState().addMilestoneToast(milestone);
}
