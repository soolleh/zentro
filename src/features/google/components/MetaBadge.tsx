/**
 * MetaBadge.tsx
 *
 * Displays a row of pill chips summarising the counts stored in a backup's
 * metadata (accounts, transactions, categories, budgets, goals, bills).
 * Chips with a zero count are hidden to reduce noise.
 */

import type { BackupMeta } from '@/services/google/drive-backup.service';

interface MetaBadgeProps {
  meta: BackupMeta;
  className?: string;
}

interface Chip {
  label: string;
  count: number;
}

export function MetaBadge({ meta, className = '' }: MetaBadgeProps) {
  const chips: Chip[] = [
    { label: 'account', count: meta.accounts },
    { label: 'transaction', count: meta.transactions },
    { label: 'category', count: meta.categories },
    { label: 'budget', count: meta.budgets },
    { label: 'goal', count: meta.goals },
    { label: 'bill', count: meta.bills },
  ].filter((c) => c.count > 0);

  if (chips.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap gap-1.5 ${className}`}
      aria-label="Backup contents"
    >
      {chips.map(({ label, count }) => (
        <span
          key={label}
          className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground tabular-nums"
        >
          <span className="font-semibold text-foreground mr-1">{count.toLocaleString()}</span>
          {count === 1 ? label : `${label}s`}
        </span>
      ))}
    </div>
  );
}
