import { useEffect } from 'react';
import { BarChart2, TrendingUp, GitCompare } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import {
  useBudgetStore,
  useBudgetAnalytics,
  useHealthScore,
  useAnalyticsTab,
  useDrillDown,
} from '@/app/stores/budget.store';
import { useCurrentUser } from '@/app/stores/session.store';
import { useBaseCurrency } from '@/app/preferences.store';
import { formatCycleLabel } from '@/services/budgets/budget-analytics.service';
import type { ISODateString, UUID } from '@/shared/types/common.types';
import { HealthScoreCard } from '../components/analytics/HealthScoreCard';
import { BudgetVsActualChart } from '../components/analytics/BudgetVsActualChart';
import { CycleComparisonChart } from '../components/analytics/CycleComparisonChart';
import { SpendingTrendsChart } from '../components/analytics/SpendingTrendsChart';
import { CategoryDrillDownPanel } from '../components/analytics/CategoryDrillDownPanel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type AnalyticsTabProps = {
  readonly cycleStart: ISODateString;
};

// ---------------------------------------------------------------------------
// Sub-tab config
// ---------------------------------------------------------------------------
const SUB_TABS = [
  { id: 'overview' as const, label: 'Overview', Icon: BarChart2 },
  { id: 'trends' as const, label: 'Trends', Icon: TrendingUp },
  { id: 'comparison' as const, label: 'Comparison', Icon: GitCompare },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function AnalyticsTab({ cycleStart }: AnalyticsTabProps) {
  const currentUser = useCurrentUser();
  const { baseCurrency } = useBaseCurrency();
  const cycleLabel = formatCycleLabel(cycleStart);

  const { analyticsTab, setAnalyticsTab } = useAnalyticsTab();
  const { healthScore, isHealthScoreLoading } = useHealthScore();
  const { budgetVsActual, cycleComparison, categoryTrends, isAnalyticsLoading } = useBudgetAnalytics();
  const { openDrillDown } = useDrillDown();

  const { loadAnalytics, loadHealthScore, loadCategoryTrends } = useBudgetStore(
    useShallow((s) => ({
      loadAnalytics: s.loadAnalytics,
      loadHealthScore: s.loadHealthScore,
      loadCategoryTrends: s.loadCategoryTrends,
    }))
  );

  // Load analytics data when cycleStart / user changes
  useEffect(() => {
    if (!currentUser) return;
    void loadAnalytics(currentUser.id, cycleStart);
    void loadHealthScore(currentUser.id, cycleStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, cycleStart]);

  const handleOpenDrillDown = (categoryId: UUID) => {
    if (!currentUser) return;
    void openDrillDown(currentUser.id, categoryId, cycleStart);
  };

  const handleMonthsChange = (months: number) => {
    if (!currentUser) return;
    void loadCategoryTrends(currentUser.id, months);
  };

  // historicalCycleCount: use cycle comparison length as proxy for how many
  // historical cycles exist in the data set
  const historicalCycleCount = cycleComparison.length;

  return (
    <div className="flex flex-col gap-6">
      {/* Health score card — always visible at top */}
      <HealthScoreCard
        score={healthScore}
        isLoading={isHealthScoreLoading}
        historicalCycleCount={historicalCycleCount}
      />

      {/* Sub-tab navigation */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted w-fit self-start" role="tablist" aria-label="Analytics views">
        {SUB_TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={analyticsTab === id}
            aria-controls={`analytics-panel-${id}`}
            onClick={() => { setAnalyticsTab(id); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${analyticsTab === id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div
        id={`analytics-panel-overview`}
        role="tabpanel"
        aria-labelledby="tab-overview"
        hidden={analyticsTab !== 'overview'}
      >
        {analyticsTab === 'overview' && currentUser !== null && (
          <BudgetVsActualChart
            data={budgetVsActual}
            isLoading={isAnalyticsLoading}
            currency={baseCurrency}
            cycleLabel={cycleLabel}
            userId={currentUser.id}
            cycleStart={cycleStart}
            onOpenDrillDown={handleOpenDrillDown}
          />
        )}
      </div>

      <div
        id={`analytics-panel-trends`}
        role="tabpanel"
        aria-labelledby="tab-trends"
        hidden={analyticsTab !== 'trends'}
      >
        {analyticsTab === 'trends' && currentUser !== null && (
          <SpendingTrendsChart
            data={categoryTrends}
            isLoading={isAnalyticsLoading}
            currency={baseCurrency}
            userId={currentUser.id}
            onMonthsChange={handleMonthsChange}
            onOpenDrillDown={handleOpenDrillDown}
          />
        )}
      </div>

      <div
        id={`analytics-panel-comparison`}
        role="tabpanel"
        aria-labelledby="tab-comparison"
        hidden={analyticsTab !== 'comparison'}
      >
        {analyticsTab === 'comparison' && (
          <CycleComparisonChart
            data={cycleComparison}
            isLoading={isAnalyticsLoading}
            currency={baseCurrency}
          />
        )}
      </div>

      {/* Drill-down panel — rendered at this level so it overlays the tab */}
      <CategoryDrillDownPanel
        currency={baseCurrency}
        cycleLabel={cycleLabel}
      />
    </div>
  );
}
