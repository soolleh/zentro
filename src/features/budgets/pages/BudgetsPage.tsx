import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useBudgetStore, useBudgetCycle, useBudgetPanel } from '@/app/stores/budget.store';
import { useCurrentUser } from '@/app/stores/session.store';
import { useBaseCurrency, usePreferencesStore } from '@/app/preferences.store';
import { MonthNavigator } from '../components/MonthNavigator';
import { BudgetHero } from '../components/BudgetHero';
import { OverspendAlert } from '../components/OverspendAlert';
import { BudgetList } from '../components/BudgetList';
import { BudgetForm } from '../components/BudgetForm';

export function BudgetsPage() {
  const currentUser = useCurrentUser();
  const { baseCurrency } = useBaseCurrency();
  const budgetCycleStartDay = usePreferencesStore((s) => s.budgetCycleStartDay);
  const { cycleUtilization, isLoading, isCurrentCycle } = useBudgetCycle();
  const { openPanel } = useBudgetPanel();
  const { currentCycleStart, initBudgets } = useBudgetStore(
    useShallow((s) => ({
      currentCycleStart: s.currentCycleStart,
      initBudgets: s.initBudgets,
    }))
  );

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
            {isCurrentCycle && (
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
      </div>

      {/* Mobile / tablet FAB */}
      {isCurrentCycle && (
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
