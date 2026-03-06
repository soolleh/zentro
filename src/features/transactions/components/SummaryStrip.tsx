import { useMemo } from 'react';
import type { Transaction } from '@/shared/types/transaction.types';
import {
  startOfMonth,
  endOfMonth,
  parseISO,
  isWithinInterval,
} from 'date-fns';
import { useBaseCurrency } from '@/app/preferences.store';
import { formatCurrency } from '@/shared/utils/currency.utils';

type SummaryStripProps = {
  transactions: Transaction[];
};

export function SummaryStrip({ transactions }: SummaryStripProps) {
  const { baseCurrency } = useBaseCurrency();
  const { income, expenses, net } = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);

    let inc = 0;
    let exp = 0;

    for (const tx of transactions) {
      let date: Date;
      try {
        date = parseISO(tx.date);
      } catch {
        continue;
      }
      if (!isWithinInterval(date, { start, end })) continue;
      if (tx.type === 'Income') inc += tx.amount;
      else if (tx.type === 'Expense') exp += tx.amount;
    }

    return { income: inc, expenses: exp, net: inc - exp };
  }, [transactions]);

  return (
    <div className="flex gap-3 px-4 overflow-x-auto scrollbar-none py-2">
      {/* Income */}
      <div className="flex flex-col gap-0.5 shrink-0 px-4 py-2.5 rounded-xl border border-border bg-card min-w-[120px]">
        <span className="text-xs text-muted-foreground">Income</span>
        <span className="text-base font-semibold text-[hsl(var(--chart-4))]">
          +{formatCurrency(income, baseCurrency)}
        </span>
      </div>
      {/* Expenses */}
      <div className="flex flex-col gap-0.5 shrink-0 px-4 py-2.5 rounded-xl border border-border bg-card min-w-[120px]">
        <span className="text-xs text-muted-foreground">Expenses</span>
        <span className="text-base font-semibold text-destructive">
          {formatCurrency(expenses, baseCurrency)}
        </span>
      </div>
      {/* Net */}
      <div className="flex flex-col gap-0.5 shrink-0 px-4 py-2.5 rounded-xl border border-border bg-card min-w-[120px]">
        <span className="text-xs text-muted-foreground">Net</span>
        <span
          className={`text-base font-semibold ${net >= 0 ? 'text-[hsl(var(--chart-4))]' : 'text-destructive'}`}
        >
          {net >= 0 ? `+${formatCurrency(net, baseCurrency)}` : `-${formatCurrency(Math.abs(net), baseCurrency)}`}
        </span>
      </div>
    </div>
  );
}
