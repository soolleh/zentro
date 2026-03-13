/**
 * MilestoneCelebrationOverlay.tsx
 *
 * Full-screen, stage-aware celebration overlay.
 * Renders at z-[100] — above all panels, modals, and banners.
 * Processes one milestone at a time from the celebration queue.
 */
import { useMemo } from 'react';
import { ConfettiCanvas } from '@/features/shared/components/ConfettiCanvas';
import {
  useCelebration,
} from '@/app/stores/milestone.store';
import {
  getMilestoneById,
  getNextMilestone,
  formatINR,
  type BadgeLevel,
} from '@/services/milestones/milestone-config';
import { MilestoneBadge } from './MilestoneBadge';
import { useCurrentUser } from '@/app/stores/session.store';
import type { UUID } from '@/shared/types/common.types';

// ---------------------------------------------------------------------------
// Particle components per level
// ---------------------------------------------------------------------------

function FloatParticles({ emoji, count = 20 }: { emoji: string; count?: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: `${((i * 41 + 7) % 95).toString()}%`,
        animDelay: `${((i * 150) % 1800).toString()}ms`,
        animDuration: `${(2000 + ((i * 200) % 1500)).toString()}ms`,
        fontSize: `${(16 + (i % 3) * 6).toString()}px`,
      })),
    [count, emoji]
  );

  return (
    <>
      <style>{`
        @keyframes ms-float-up {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(-110vh) rotate(360deg); opacity: 0; }
        }
      `}</style>
      <div className="fixed inset-0 z-[99] pointer-events-none overflow-hidden" aria-hidden="true">
        {particles.map((p) => (
          <span
            key={p.id}
            style={{
              position: 'absolute',
              left: p.left,
              bottom: '-30px',
              fontSize: p.fontSize,
              animation: `ms-float-up ${p.animDuration} ease-in ${p.animDelay} forwards`,
            }}
          >
            {emoji}
          </span>
        ))}
      </div>
    </>
  );
}

function SilverStreaks() {
  const streaks = useMemo(
    () =>
      Array.from({ length: 50 }, (_, i) => ({
        id: i,
        left: `${((i * 37 + 3) % 98).toString()}%`,
        width: '1px',
        height: `${(20 + ((i * 7) % 40)).toString()}px`,
        delay: `${((i * 40) % 2000).toString()}ms`,
        duration: `${(800 + ((i * 60) % 700)).toString()}ms`,
        color: i % 3 === 0 ? '#94a3b8' : i % 3 === 1 ? '#cbd5e1' : '#e2e8f0',
      })),
    []
  );

  return (
    <>
      <style>{`
        @keyframes ms-silver-streak {
          0%   { transform: translateY(-10px) scaleY(0); opacity: 0; }
          20%  { opacity: 0.8; transform: scaleY(1) translateY(0); }
          100% { transform: translateY(100vh); opacity: 0; }
        }
      `}</style>
      <div className="fixed inset-0 z-[99] pointer-events-none overflow-hidden" aria-hidden="true">
        {streaks.map((s) => (
          <div
            key={s.id}
            style={{
              position: 'absolute',
              left: s.left,
              top: 0,
              width: s.width,
              height: s.height,
              backgroundColor: s.color,
              animation: `ms-silver-streak ${s.duration} ease-in ${s.delay} infinite`,
            }}
          />
        ))}
      </div>
    </>
  );
}

function GoldCoins() {
  const coins = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        left: `${((i * 43 + 5) % 95).toString()}%`,
        delay: `${((i * 100) % 3000).toString()}ms`,
        duration: `${(2000 + ((i * 150) % 1500)).toString()}ms`,
        emoji: i % 3 === 0 ? '🪙' : '💰',
        fontSize: `${(18 + (i % 4) * 4).toString()}px`,
      })),
    []
  );

  return (
    <>
      <style>{`
        @keyframes ms-gold-fall {
          0%   { top: -10%; transform: rotate(0deg) scale(1); opacity: 1; }
          100% { top: 110%; transform: rotate(720deg) scale(0.5); opacity: 0; }
        }
      `}</style>
      <div className="fixed inset-0 z-[99] pointer-events-none overflow-hidden" aria-hidden="true">
        {coins.map((c) => (
          <span
            key={c.id}
            style={{
              position: 'absolute',
              left: c.left,
              fontSize: c.fontSize,
              animation: `ms-gold-fall ${c.duration} linear ${c.delay} forwards`,
            }}
          >
            {c.emoji}
          </span>
        ))}
      </div>
    </>
  );
}

