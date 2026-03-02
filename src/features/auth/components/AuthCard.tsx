import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// AuthCard — card container for all auth screens.
// Full-page centering and background are handled by AuthBackground.
// ---------------------------------------------------------------------------

type AuthCardProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

export function AuthCard({ children, className }: AuthCardProps) {
  return (
    <div
      className={[
        'w-full max-w-[440px] bg-card border border-border rounded-xl shadow-md',
        'p-6 sm:p-8 flex flex-col gap-6',
        'animate-in fade-in-0 slide-in-from-bottom-4 duration-300',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
