/**
 * DashboardPage.tsx
 *
 * Main authenticated landing page. Bento-style grid layout.
 * All widgets are real-time computed from IndexedDB.
 */

import { useState } from 'react';
import { RefreshCw, LayoutTemplate } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
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
import { QuickUsePanel } from '@/features/templates/components/QuickUsePanel';
import { useRecentTemplates, useQuickUsePanel, useTemplateStore } from '@/app/stores/template.store';
import { ROUTES } from '@/app/routes.constants';

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
  const navigate = useNavigate();

  // Load dashboard data on mount
  useDashboardData();

  const { greeting, dateLabel } = useGreeting(currentUser?.displayName ?? 'there');

  // Templates
  const recentTemplates = useRecentTemplates(5);
  const totalTemplates = useTemplateStore((s) => s.templates.length);
  const isQuickUsePanelOpen = useTemplateStore((s) => s.isQuickUsePanelOpen);
  const { openQuickUsePanel } = useQuickUsePanel();

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

      {/* Recent Templates strip */}
      {recentTemplates.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 mb-4">
          {recentTemplates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => { openQuickUsePanel(template); }}
              className="flex items-center gap-2 shrink-0 h-9 px-3 rounded-xl border border-border bg-card text-sm cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all duration-150 active:scale-[0.98]"
            >
              <span className="text-base" aria-hidden>{template.emoji}</span>
              <span className="text-xs font-medium text-foreground">{template.name}</span>
              {template.amount !== null && (
                <span className="text-xs text-muted-foreground">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: template.currency,
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }).format(template.amount)}
                </span>
              )}
            </button>
          ))}
          {totalTemplates > 5 && (
            <button
              type="button"
              onClick={() => { void navigate(ROUTES.TEMPLATES); }}
              className="flex items-center gap-1 shrink-0 h-9 px-3 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              <LayoutTemplate className="w-3.5 h-3.5" aria-hidden />
              More
            </button>
          )}
        </div>
      )}

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

      {/* Template quick-use panel */}
      <QuickUsePanel open={isQuickUsePanelOpen} />
    </div>
  );
}
