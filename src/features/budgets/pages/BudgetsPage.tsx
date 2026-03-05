import { useEffect, useState } from 'react';
import { Plus, List, BarChart2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useBudgetStore, useBudgetCycle, useBudgetPanel } from '@/app/stores/budget.store';
import { useCurrentUser } from '@/app/stores/session.store';
import { useBaseCurrency, usePreferencesStore } from '@/app/preferences.store';
import { MonthNavigator } from '../components/MonthNavigator';
import { BudgetHero } from '../components/BudgetHero';
import { OverspendAlert } from '../components/OverspendAlert';
import { BudgetList } from '../components/BudgetList';
import { BudgetForm } from '../components/BudgetForm';
import { AnalyticsTab } from './AnalyticsTab';

type MainTab = 'list' | 'analytics';

export function BudgetsPage() {
  const currentUser = useCurrentUser();
  const { baseCurrency } = useBaseCurrency();
  const budgetCycleStartDay = usePreferencesStore((s) => s.budgetCycleStartDay);
  const { cycleUtilization, isLoading, isCurrentCycle } = useBudgetCycle();
  const { openPanel } = useBudgetPanel();
  const { currentCycleStart, viewingCycleStart, initBudgets } = useBudgetStore(
    useShallow((s) => ({
      currentCycleStart: s.currentCycleStart,
      viewingCycleStart: s.viewingCycleStart,
      initBudgets: s.initBudgets,
    }))
  );

  const [activeTab, setActiveTab] = useState<MainTab>('list');
  const [overspendDismissed, setOverspendDismissed] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    void initBudgets(currentUser.id, budgetCycleStartDay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, budgetCycleStartDay]);

  useEffect(() => {
    setOverspendDismissed(false);
  }, [cycleUtilization?.cycleStart]);

  const showOverspendAlert =
    !overspendDismissed &&
    cycleUtilization !== null &&
    cycleUtilization.hasOverspend;

  return (
    <div className="px-4 pt-6 pb-24 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="max-w-3xl mx-auto">
        {/* Page header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Budgets</h1>
          <div className="hidden lg:block">
            {isCurrentCycle && activeTab === 'list' && (
              <button
                type="button"
                onClick={() => { openPanel('add'); }}
                className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all duration-150"
              >
                <Plus className="w-4 h-4" />
                Add budget
              </button>
            )}
          </div>
        </div>

        {/* Month navigator */}
        {currentUser !== null && (
          <MonthNavigator
            userId={currentUser.id}
            currentCycleStart={currentCycleStart}
            isCurrentCycle={isCurrentCycle}
          />
        )}

        {/* Main tab bar */}
        <div className="flex border-b border-border mb-5">
          <MainTabButton
            label="Budget List"
            Icon={List}
            active={activeTab === 'list'}
            onClick={() => { setActiveTab('list'); }}
          />
          <MainTabButton
            label="Analytics"
            Icon={BarChart2}
            active={activeTab === 'analytics'}
            onClick={() => { setActiveTab('analytics'); }}
          />
        </div>

        {/* List tab content */}
        {activeTab === 'list' && (
          <>
            {/* Hero */}
            {cycleUtilization !== null && (
              <BudgetHero cycleUtilization={cycleUtilization} />
            )}

            {/* Overspend alert */}
            {showOverspendAlert && (
              <OverspendAlert
                cycleUtilization={cycleUtilization}
                onDismiss={() => { setOverspendDismissed(true); }}
              />
            )}

            {/* Budget list */}
            <BudgetList
              cycleUtilization={cycleUtilization}
              isLoading={isLoading}
              isCurrentCycle={isCurrentCycle}
              baseCurrency={baseCurrency}
            />
          </>
        )}

        {/* Analytics tab content */}
        {activeTab === 'analytics' && (
          <AnalyticsTab cycleStart={viewingCycleStart} />
        )}
      </div>

      {/* Mobile / tablet FAB — list tab only */}
      {isCurrentCycle && activeTab === 'list' && (
        <button
          type="button"
          onClick={() => { openPanel('add'); }}
          className="lg:hidden fixed bottom-24 right-5 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all duration-150 z-20"
          aria-label="Add budget"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      <BudgetForm />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: main tab button
// ---------------------------------------------------------------------------
type MainTabButtonProps = {
  readonly label: string;
  readonly Icon: React.ComponentType<{ className?: string }>;
  readonly active: boolean;
  readonly onClick: () => void;
};

function MainTabButton({ label, Icon, active, onClick }: MainTabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
        }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
