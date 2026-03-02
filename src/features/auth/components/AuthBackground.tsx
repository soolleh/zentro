import type { ReactNode } from 'react';

interface AuthBackgroundProps {
  children: ReactNode;
}

export function AuthBackground({ children }: AuthBackgroundProps) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center py-12 px-4 bg-muted/40 relative">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full flex flex-col items-center">{children}</div>
    </div>
  );
}