function LegendaryBurst() {
  const directions = ['0deg', '45deg', '90deg', '135deg', '180deg', '225deg', '270deg', '315deg'];

  return (
    <>
      <style>{`
        @keyframes ms-starburst {
          0%   { transform: scale(0) rotate(0deg); opacity: 0.8; }
          60%  { opacity: 0.6; }
          100% { transform: scale(10) rotate(45deg); opacity: 0; }
        }
        @keyframes ms-star-radiate {
          0%   { transform: translate(-50%, -50%) translateY(0) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) translateY(-180px) scale(0.3); opacity: 0; }
        }
      `}</style>

      {/* Radial gradient burst */}
      <div
        className="fixed inset-0 z-[99] pointer-events-none flex items-center justify-center"
        aria-hidden="true"
      >
        <div
          style={{
            width: '200px',
            height: '200px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(167,139,250,0.6) 0%, rgba(251,191,36,0.3) 40%, transparent 70%)',
            animation: 'ms-starburst 1.2s ease-out forwards',
          }}
        />
        {/* 8 directional stars */}
        {directions.map((deg, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              fontSize: '24px',
              transformOrigin: 'center',
              transform: `translate(-50%, -50%) rotate(${deg}) translateY(-80px)`,
              animation: `ms-star-radiate 1.5s ease-out ${(i * 80).toString()}ms forwards`,
            }}
          >
            ⭐
          </span>
        ))}
      </div>

      {/* Full confetti */}
      <ConfettiCanvas count={80} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Card shell per level
// ---------------------------------------------------------------------------

const CARD_STYLE: Record<BadgeLevel, string> = {
  1: 'bg-card shadow-2xl',
  2: 'bg-card shadow-2xl border border-indigo-200/50',
  3: 'bg-card shadow-2xl border-2 border-slate-300 shadow-slate-200/50',
  4: 'bg-card shadow-2xl border-2 border-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.4)]',
  5: 'bg-gradient-to-br from-purple-950 via-indigo-900 to-violet-950 border-2 border-purple-400 shadow-[0_0_80px_rgba(167,139,250,0.8),0_0_160px_rgba(251,191,36,0.3)]',
};

const HEADLINE_STYLE: Record<BadgeLevel, string> = {
  1: 'text-muted-foreground',
  2: 'text-muted-foreground',
  3: 'text-muted-foreground',
  4: 'text-amber-600',
  5: 'text-purple-300',
};

