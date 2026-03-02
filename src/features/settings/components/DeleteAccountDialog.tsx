/**
 * DeleteAccountDialog
 *
 * Custom accessible dialog for permanent account deletion.
 * Requires password confirmation before proceeding.
 * Follows the same ARIA pattern as ConfirmDialog (role="alertdialog").
 */

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Eye, EyeOff, Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Focus trap helper (mirrors ConfirmDialog implementation)
// ---------------------------------------------------------------------------

const FOCUSABLE_SELECTORS =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DeleteAccountDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: (password: string) => Promise<void>;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DeleteAccountDialog({
  open,
  onOpenChange,
  onConfirm,
}: DeleteAccountDialogProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');

  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Remember opener
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      setPassword('');
      setError('');
      setShowPassword(false);
    }
  }, [open]);

  // Auto-focus password input
  useEffect(() => {
    if (open) {
      setTimeout(() => { inputRef.current?.focus(); }, 50);
    } else {
      (triggerRef.current as HTMLElement | null)?.focus();
    }
  }, [open]);

  // Focus trap + Escape
  useEffect(() => {
    if (!open || !dialogRef.current) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onOpenChange(false); return; }
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); };
  }, [open, onOpenChange]);

  async function handleSubmit() {
    if (!password) { setError('Please enter your password.'); return; }

    setIsPending(true);
    setError('');
    try {
      await onConfirm(password);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect password. Please try again.');
    } finally {
      setIsPending(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => { if (!isPending) { onOpenChange(false); } }}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-labelledby="delete-account-title"
        aria-describedby="delete-account-description"
        className="relative z-10 w-full max-w-md rounded-xl border border-destructive/30 bg-card p-6 shadow-xl flex flex-col gap-5"
      >
        {/* Warning icon */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle size={20} className="text-destructive" aria-hidden="true" />
          </div>
          <h2
            id="delete-account-title"
            className="text-base font-semibold text-foreground"
          >
            Delete Account
          </h2>
        </div>

        <p
          id="delete-account-description"
          className="text-sm text-muted-foreground leading-relaxed"
        >
          This action is <strong className="text-foreground">permanent and irreversible</strong>.
          All your financial data will be deleted from this device. Enter your password to confirm.
        </p>

        {/* Password form */}
        <form onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="delete-account-password"
              className="text-sm font-medium text-foreground"
            >
              Password
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                id="delete-account-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); }}
                disabled={isPending}
                autoComplete="current-password"
                placeholder="Enter your password"
                className={[
                  'w-full rounded-lg border bg-background px-3 py-2 text-sm pr-10',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  error ? 'border-destructive' : 'border-border',
                ].join(' ')}
                aria-invalid={!!error}
                aria-describedby={error ? 'delete-account-error' : undefined}
              />
              <button
                type="button"
                onClick={() => { setShowPassword((v) => !v); }}
                disabled={isPending}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && (
              <p
                id="delete-account-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {error}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => { onOpenChange(false); }}
              disabled={isPending}
              className="flex-1 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !password}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {isPending ? 'Deleting…' : 'Delete Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
