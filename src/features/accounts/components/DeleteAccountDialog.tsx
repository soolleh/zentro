/**
 * DeleteAccountDialog.tsx
 *
 * Confirmation dialog for deleting an account.
 * Shows a blocking message if the account has transactions,
 * or a standard destructive confirmation otherwise.
 */

import { AlertCircle, Loader2 } from 'lucide-react';

const LABELS = {
  CANNOT_DELETE_TITLE: 'Cannot delete account',
  OK: 'OK',
  CONFIRM_TITLE: 'Delete account?',
  CONFIRM_DESCRIPTION: 'This will permanently remove the account. This cannot be undone.',
  CANCEL: 'Cancel',
  DELETE: 'Delete',
  DELETING: 'Deleting…',
} as const;

type DeleteAccountDialogProps = {
  readonly accountName: string;
  readonly hasTransactions: boolean;
  readonly transactionCount?: number;
  readonly isDeleting?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
};

export function DeleteAccountDialog({
  accountName,
  hasTransactions,
  transactionCount,
  isDeleting = false,
  onConfirm,
  onCancel,
}: DeleteAccountDialogProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-sm bg-card border border-border rounded-2xl shadow-xl p-6 flex flex-col gap-4">
        {hasTransactions ? (
          <>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4.5 h-4.5 text-destructive" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-base font-semibold text-foreground">
                  {LABELS.CANNOT_DELETE_TITLE}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {`"${accountName}" has${transactionCount !== undefined ? ` ${String(transactionCount)}` : ''} transaction${transactionCount !== 1 ? 's' : ''}. You must delete or reassign all transactions before removing this account.`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-150"
            >
              {LABELS.OK}
            </button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-foreground">
                {`Delete "${accountName}"?`}
              </h2>
              <p className="text-sm text-muted-foreground">{LABELS.CONFIRM_DESCRIPTION}</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={isDeleting}
                className="flex-1 h-10 rounded-lg border border-border bg-background text-sm font-medium text-foreground hover:bg-muted/50 transition-colors duration-150 disabled:opacity-50"
              >
                {LABELS.CANCEL}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isDeleting}
                className="flex-1 h-10 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors duration-150 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {LABELS.DELETING}
                  </>
                ) : (
                  LABELS.DELETE
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