const AMOUNT_GRADIENT: Record<BadgeLevel, React.CSSProperties> = {
  1: {},
  2: {},
  3: {
    background: 'linear-gradient(135deg, #475569, #94a3b8)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  4: {
    background: 'linear-gradient(135deg, #d97706, #f59e0b, #fbbf24)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  5: {
    background: 'linear-gradient(135deg, #c084fc, #a855f7, #818cf8, #f0abfc)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MilestoneCelebrationOverlay() {
  const {
    activeCelebration,
    pendingCelebration,
    isCelebrating,
    celebrationQueue,
    advanceCelebration,
    skipAllCelebrations,
  } = useCelebration();

  const currentUser = useCurrentUser();

  // Use activeCelebration, fallback to pendingCelebration for compat
  const celebration = activeCelebration ?? pendingCelebration;

  if (!isCelebrating || !celebration) return null;

  const config = getMilestoneById(celebration.milestoneId);
  const nextConfig = getNextMilestone(celebration.netWorthAtAchievement);
  const badgeLevel = config.badgeLevel as BadgeLevel;
  const queueCount = celebrationQueue.length;
  const remainingAfterThis = Math.max(0, queueCount - 1);

  async function handleSkipAll() {
    if (!currentUser) return;
    await skipAllCelebrations(currentUser.id as UUID);
  }

  async function handleContinue() {
    await advanceCelebration();
  }

  return (
    <>
      {/* Level-specific background effects */}
      {(badgeLevel === 1 || badgeLevel === 2) && (
        <FloatParticles emoji={config.emoji} count={20} />
      )}
      {badgeLevel === 3 && <SilverStreaks />}
      {badgeLevel === 4 && <GoldCoins />}
      {badgeLevel === 5 && <LegendaryBurst />}

      {/* Overlay */}
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-lg animate-in fade-in-0 duration-400"
        role="dialog"
        aria-modal="true"
        aria-labelledby="milestone-overlay-title"
      >
        {/* Content card */}
        <div
          className={[
            'relative rounded-3xl p-8 mx-5 max-w-sm w-full flex flex-col items-center gap-4 text-center',
            'animate-in zoom-in-90 duration-500 ease-out',
            CARD_STYLE[badgeLevel],
          ].join(' ')}
        >
          {/* Badge */}
          <div className="animate-in zoom-in-50 duration-500 delay-200">
            <MilestoneBadge
              milestoneId={config.id}
              size="lg"
              animated
            />
          </div>

          {/* Headline */}
          <p
            className={[
              'text-sm font-bold uppercase tracking-widest',
              HEADLINE_STYLE[badgeLevel],
            ].join(' ')}
          >
            {badgeLevel >= 4 ? 'MILESTONE REACHED' : 'Milestone Reached!'}
          </p>

          {/* Milestone name */}
          <h2
            id="milestone-overlay-title"
            className={[
              'text-3xl font-black',
              badgeLevel === 5 ? 'text-white' : 'text-foreground',
            ].join(' ')}
          >
            {config.name}
          </h2>

          {/* Tagline */}
          <p
            className={[
              'text-sm italic',
              badgeLevel === 5 ? 'text-purple-300' : 'text-muted-foreground',
            ].join(' ')}
          >
            {config.tagline}
          </p>

          {/* Net worth at achievement */}
          <p
            className="text-2xl font-bold tabular-nums"
            style={AMOUNT_GRADIENT[badgeLevel]}
          >
            {formatINR(celebration.netWorthAtAchievement)}
          </p>

          {/* Celebration message */}
          <div
            className={[
              'p-4 rounded-2xl border max-w-xs',
              badgeLevel === 5
                ? 'bg-white/5 border-white/10'
                : 'bg-muted/30 border-border',
            ].join(' ')}
          >
            <p
              className={[
                'text-sm',
                badgeLevel === 5 ? 'text-purple-100' : 'text-foreground',
              ].join(' ')}
            >
              {config.celebrationMessage}
            </p>
          </div>

          {/* Next milestone preview */}
          {nextConfig && (
            <div className="flex flex-col gap-1 items-center w-full">
              <p
                className={[
                  'text-xs',
                  badgeLevel === 5 ? 'text-purple-300' : 'text-muted-foreground',
                ].join(' ')}
              >
                Next milestone
              </p>
              <div className="flex items-center gap-2">
                <MilestoneBadge milestoneId={nextConfig.id} size="sm" locked />
                <div className="text-left">
                  <p
                    className={[
                      'text-sm font-semibold',
                      badgeLevel === 5 ? 'text-white' : 'text-foreground',
                    ].join(' ')}
                  >
                    {nextConfig.name}
                  </p>
                  <p
                    className={[
                      'text-xs',
                      badgeLevel === 5 ? 'text-purple-300' : 'text-muted-foreground',
                    ].join(' ')}
                  >
                    {formatINR(nextConfig.threshold)}
                  </p>
                </div>
              </div>
              <p
                className={[
                  'text-xs font-medium mt-1',
                  badgeLevel === 5 ? 'text-purple-300' : 'text-primary',
                ].join(' ')}
              >
                {config.nextHint}
              </p>
            </div>
          )}

          {/* Queue count */}
          {remainingAfterThis > 0 && (
            <p
              className={[
                'text-xs',
                badgeLevel === 5 ? 'text-purple-300' : 'text-muted-foreground',
              ].join(' ')}
            >
              +{remainingAfterThis.toString()} more milestone
              {remainingAfterThis !== 1 ? 's' : ''} to celebrate!
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 w-full mt-2">
            <button
              type="button"
              onClick={() => { void handleContinue(); }}
              className={[
                'h-11 w-full rounded-2xl text-sm font-semibold transition-all duration-150',
                badgeLevel === 5
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
              ].join(' ')}
            >
              Keep going 🚀
            </button>

            {queueCount > 1 && (
              <button
                type="button"
                onClick={() => { void handleSkipAll(); }}
                className={[
                  'text-xs text-center py-1 transition-colors',
                  badgeLevel === 5
                    ? 'text-purple-400 hover:text-purple-200'
                    : 'text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                Skip all
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
