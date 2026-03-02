import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';

type StepTransitionProps = {
  step: number;
  direction: 'forward' | 'backward';
  children: ReactNode;
};

type StepContentProps = {
  direction: 'forward' | 'backward';
  children: ReactNode;
};

/**
 * Mounts fresh on each step change (via key={step} in parent).
 * useLayoutEffect sets the initial off-screen position before first paint,
 * then triggers the CSS transition to translate-x-0 on the next frame.
 */
function StepContent({ direction, children }: StepContentProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Place off-screen without transition
    el.style.transform =
      direction === 'forward' ? 'translateX(100%)' : 'translateX(-100%)';
    el.style.transition = 'none';

    // Next frame: enable transition and slide to identity
    const id = requestAnimationFrame(() => {
      el.style.transition = 'transform 300ms ease-in-out';
      el.style.transform = 'translateX(0)';
    });

    return () => {
      cancelAnimationFrame(id);
    };
  }, [direction]);

  return <div ref={ref}>{children}</div>;
}

/**
 * StepTransition — clips content during step transitions and coordinates
 * the enter animation for each new step.
 *
 * Each unique `step` value causes StepContent to unmount/remount
 * (via `key={step}`), triggering the layout effect for the entry animation.
 *
 * No library required — pure CSS transitions via inline style manipulation.
 */
export function StepTransition({ step, direction, children }: StepTransitionProps) {
  return (
    <div className="overflow-hidden">
      <StepContent key={step} direction={direction}>
        {children}
      </StepContent>
    </div>
  );
}
