import { useRef, useMemo, useCallback } from 'react';
import { Plus, Upload } from 'lucide-react';
import { useBaseCurrency } from '@/app/preferences.store';
import { useTransactions, useTransactionFilters, useTransactionPanel, useTransactionStore } from '@/app/stores/transaction.store';
import type { Transaction } from '@/shared/types/transaction.types';
import type { UUID } from '@/shared/types/common.types';
import { SlidePanel } from '@/shared/components/SlidePanel';
import { SummaryStrip } from '../components/SummaryStrip';
import { FilterBar } from '../components/FilterBar';
import { TransactionRow } from '../components/TransactionRow';
import { formatGroupDate } from '../utils/transactionFormatters';
import { TransactionDetail } from '../components/TransactionDetail';
import { TransactionForm } from '../components/TransactionForm';
import { CSVImportPanel } from '../components/CSVImportPanel';
import { useTransactionList } from '../hooks/useTransactionList';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

type PanelMode = 'view' | 'add' | 'edit' | 'csv';

type GroupedTransactions = {
  date: string;
  transactions: Transaction[];
  dailyTotal: number;
};

function groupByDate(transactions: Transaction[]): GroupedTransactions[] {
  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const d = tx.date.substring(0, 10);
    if (!groups.has(d)) groups.set(d, []);
    const arr = groups.get(d);
    if (arr) arr.push(tx);
  }
  const result: GroupedTransactions[] = [];
  for (const [date, txs] of groups) {
    const dailyTotal = txs.reduce((sum, tx) => {
      if (tx.type === 'Income') return sum + tx.amount;
      if (tx.type === 'Expense') return sum - tx.amount;
      return sum;
    }, 0);
    result.push({ date, transactions: txs, dailyTotal });
  }
  return result.sort((a, b) => b.date.localeCompare(a.date));
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="w-16 h-16 rounded-full bg-muted/60 flex items-center justify-center">
        <span className="text-3xl leading-none">💸</span>
      </div>
      {hasFilters ? (
        <>
          <p className="text-base font-semibold text-foreground">No matching transactions</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Try adjusting or clearing your filters to see more results.
          </p>
        </>
      ) : (
        <>
          <p className="text-base font-semibold text-foreground">No transactions yet</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Tap the + button to add your first transaction, or import from CSV.
          </p>
        </>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-3 px-4 py-6">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full bg-muted animate-pulse shrink-0" />
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="h-3.5 bg-muted rounded-full animate-pulse w-2/5" />
            <div className="h-3 bg-muted rounded-full animate-pulse w-1/3" />
          </div>
          <div className="h-4 bg-muted rounded-full animate-pulse w-16" />
        </div>
      ))}
    </div>
  );
}

function LoadingMoreDots() {
  return (
    <div className="flex justify-center items-center gap-1.5 py-6">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce"
          style={{ animationDelay: `${(i * 150).toString()}ms` }}
        />
      ))}
    </div>
  );
}

