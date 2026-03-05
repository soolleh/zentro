import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import type { EnrichedBudget } from '@/shared/types/budget.types';
import { formatCurrency } from '@/shared/utils/currency.utils';

type BudgetRowExpandedProps = {
  readonly enrichedBudget: EnrichedBudget;
  readonly baseCurrency: string;
  readonly maxTransactions?: number;
};

export function BudgetRowExpanded({
  enrichedBudget,
  baseCurrency,
  maxTransactions = 3,
}: BudgetRowExpandedProps) {
  const navigate = useNavigate();
  const { transactions, category, budget } = enrichedBudget;

  const recentTx = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, maxTransactions);

  const totalCount = transactions.length;

  const handleViewAll = () => {
    void navigate(`/transactions?categoryId=${budget.categoryId}`);
  };

  return (
    <div className="border-t border-border/50 px-4 pt-3 pb-4 animate-in slide-in-from-top-1 duration-200">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Recent transactions
      </p>
      {recentTx.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1">No transactions yet this cycle.</p>
      ) : (
        <div className="flex flex-col gap-2 mb-3">
          {recentTx.map((tx) => (
            <div key={tx.id} className="flex items-center gap-2 py-1">
              <span className="text-xs text-muted-foreground w-16 shrink-0">
                {format(parseISO(tx.date), 'MMM d')}
              </span>
              <span className="text-xs text-foreground flex-1 truncate">
                {tx.notes !== undefined && tx.notes.length > 0 ? tx.notes : category.name}
              </span>
              <span className="text-xs font-semibold tabular-nums text-destructive">
                {formatCurrency(tx.amount, baseCurrency)}
              </span>
            </div>
          ))}
        </div>
      )}
      {totalCount > 0 && (
        <button
          type="button"
          onClick={handleViewAll}
          className="text-xs text-primary font-medium hover:underline underline-offset-4 cursor-pointer"
        >
          View all {String(totalCount)} transaction{totalCount !== 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
}
