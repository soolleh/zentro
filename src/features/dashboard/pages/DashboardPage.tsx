/**
 * DashboardPage.tsx
 *
 * Main authenticated landing page. Bento-style grid layout.
 * All widgets are real-time computed from IndexedDB.
 */

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useCurrentUser } from '@/app/session.store';
import { useLastRefreshed } from '@/app/stores/dashboard.store';
import { useGreeting } from '@/features/dashboard/hooks/useGreeting';
import { useDashboardData } from '@/features/dashboard/hooks/useDashboardData';
import { NetWorthCard } from '@/features/dashboard/components/NetWorthCard';
import { IncomeExpenseCard } from '@/features/dashboard/components/IncomeExpenseCard';
import { SavingsRateCard } from '@/features/dashboard/components/SavingsRateCard';
import { BudgetUtilizationCard } from '@/features/dashboard/components/BudgetUtilizationCard';
import { RecentTransactionsCard } from '@/features/dashboard/components/RecentTransactionsCard';
import { UpcomingBillsCard } from '@/features/dashboard/components/UpcomingBillsCard';
import { GoalProgressCard } from '@/features/dashboard/components/GoalProgressCard';
import { InsightsCard } from '@/features/dashboard/components/InsightsCard';
import { QuickAddFAB } from '@/features/dashboard/components/QuickAddFAB';

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  try {
    const dist = formatDistanceToNow(new Date(iso), { addSuffix: false });
    return dist === 'less than a minute' ? 'just now' : `${dist} ago`;
  } catch {
    return '—';
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function DashboardPage() {
  const currentUser = useCurrentUser();
  const { lastRefreshedAt, refresh } = useLastRefreshed();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load dashboard data on mount
  useDashboardData();

  const { greeting, dateLabel } = useGreeting(currentUser?.displayName ?? 'there');

  async function handleRefresh() {
    if (!currentUser || isRefreshing) return;
    setIsRefreshing(true);
    await refresh(currentUser.id);
    setIsRefreshing(false);
  }

  return (
    <div className="px-4 pt-6 pb-24 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{greeting}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{dateLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => { void handleRefresh(); }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors duration-150"
          aria-label="Refresh dashboard"
          disabled={isRefreshing}
        >
          <RefreshCw
            className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`}
            aria-hidden
          />
          <span>Updated {formatRelative(lastRefreshedAt)}</span>
        </button>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-5">
        {/* Net worth — full mobile; col-span-2 tablet+desktop */}
        <div className="col-span-1 sm:col-span-2">
          <NetWorthCard />
        </div>

        {/* Income vs expense — full mobile; col-span-2 tablet; col-span-1 desktop */}
        <div className="col-span-1 sm:col-span-2 lg:col-span-1">
          <IncomeExpenseCard />
        </div>

        {/* Savings rate — col-span-1 everywhere */}
        <div className="col-span-1">
          <SavingsRateCard />
        </div>

        {/* Budget utilization — col-span-1 everywhere */}
        <div className="col-span-1">
          <BudgetUtilizationCard />
        </div>

        {/* Recent transactions — full mobile; col-span-2 tablet+desktop */}
        <div className="col-span-1 sm:col-span-2">
          <RecentTransactionsCard />
        </div>

        {/* Upcoming bills — col-span-1 everywhere */}
        <div className="col-span-1">
          <UpcomingBillsCard />
        </div>

        {/* Goal progress — full mobile; col-span-2 tablet+desktop */}
        <div className="col-span-1 sm:col-span-2">
          <GoalProgressCard />
        </div>

        {/* Insights — full mobile; col-span-2 tablet; col-span-3 desktop */}
        <div className="col-span-1 sm:col-span-2 lg:col-span-3">
          <InsightsCard />
        </div>
      </div>

      {/* Mobile/tablet FAB */}
      <QuickAddFAB />
    </div>
  );
}
