import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// AuthCard — centred container for all auth screens.
// ---------------------------------------------------------------------------

type AuthCardProps = {
  readonly children: ReactNode;
};

const LABELS = {
  BRAND: 'Zentro',
  TAGLINE: 'Your personal finance, privately.',
} as const;

export function AuthCard({ children }: AuthCardProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-[400px] rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col items-center gap-1 border-b border-border px-8 py-6">
          <AuthWordmark />
          <p className="text-sm text-muted-foreground">{LABELS.TAGLINE}</p>
        </div>
        <div className="px-8 py-6">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AuthWordmark — inline component used inside AuthCard.
// Exported separately so it can be used wherever branding is needed.
// ---------------------------------------------------------------------------

export function AuthWordmark() {
  return (
    <span
      className="select-none text-2xl font-bold tracking-tight text-foreground"
      aria-label="Zentro"
    >
      Zentro
    </span>
  );
}
