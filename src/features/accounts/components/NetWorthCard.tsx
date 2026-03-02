/**
 * NetWorthCard.tsx
 *
 * Full-width summary card at the top of the Accounts page showing net worth,
 * total assets, and total liabilities.
 */

import { TrendingUp } from 'lucide-react';
import type { NetWorthSummary } from '@/shared/types/account.types';
import { formatCurrency } from '@/shared/utils/currency.utils';

const LABELS = {
  NET_WORTH: 'Net Worth',
  UPDATED: 'Updated just now',
  TOTAL_ASSETS: 'Total Assets',
  TOTAL_LIABILITIES: 'Total Liabilities',
} as const;

type NetWorthCardProps = {
  readonly netWorth: NetWorthSummary | null;
  readonly isLoading?: boolean;
};

export function NetWorthCard({ netWorth, isLoading = false }: NetWorthCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-muted animate-pulse h-[120px] mb-6" />
    );
  }

  const currency = netWorth?.currency ?? 'USD';
  const nw = netWorth?.netWorth ?? 0;
  const assets = netWorth?.totalAssets ?? 0;
  const liabilities = netWorth?.totalLiabilities ?? 0;
  const isNegative = nw < 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 mb-6 flex flex-col gap-4">
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {LABELS.NET_WORTH}
          </span>
          <span
            className={`text-3xl font-bold tracking-tight tabular-nums mt-1 ${isNegative ? 'text-destructive' : 'text-foreground'
              }`}
          >
            {formatCurrency(nw, currency)}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs font-medium text-[hsl(var(--chart-4))]">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>{LABELS.UPDATED}</span>
        </div>
      </div>

      {/* Bottom row */}
      <div className="flex items-center gap-4 pt-3 border-t border-border">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{LABELS.TOTAL_ASSETS}</span>
          <span className="text-base font-semibold text-[hsl(var(--chart-4))]">
            {formatCurrency(assets, currency)}
          </span>
        </div>
        <div className="w-px h-8 bg-border" />
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{LABELS.TOTAL_LIABILITIES}</span>
          <span className="text-base font-semibold text-destructive">
            {formatCurrency(liabilities, currency)}
          </span>
        </div>
      </div>
    </div>
  );
}
