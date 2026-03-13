/**
 * MilestoneToast.tsx
 *
 * In-session toast notifications for newly achieved milestones.
 *
 * The full celebration overlay (`MilestoneCelebrationOverlay`) handles the
 * primary UX — this toast is a lightweight complement shown while the user
 * is mid-session. With the new celebration-queue architecture the store's
 * `useToastMilestones` returns an empty list, so the stack renders nothing
 * unless the queue is extended in future.
 *
 * @module milestones/components
 */
import { useEffect } from 'react';
import { Trophy } from 'lucide-react';
import type { AchievedMilestone } from '@/shared/types/milestone.types';
import { getMilestoneById, BADGE_LEVEL_STYLES } from '@/services/milestones/milestone-config';
import { useMilestoneStore } from '@/app/stores/milestone.store';
import type { UUID } from '@/shared/types/common.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOAST_DURATION_MS = 8_000;
const MAX_VISIBLE_TOASTS = 3;

// ---------------------------------------------------------------------------
// Single toast item
// ---------------------------------------------------------------------------

type MilestoneToastItemProps = {
  milestone: AchievedMilestone;
};

function MilestoneToastItem({ milestone }: MilestoneToastItemProps) {
  const advanceCelebration = useMilestoneStore((s) => s.advanceCelebration);
  const config = getMilestoneById(milestone.milestoneId);
  const levelStyle = BADGE_LEVEL_STYLES[config.badgeLevel];

  // Auto-dismiss: advance the celebration queue after the timeout
  useEffect(() => {
    const timer = window.setTimeout(() => {
      advanceCelebration();
    }, TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [milestone.id, advanceCelebration]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Milestone reached: ${config.name}`}
      className={[
        'pointer-events-auto',
        'flex items-center gap-3',
        'p-4 rounded-2xl border shadow-lg',
        'min-w-[300px] max-w-[360px]',
        'bg-card',
        levelStyle.borderClass,
        'animate-in slide-in-from-right-4 fade-in duration-300',
      ].join(' ')}
      style={{ boxShadow: levelStyle.glowClass !== 'none' ? levelStyle.glowClass : undefined }}
    >
      {/* Emoji */}
      <span className="text-3xl leading-none select-none" aria-hidden="true">
        {config.emoji}
      </span>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground leading-snug">
          Milestone reached! 🎉
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug truncate">
          {config.name}
        </p>
      </div>

      {/* Trophy icon */}
      <Trophy className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toast stack (rendered in AppLayout)
// ---------------------------------------------------------------------------

export function MilestoneToastStack() {
  // The new store's toastMilestones is always [] (no-op).
  // Access the celebration queue directly for any future in-session toasts.
  const celebrationQueue = useMilestoneStore((s) => s.celebrationQueue);
  const isCelebrating = useMilestoneStore((s) => s.isCelebrating);

  // Only show queue toasts when NOT in overlay mode
  if (isCelebrating || celebrationQueue.length === 0) return null;

  const visible = celebrationQueue.slice(0, MAX_VISIBLE_TOASTS);

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

// ---------------------------------------------------------------------------
// Convenience re-export (backward compat for TransactionForm callers)
// ---------------------------------------------------------------------------

/** @deprecated Use useMilestoneStore().pushNewAchievements instead. */
export function addMilestoneToast(milestone: AchievedMilestone) {
  useMilestoneStore.getState().addMilestoneToast(milestone);
}

// Legacy type export so old callers don't break immediately
export type { UUID as _LegacyUUID };
