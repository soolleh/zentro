/**
 * ConfettiCanvas.tsx
 *
 * Reusable confetti animation overlay (pointer-events-none).
 * Shared between GoalCelebrationOverlay and MilestoneCelebrationOverlay.
 *
 * Renders 50 confetti pieces falling from the top of the viewport.
 * Uses deterministic positioning (no Math.random) to avoid re-renders.
 */
import { useMemo } from 'react';

const CONFETTI_COLORS = [
  'hsl(192 90% 38%)',
  'hsl(245 75% 62%)',
  'hsl(35 90% 55%)',
  'hsl(155 65% 42%)',
  'hsl(320 65% 58%)',
  '#ffd700',
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

type ConfettiCanvasProps = {
  count?: number;
};

export function ConfettiCanvas({ count = 50 }: ConfettiCanvasProps) {
  const pieces = useMemo<ConfettiPiece[]>(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${((i * 37 + 11) % 100).toString()}%`,
      width: `${(8 + (i % 5)).toString()}px`,
      height: `${(8 + ((i * 3) % 5)).toString()}px`,
      backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      borderRadius: i % 2 === 0 ? '50%' : '0%',
      animationDuration: `${(1500 + ((i * 47) % 1500)).toString()}ms`,
      animationDelay: `${((i * 20) % 800).toString()}ms`,
    }));
  }, [count]);

  return (
    <>
      <style>{`
        @keyframes zentroConfettiFall {
          from { transform: translateY(0) rotate(0deg); opacity: 1; }
          to   { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
      <div
        className="fixed inset-0 z-[100] pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        {pieces.map((piece) => (
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
      </div>
    </>
  );
}
