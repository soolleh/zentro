import { AlertCircle, CheckCircle2, Clock, TrendingDown } from 'lucide-react';
import { useBillStore } from '@/app/stores/bill.store';
import { usePreferencesStore } from '@/app/preferences.store';

const LABEL = {
  totalDue: 'Total Due',
  paid: 'Paid',
  pending: 'Pending',
  overdue: 'Overdue',
} as const;

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function BillsSummaryStrip() {
  const summary = useBillStore((s) => s.summary);
  const baseCurrency = usePreferencesStore((s) => s.baseCurrency);

  if (!summary) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  const tiles = [
    {
      label: LABEL.totalDue,
      value: formatAmount(summary.totalDueThisMonth, baseCurrency),
      icon: TrendingDown,
      iconClass: 'text-muted-foreground',
      valueClass: 'text-foreground',
    },
    {
      label: LABEL.paid,
      value: String(summary.paidCount),
      icon: CheckCircle2,
      iconClass: 'text-chart-4',
      valueClass: 'text-chart-4',
    },
    {
      label: LABEL.pending,
      value: String(summary.pendingCount),
      icon: Clock,
      iconClass: 'text-primary',
      valueClass: 'text-foreground',
    },
    {
      label: LABEL.overdue,
      value: String(summary.overdueCount),
      icon: AlertCircle,
      iconClass: summary.overdueCount > 0 ? 'text-destructive' : 'text-muted-foreground',
      valueClass: summary.overdueCount > 0 ? 'text-destructive font-semibold' : 'text-muted-foreground',
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <div
            key={tile.label}
            className="flex flex-col gap-2 p-4 rounded-xl bg-card border border-border shadow-sm"
          >
            <div className="flex items-center gap-2">
              <Icon size={16} className={tile.iconClass} aria-hidden="true" />
              <span className="text-xs text-muted-foreground font-medium">{tile.label}</span>
            </div>
            <span className={`text-xl font-bold leading-none ${tile.valueClass}`}>
              {tile.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