export function TransactionsPage() {
  const { transactions, isLoading, isLoadingMore, totalCount } = useTransactions();
  const { filters, setFilters, clearFilters } = useTransactionFilters();
  const { openPanel, closePanel, isPanelOpen, panelMode, activeTransaction } = useTransactionPanel();
  const loadMore = useTransactionStore((s) => s.loadMore);
  const nextCursor = useTransactionStore((s) => s.nextCursor);

  const { categoryMap, accounts } = useTransactionList();

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.account.id as UUID, a.account])),
    [accounts]
  );

  const hasMore = Boolean(nextCursor);
  const hasFilters = Boolean(
    filters.types?.length ||
    filters.accountIds?.length ||
    filters.categoryIds?.length ||
    filters.search ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.amountMin !== undefined ||
    filters.amountMax !== undefined
  );

  const handleLoadMore = useCallback(() => {
    void loadMore();
  }, [loadMore]);

  const { sentinelRef } = useInfiniteScroll({ onLoadMore: handleLoadMore, hasMore, isLoading: isLoadingMore });

  const grouped = useMemo(() => groupByDate(transactions), [transactions]);

  const containerRef = useRef<HTMLDivElement>(null);

  const activePanelMode = panelMode as PanelMode | undefined;
  const isViewPanel = isPanelOpen && activePanelMode === 'view';
  const isFormPanel = isPanelOpen && (activePanelMode === 'add' || activePanelMode === 'edit');
  const isCsvPanel = isPanelOpen && activePanelMode === 'csv';

  const handleEditFromDetail = () => { if (activeTransaction) openPanel('edit', activeTransaction); };
  const handleClosePanel = () => { closePanel(); };

  const { baseCurrency } = useBaseCurrency();
  const amountFormatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: baseCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div ref={containerRef} className="flex flex-col min-h-full bg-background pb-24">
      {/* Page header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 lg:px-6">
          <div>
            <h1 className="text-xl font-bold text-foreground leading-tight">Transactions</h1>
            {!isLoading && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {totalCount.toString()} total
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { openPanel('csv'); }}
              className="hidden lg:flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-background text-sm font-medium text-foreground hover:bg-muted/50 transition-colors duration-150"
              aria-label="Import CSV"
            >
              <Upload className="w-4 h-4 text-muted-foreground" />
              Import CSV
            </button>
            <button
              type="button"
              onClick={() => { openPanel('add'); }}
              className="hidden lg:flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-150"
              aria-label="Add transaction"
            >
              <Plus className="w-4 h-4" />
              Add transaction
            </button>
          </div>
        </div>

        <div className="px-4 pb-3 lg:px-6">
          <SummaryStrip transactions={transactions} />
        </div>

        <div className="px-4 pb-3 lg:px-6">
          <FilterBar
            filters={filters}
            onFiltersChange={setFilters}
            onClearFilters={clearFilters}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        {isLoading ? (
          <LoadingState />
        ) : transactions.length === 0 ? (
          <EmptyState hasFilters={hasFilters} />
        ) : (
          <div className="flex flex-col">
            {grouped.map((group) => (
              <div key={group.date}>
                <div className="sticky top-[176px] lg:top-[168px] z-10 flex items-center justify-between px-4 lg:px-6 py-2 bg-background/95 backdrop-blur-sm border-b border-border/30">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {formatGroupDate(group.date)}
                  </span>
                  <span className={['text-xs font-semibold tabular-nums', group.dailyTotal >= 0 ? 'text-[hsl(var(--chart-4))]' : 'text-foreground'].join(' ')}>
                    {group.dailyTotal >= 0 ? '+' : ''}
                    {amountFormatter.format(group.dailyTotal)}
                  </span>
                </div>
                <div className="flex flex-col divide-y divide-border/30">
                  {group.transactions.map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      transaction={tx}
                      category={categoryMap.get(tx.categoryId as UUID)}
                      account={accountMap.get(tx.accountId as UUID)}
                      onPress={() => { openPanel('view', tx); }}
                      onDelete={() => { openPanel('view', tx); }}
                      onEdit={() => { openPanel('edit', tx); }}
                    />
                  ))}
                </div>
              </div>
            ))}
            {hasMore && (
              <div ref={sentinelRef}>
                {isLoadingMore && <LoadingMoreDots />}
              </div>
            )}
            {!hasMore && transactions.length > 0 && (
              <div className="flex justify-center py-8">
                <p className="text-xs text-muted-foreground">All transactions loaded</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile FABs */}
      <div className="lg:hidden fixed bottom-20 right-4 z-30 flex flex-col gap-2 items-end">
        <button
          type="button"
          onClick={() => { openPanel('csv'); }}
          className="w-10 h-10 rounded-full bg-card border border-border shadow-md flex items-center justify-center hover:bg-muted/50 transition-all duration-150"
          aria-label="Import CSV"
        >
          <Upload className="w-4 h-4 text-muted-foreground" />
        </button>
        <button
          type="button"
          onClick={() => { openPanel('add'); }}
          className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 flex items-center justify-center hover:bg-primary/90 transition-all duration-150"
          aria-label="Add transaction"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Panels */}
      <SlidePanel open={isViewPanel} onClose={handleClosePanel} size="md">
        {isViewPanel && activeTransaction && (
          <TransactionDetail
            transaction={activeTransaction}
            onClose={handleClosePanel}
            onEdit={handleEditFromDetail}
          />
        )}
      </SlidePanel>

      <SlidePanel open={isFormPanel} onClose={handleClosePanel} size="md">
        {isFormPanel && (
          <TransactionForm
            transaction={activePanelMode === 'edit' ? (activeTransaction ?? undefined) : undefined}
            onClose={handleClosePanel}
          />
        )}
      </SlidePanel>

      <SlidePanel open={isCsvPanel} onClose={handleClosePanel} size="md">
        {isCsvPanel && <CSVImportPanel onClose={handleClosePanel} />}
      </SlidePanel>
    </div>
  );
}
