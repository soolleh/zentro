import { useEffect, useMemo } from 'react';
import { useCelebrating, useGoalStore } from '@/app/stores/goal.store';
import { formatCurrency } from '@/shared/utils/currency.utils';
import { useShallow } from 'zustand/react/shallow';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONFETTI_COLORS = [
  'hsl(192 90% 38%)',
  'hsl(245 75% 62%)',
  'hsl(35 90% 55%)',
  'hsl(155 65% 42%)',
  'hsl(320 65% 58%)',
];

type ConfettiPiece = {
  id: number;
  left: string;
  width: string;
  height: string;
  backgroundColor: string;
  borderRadius: string;
  animationDuration: string;
  animationDelay: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GoalCelebrationOverlay() {
  const { celebratingGoalId, setCelebrating } = useCelebrating();
  const goals = useGoalStore(useShallow((s) => s.goals));

  const celebratingGoal = celebratingGoalId
    ? goals.find((g) => g.goal.id === celebratingGoalId) ?? null
    : null;

  // Auto-dismiss after 6 seconds
  useEffect(() => {
    if (!celebratingGoalId) return;
    const timer = setTimeout(() => { setCelebrating(null); }, 6000);
    return () => { clearTimeout(timer); };
  }, [celebratingGoalId, setCelebrating]);

  const confettiPieces = useMemo<ConfettiPiece[]>((): ConfettiPiece[] => {
    // Use a seeded-like approach to avoid true randomness on each render
    return Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: `${((i * 37 + 11) % 100).toString()}%`,
      width: `${(8 + (i % 5)).toString()}px`,
      height: `${(8 + ((i * 3) % 5)).toString()}px`,
      backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      borderRadius: i % 2 === 0 ? '50%' : '0%',
      animationDuration: `${(1500 + ((i * 47) % 1500)).toString()}ms`,
      animationDelay: `${((i * 20) % 1000).toString()}ms`,
    }));
  }, []);

  if (!celebratingGoal) return null;

  const { goal, totalContributed } = celebratingGoal;

  return (
    <>
      <style>{`
        @keyframes zentroConfettiFall {
          from { transform: translateY(0) rotate(0deg); opacity: 1; }
          to   { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>

      <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
        {/* Confetti pieces */}
        {confettiPieces.map((piece) => (
          <div
            key={piece.id}
            style={{
              position: 'absolute',
              left: piece.left,
              top: '-20px',
              width: piece.width,
              height: piece.height,
              backgroundColor: piece.backgroundColor,
              borderRadius: piece.borderRadius,
              animation: `zentroConfettiFall ${piece.animationDuration} ease-in ${piece.animationDelay} forwards`,
            }}
          />
        ))}

        {/* Center celebration card */}
        <div className="pointer-events-auto absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-2xl shadow-2xl px-8 py-8 flex flex-col items-center gap-4 text-center animate-in zoom-in-75 duration-500">
          <span className="text-5xl" aria-hidden="true">🎉</span>
          <h2 className="text-2xl font-bold text-foreground">Goal complete!</h2>
          <p className="text-sm text-muted-foreground max-w-[220px]">
            You&apos;ve reached your <span className="font-medium">{goal.name}</span> goal. Incredible
            work.
          </p>
          <p
            className="text-xl font-bold tabular-nums"
            style={{ color: goal.color }}
          >
            {formatCurrency(totalContributed, goal.currency)}
          </p>
          <button
            type="button"
            onClick={() => { setCelebrating(null); }}
            className="h-10 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-150"
          >
            Awesome!
          </button>
        </div>
      </div>
    </>
  );
}
