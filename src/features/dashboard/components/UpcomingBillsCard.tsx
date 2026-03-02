/**
 * UpcomingBillsCard.tsx
 *
 * Dashboard widget — bills due within the next 7 days.
 */

import { useState } from 'react';
import { AlertCircle, Clock, Calendar, CheckCircle2 } from 'lucide-react';
import { DashboardCard } from './DashboardCard';
import { useUpcomingBills } from '@/app/stores/dashboard.store';
import { formatCurrency } from '@/shared/utils/currency.utils';
import type { UpcomingBill } from '@/shared/types/dashboard.types';

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function BillsSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-14 w-full rounded-xl animate-pulse bg-muted" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Due label helper
// ---------------------------------------------------------------------------

function getDueLabel(daysUntilDue: number, isOverdue: boolean): string {
  if (isOverdue) return `Overdue by ${String(Math.abs(daysUntilDue))} day${Math.abs(daysUntilDue) === 1 ? '' : 's'}`;
  if (daysUntilDue === 0) return 'Due today';
  if (daysUntilDue === 1) return 'Due tomorrow';
  return `Due in ${String(daysUntilDue)} days`;
}

function getDueLabelColor(daysUntilDue: number, isOverdue: boolean): string {
  if (isOverdue) return 'text-destructive font-medium';
  if (daysUntilDue === 0) return 'text-amber-600 font-medium';
  return 'text-muted-foreground';
}

// ---------------------------------------------------------------------------
// Urgency icon
// ---------------------------------------------------------------------------

type UrgencyConfig = {
  bg: string;
  Icon: React.ElementType;
  iconClass: string;
};

function getUrgency(daysUntilDue: number, isOverdue: boolean): UrgencyConfig {
  if (isOverdue) {
    return { bg: 'bg-destructive/10', Icon: AlertCircle, iconClass: 'text-destructive' };
  }
  if (daysUntilDue === 0) {
    return { bg: 'bg-amber-100 dark:bg-amber-900/20', Icon: Clock, iconClass: 'text-amber-600' };
  }
  if (daysUntilDue <= 3) {
    return {
      bg: 'bg-[hsl(var(--chart-3)/0.12)]',
      Icon: Calendar,
      iconClass: 'text-[hsl(var(--chart-3))]',
    };
  }
  return { bg: 'bg-muted', Icon: Calendar, iconClass: 'text-muted-foreground' };
}

// ---------------------------------------------------------------------------
// Bill row
// ---------------------------------------------------------------------------

function BillRow({ upcoming }: { upcoming: UpcomingBill }) {
  const [hovered, setHovered] = useState(false);
  const { bill, daysUntilDue, isOverdue } = upcoming;
  const urgency = getUrgency(daysUntilDue, isOverdue);
  const dueLabel = getDueLabel(daysUntilDue, isOverdue);
  const dueLabelColor = getDueLabelColor(daysUntilDue, isOverdue);

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 cursor-pointer transition-all duration-150"
      onMouseEnter={() => { setHovered(true); }}
      onMouseLeave={() => { setHovered(false); }}
    >
      {/* Urgency icon */}
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${urgency.bg}`}
        aria-hidden
      >
        <urgency.Icon className={`w-4 h-4 ${urgency.iconClass}`} />
      </div>

      {/* Center */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{bill.name}</p>
        <p className={`text-xs ${dueLabelColor}`}>{dueLabel}</p>
      </div>

      {/* Right: amount + mark paid */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {formatCurrency(bill.amount, bill.currency)}
        </span>
        {(hovered || typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches) && (
          <button
            type="button"
            className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary transition-all duration-150"
            onClick={(e) => { e.stopPropagation(); }}
            aria-label={`Mark ${bill.name} as paid`}
          >
            Mark paid
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UpcomingBillsCard() {
  const { upcomingBills } = useUpcomingBills();

  return (
    <DashboardCard
      title="Upcoming Bills"
      subtitle="Next 7 days"
      action={{ label: 'View all', href: '/bills' }}
      skeleton={<BillsSkeleton />}
    >
      {upcomingBills.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-4">
          <CheckCircle2 className="w-8 h-8 text-[hsl(var(--chart-4)/0.5)]" aria-hidden />
          <p className="text-xs text-muted-foreground text-center">No bills due this week</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {upcomingBills.map((b) => (
            <BillRow key={b.entry.id} upcoming={b} />
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
