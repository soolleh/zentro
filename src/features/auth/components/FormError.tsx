import { XCircle } from 'lucide-react';

// ---------------------------------------------------------------------------
// FormError — displays a form-level (non-field) error callout.
// Renders nothing when message is falsy.
// ---------------------------------------------------------------------------

type FormErrorProps = {
  readonly message?: string;
};

export function FormError({ message }: FormErrorProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 flex items-start gap-2 animate-in fade-in-0 slide-in-from-top-2 duration-200"
    >
      <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" aria-hidden="true" />
      <p className="text-sm text-destructive">{message}</p>
    </div>
  );
}
