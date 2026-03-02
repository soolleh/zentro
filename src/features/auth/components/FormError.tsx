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
      className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {message}
    </div>
  );
}
