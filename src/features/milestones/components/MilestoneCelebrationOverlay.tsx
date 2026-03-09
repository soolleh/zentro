/**
 * MilestoneCelebrationOverlay.tsx
 *
 * Full-screen celebration overlay shown when a net worth milestone is achieved.
 * Renders at z-index 100 — above all panels, modals, and banners.
 *
 * Shows one milestone at a time. Queue is processed via pendingCelebration cycling.
 */
import { format } from 'date-fns';
import { ConfettiCanvas } from '@/features/shared/components/ConfettiCanvas';
import { useCelebration, useMilestones, useMilestoneStore } from '@/app/stores/milestone.store';
import { milestoneStorage } from '@/services/storage/milestone.storage';
import { useCurrentUser } from '@/app/stores/session.store';
import { formatCurrency } from '@/shared/utils/currency.utils';
import { usePreferencesStore } from '@/app/preferences.store';
import type { MilestoneTier } from '@/shared/types/milestone.types';
import type { UUID } from '@/shared/types/common.types';

// ---------------------------------------------------------------------------
// Tier helpers
// ---------------------------------------------------------------------------

const TIER_BADGE_CLASS: Record<MilestoneTier, string> = {
  bronze: 'bg-[#cd7f32] text-white',
  silver: 'bg-[#c0c0c0] text-gray-800',
  gold: 'bg-[#ffd700] text-gray-800',
  platinum: 'bg-[#e5e4e2] text-gray-800',
  diamond: 'bg-gradient-to-r from-blue-400 to-purple-500 text-white',
};

const TIER_AMOUNT_CLASS: Record<MilestoneTier, string> = {
  bronze: 'text-[#cd7f32]',
  silver: 'text-[#a0a0a0]',
  gold: 'text-[#d4a900]',
  platinum: 'text-foreground',
  diamond: 'text-purple-500',
};

const TIER_LABEL: Record<MilestoneTier, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  diamond: 'Diamond',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MilestoneCelebrationOverlay() {
  const { pendingCelebration, isCelebrating, acknowledgeCelebration } = useCelebration();
  const { unacknowledgedMilestones } = useMilestones();
  const currentUser = useCurrentUser();
  const baseCurrency = usePreferencesStore((s) => s.baseCurrency);

  if (!isCelebrating || !pendingCelebration) return null;

  const tier = pendingCelebration.tier;
  const queueCount = unacknowledgedMilestones.length;
  const remainingAfterThis = queueCount - 1;

  async function handleSkipAll() {
    if (!currentUser) return;
    await milestoneStorage.acknowledgeAllMilestones(currentUser.id as UUID);
    // Reset store state
    useMilestoneStore.setState({
      unacknowledgedMilestones: [],
      pendingCelebration: null,
      isCelebrating: false,
      milestones: useMilestoneStore.getState().milestones.map((m) => ({
        ...m,
        acknowledged: true,
      })),
    });
  }

  return (
    <>
      {/* Confetti */}
      <ConfettiCanvas count={60} />

      {/* Overlay */}
      <div
        className="fixed inset-0 z-[101] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in-0 duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="milestone-overlay-title"
      >
        {/* Content card */}
        <div className="relative bg-card rounded-3xl p-8 mx-6 max-w-sm w-full flex flex-col items-center gap-4 shadow-2xl animate-in zoom-in-90 duration-500 ease-out">
          {/* Tier badge */}
          <div
            className={`absolute -top-4 left-1/2 -translate-x-1/2 h-8 px-4 rounded-full text-xs font-bold uppercase tracking-wider shadow-md flex items-center ${TIER_BADGE_CLASS[tier]}`}
          >
            {TIER_LABEL[tier]}
          </div>

          {/* Emoji (bounces 3 times) */}
          <span
            className="text-6xl mt-2"
            style={{ animation: 'bounce 0.8s ease 3' }}
            aria-hidden="true"
          >
            {pendingCelebration.emoji}
          </span>

          {/* Milestone label */}
          <div className="text-center">
            <h2
              id="milestone-overlay-title"
              className="text-2xl font-bold text-foreground"
            >
              {pendingCelebration.label}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              You crossed this milestone on{' '}
              {format(new Date(pendingCelebration.achievedAt), 'MMMM d, yyyy')}.
            </p>
          </div>

          {/* Net worth at achievement */}
          <p className={`text-base font-semibold tabular-nums ${TIER_AMOUNT_CLASS[tier]}`}>
            {formatCurrency(pendingCelebration.netWorthAtAchievement, baseCurrency)}
          </p>

          {/* Queue indicator */}
          {remainingAfterThis > 0 && (
            <p className="text-xs text-muted-foreground">
              +{remainingAfterThis.toString()} more milestone{remainingAfterThis !== 1 ? 's' : ''} to celebrate!
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 w-full mt-2">
            <button
              type="button"
              onClick={() => { void acknowledgeCelebration(); }}
              className="h-11 w-full rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-150"
            >
              Continue
            </button>

            {queueCount > 1 && (
              <button
                type="button"
                onClick={() => { void handleSkipAll(); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center py-1"
              >
                Skip all
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bounce keyframe (3 iterations only) */}
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-16px); }
        }
      `}</style>
    </>
  );
}
