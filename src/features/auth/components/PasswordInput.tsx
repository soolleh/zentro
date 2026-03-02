import { forwardRef, useState, useId } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// ---------------------------------------------------------------------------
// PasswordInput — accessible password field with show/hide toggle.
// Designed for use with react-hook-form via forwardRef.
// ---------------------------------------------------------------------------

const LABELS = {
  SHOW_PASSWORD: 'Show password',
  HIDE_PASSWORD: 'Hide password',
} as const;

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  readonly label: string;
  readonly error?: string;
  readonly hint?: string;
};

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ label, error, hint, className, id: idProp, ...props }, ref) {
    const [visible, setVisible] = useState(false);
    const generatedId = useId();
    const inputId = idProp ?? generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={visible ? 'text' : 'password'}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error ? errorId : hint ? hintId : undefined
            }
            className={[
              'h-10 w-full rounded-lg border bg-background px-3 pr-10 text-sm text-foreground',
              'placeholder:text-muted-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:shadow-sm',
              'transition-colors duration-100',
              error
                ? 'border-destructive focus-visible:ring-destructive'
                : 'border-input hover:border-ring',
              className ?? '',
            ]
              .filter(Boolean)
              .join(' ')}
            {...props}
          />
          <button
            type="button"
            tabIndex={0}
            aria-label={visible ? LABELS.HIDE_PASSWORD : LABELS.SHOW_PASSWORD}
            onClick={() => { setVisible((v) => !v); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error ? (
          <p id={errorId} role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-xs text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
);
