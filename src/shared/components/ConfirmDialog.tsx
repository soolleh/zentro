import { useEffect, useRef } from 'react';

/**
 * ConfirmDialog
 *
 * A fully accessible custom confirmation dialog built on native ARIA primitives.
 * No shadcn/ui AlertDialog dependency — this project does not have shadcn components
 * pre-initialized and the component must be self-contained.
 *
 * Accessibility:
 * - role="alertdialog" with aria-modal="true"
 * - Focus trapped inside the dialog while open
 * - Focus returns to the trigger element on close
 * - Backdrop click closes the dialog (same as cancel)
 * - Escape key closes the dialog
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConfirmDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly onConfirm: () => void;
  /** When true, the confirm button uses the destructive colour. */
  readonly destructive?: boolean;
};

// ---------------------------------------------------------------------------
// Focus trap helper
// ---------------------------------------------------------------------------

const FOCUSABLE_SELECTORS =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  destructive = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  // Remember the element that opened the dialog
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
    }
  }, [open]);

  // Auto-focus first focusable element and clean up on close
  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const focusable = getFocusableElements(dialogRef.current);
    focusable[0]?.focus();

    return () => {
      (triggerRef.current as HTMLElement | null)?.focus();
    };
  }, [open]);

  // Focus trap
  useEffect(() => {
    if (!open || !dialogRef.current) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); };
  }, [open, onOpenChange]);

  if (!open) return null;

  const confirmButtonClass = destructive
    ? 'rounded-lg px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-destructive'
    : 'rounded-lg px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
        aria-hidden="true"
        onClick={() => { onOpenChange(false); }}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-xl border border-border bg-card shadow-lg p-6 focus:outline-none"
        tabIndex={-1}
      >
        <h2
          id="confirm-dialog-title"
          className="text-base font-semibold text-foreground mb-2"
        >
          {title}
        </h2>
        <p
          id="confirm-dialog-description"
          className="text-sm text-muted-foreground mb-6 leading-relaxed"
        >
          {description}
        </p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => { onOpenChange(false); }}
            className="rounded-lg px-4 py-2 text-sm font-medium text-foreground bg-secondary hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => { onConfirm(); onOpenChange(false); }}
            className={confirmButtonClass}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
