export function LockScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-foreground mb-1">Zentro is locked</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Enter your password to continue.
        </p>
        <input
          type="password"
          placeholder="Password"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring mb-4"
          aria-label="Password"
        />
        <button
          type="button"
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Unlock
        </button>
      </div>
    </div>
  );
}
