import { AlertTriangle, X } from 'lucide-react';
import type { BudgetCycleUtilization } from '@/shared/types/budget.types';

type OverspendAlertProps = {
  readonly cycleUtilization: BudgetCycleUtilization;
  readonly onDismiss: () => void;
};

export function OverspendAlert({ cycleUtilization, onDismiss }: OverspendAlertProps) {
  const overBudgetItems = cycleUtilization.budgets.filter((b) => b.isOverBudget);
  const count = overBudgetItems.length;
  if (count === 0) return null;

  const first3 = overBudgetItems.slice(0, 3).map((b) => b.category.name);
  const remaining = count - 3;

  let categoryList: string;
  if (first3.length === 1) {
    categoryList = first3[0] ?? '';
  } else if (first3.length === 2) {
    categoryList = `${first3[0] ?? ''} and ${first3[1] ?? ''}`;
  } else {
    const joined = first3.join(', ');
    categoryList = remaining > 0 ? `${joined}, and ${String(remaining)} more` : joined;
  }

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3 mb-4 animate-in fade-in-0 slide-in-from-top-2 duration-200">
      <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-4 h-4 text-destructive" />
      </div>
      <div className="flex flex-col gap-1 flex-1">
        <p className="text-sm font-semibold text-foreground">
          {String(count)} budget{count !== 1 ? 's' : ''} exceeded this month
        </p>
        <p className="text-xs text-muted-foreground">
          {"You've overspent on "}{categoryList}.
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-destructive/10 cursor-pointer transition-all duration-150"
        aria-label="Dismiss alert"
      >
        <X className="w-3.5 h-3.5 text-destructive" />
      </button>
    </div>
  );
}
