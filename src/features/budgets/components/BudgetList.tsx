import { useState } from 'react';
import { PiggyBank, History, ArrowUpDown } from 'lucide-react';
import type { BudgetCycleUtilization, EnrichedBudget } from '@/shared/types/budget.types';
import { BudgetRow } from './BudgetRow';
import { useBudgetPanel } from '@/app/stores/budget.store';

type SortKey = 'usage' | 'amount' | 'name';

function sortBudgets(budgets: EnrichedBudget[], key: SortKey): EnrichedBudget[] {
  return [...budgets].sort((a, b) => {
    if (key === 'usage') return b.percentUsed - a.percentUsed;
    if (key === 'amount') return b.effectiveAmount - a.effectiveAmount;
    return a.category.name.localeCompare(b.category.name);
  });
}

const SORT_LABELS: Record<SortKey, string> = {
  usage: 'By usage',
  amount: 'By amount',
  name: 'By name',
};

const SORT_CYCLE: SortKey[] = ['usage', 'amount', 'name'];

type BudgetListProps = {
  readonly cycleUtilization: BudgetCycleUtilization | null;
  readonly isLoading: boolean;
  readonly isCurrentCycle: boolean;
  readonly baseCurrency: string;
};

export function BudgetList({ cycleUtilization, isLoading, isCurrentCycle, baseCurrency }: BudgetListProps) {
  const [sortKey, setSortKey] = useState<SortKey>('usage');
  const { openPanel } = useBudgetPanel();

  const cycleSortIndex = SORT_CYCLE.indexOf(sortKey);
  const handleCycleSort = () => {
    const nextIndex = (cycleSortIndex + 1) % SORT_CYCLE.length;
    setSortKey(SORT_CYCLE[nextIndex] ?? 'usage');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card h-20 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!cycleUtilization || cycleUtilization.budgets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-2xl border-2 border-dashed border-border">
        <PiggyBank className="w-10 h-10 text-muted-foreground/30" />
        {isCurrentCycle ? (
          <>
            <p className="text-base font-medium text-foreground">No budgets set up yet</p>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              Add your first budget category to start tracking.
            </p>
            <button
              type="button"
              onClick={() => { openPanel('add'); }}
              className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all duration-150"
            >
              Add budget
            </button>
          </>
        ) : (
          <>
            <p className="text-base font-medium text-foreground">No budgets for this period</p>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              No budgets were set up for this cycle.
            </p>
          </>
        )}
      </div>
    );
  }

  const sorted = sortBudgets(cycleUtilization.budgets, sortKey);

  return (
    <div>
      {/* Past cycle banner */}
      {!isCurrentCycle && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted/40 border border-border mb-3">
          <History className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Viewing a past cycle. Budget amounts are read-only.
          </span>
        </div>
      )}

      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-foreground">Categories</span>
        <button
          type="button"
          onClick={handleCycleSort}
          className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors duration-150"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          Sort: {SORT_LABELS[sortKey]}
        </button>
      </div>

      {/* Budget rows */}
      <div className="flex flex-col gap-3">
        {sorted.map((eb) => (
          <BudgetRow
            key={eb.budget.id}
            enrichedBudget={eb}
            baseCurrency={baseCurrency}
            isCurrentCycle={isCurrentCycle}
          />
        ))}
      </div>
    </div>
  );
}
