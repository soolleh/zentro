import { useState, useEffect, useRef } from 'react';
import { Check, X } from 'lucide-react';
import type { Budget } from '@/shared/types/budget.types';

type InlineAmountEditProps = {
  readonly budget: Budget;
  readonly onSave: (amount: number) => Promise<void>;
  readonly onCancel: () => void;
};

export function InlineAmountEdit({ budget, onSave, onCancel }: InlineAmountEditProps) {
  const [value, setValue] = useState(String(budget.amount));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => { document.removeEventListener('mousedown', handleMouseDown); };
  }, [onCancel]);

  const handleSave = async () => {
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed <= 0) {
      setError('Enter a valid amount greater than 0.');
      return;
    }
    setIsSaving(true);
    setError(null);
    await onSave(parsed);
    setIsSaving(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      void handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div ref={containerRef} className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium px-2 py-1 rounded-md bg-muted text-muted-foreground">
          {budget.currency}
        </span>
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => { setValue(e.target.value); }}
          onKeyDown={handleKeyDown}
          className="w-24 h-7 rounded-md border border-primary bg-background px-2 text-sm font-semibold tabular-nums text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          disabled={isSaving}
          aria-label="Budget amount"
        />
        <button
          type="button"
          onClick={() => { void handleSave(); }}
          disabled={isSaving}
          className="w-7 h-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-all duration-150 disabled:opacity-50"
          aria-label="Save"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-all duration-150 disabled:opacity-50"
          aria-label="Cancel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {error !== null && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
