/**
 * ScopedTransactionList.tsx
 *
 * Filtered list of transactions scoped to a single account.
 * Reuses TransactionRow from the transactions feature.
 * Includes type filter, search, and "Load more" pagination.
 */

import { useState, useEffect, useCallback } from 'react';
import { ReceiptText, Search } from 'lucide-react';
import type { UUID } from '@/shared/types/common.types';
import type { Transaction, TransactionType } from '@/shared/types/transaction.types';
import type { Account } from '@/shared/types/account.types';
import type { Category } from '@/shared/types/category.types';
import { transactionStorage } from '@/services/storage/transaction.storage';
import { categoryStorage } from '@/services/storage/category.storage';
import { useDerivedKey, useCurrentUser } from '@/app/stores/session.store';
import { TransactionRow } from '@/features/transactions/components/TransactionRow';

const PAGE_SIZE = 20;

const TYPE_FILTERS: { value: TransactionType | 'All'; label: string }[] = [
  { value: 'All', label: 'All' },
  { value: 'Income', label: 'Income' },
  { value: 'Expense', label: 'Expense' },
  { value: 'Transfer', label: 'Transfer' },
];

const LABELS = {
  EMPTY: 'No transactions for this account',
  LOAD_MORE: 'Load more',
  LOADING_MORE: 'Loading…',
  SEARCH_PLACEHOLDER: 'Search transactions…',
} as const;

type ScopedTransactionListProps = {
  readonly accountId: UUID;
  readonly account: Account;
};

export function ScopedTransactionList({ accountId, account }: ScopedTransactionListProps) {
  const derivedKey = useDerivedKey();
  const currentUser = useCurrentUser();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Map<UUID, Category>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<UUID | null>(null);
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'All'>('All');
  const [search, setSearch] = useState('');
  const [tick, setTick] = useState(0);

  // Load categories once
  useEffect(() => {
    if (!derivedKey || !currentUser) return;
    void categoryStorage.listCategoriesByUser(currentUser.id, derivedKey).then((result) => {
      if (result.success) {
        const map = new Map<UUID, Category>();
        for (const cat of result.data) map.set(cat.id, cat);
        setCategories(map);
      }
    });
  }, [derivedKey, currentUser]);

  const loadPage = useCallback(
    async (reset: boolean) => {
      if (!derivedKey) return;
      setIsLoading(true);
      const result = await transactionStorage.listTransactionsByAccount(
        accountId,
        {
          limit: PAGE_SIZE,
          cursor: reset ? undefined : (cursor ?? undefined),
          types: typeFilter === 'All' ? undefined : [typeFilter],
          search: search.trim() || undefined,
          sortBy: 'date',
          sortOrder: 'desc',
        },
        derivedKey
      );
      setIsLoading(false);
      if (!result.success) return;
      const { transactions: newTxs, nextCursor } = result.data;
      if (reset) {
        setTransactions(newTxs);
      } else {
        setTransactions((prev) => [...prev, ...newTxs]);
      }
      setCursor(nextCursor);
      setHasMore(nextCursor !== null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accountId, derivedKey, typeFilter, search, tick]
  );

  // Reset and reload when filters change
  useEffect(() => {
    void loadPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, derivedKey, typeFilter, search, tick]);

  const handleLoadMore = () => {
    void loadPage(false);
  };

  // Group by date
  const grouped: { date: string; transactions: Transaction[] }[] = [];
  for (const tx of transactions) {
    const d = tx.date.slice(0, 10);
    const last = grouped.at(-1);
    if (last?.date === d) {
      last.transactions.push(tx);
    } else {
      grouped.push({ date: d, transactions: [tx] });
    }
  }

  return (
    <div className="flex flex-col">
      {/* Filter row */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); }}
            placeholder={LABELS.SEARCH_PLACEHOLDER}
            className="h-7 w-full pl-8 pr-3 text-xs rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Type segmented control */}
        <div className="flex items-center h-7 rounded-lg bg-muted overflow-hidden shrink-0">
          {TYPE_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => { setTypeFilter(value); }}
              className={`h-full px-2 text-xs font-medium transition-colors duration-150 ${typeFilter === value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div>
        {grouped.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
            <ReceiptText className="w-8 h-8 text-muted-foreground/30" />
            <span className="text-sm text-muted-foreground">{LABELS.EMPTY}</span>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.date}>
              <div className="px-4 py-2 bg-muted/30 border-b border-border/50">
                <span className="text-xs font-semibold text-muted-foreground">
                  {new Date(`${group.date}T00:00:00`).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
              {group.transactions.map((tx) => {
                const cat = categories.get(tx.categoryId);
                const parentCat = cat?.parentId ? categories.get(cat.parentId) : undefined;
                return (
                  <TransactionRow
                    key={tx.id}
                    transaction={tx}
                    category={cat}
                    parentCategory={parentCat}
                    account={account}
                    onPress={() => { /* detail handled by parent */ }}
                    onEdit={() => { /* edit via parent panel */ }}
                    onDelete={() => {
                      // Refresh list after delete
                      setTick((t) => t + 1);
                    }}
                  />
                );
              })}
            </div>
          ))
        )}

        {hasMore && (
          <div className="px-4 py-3 flex justify-center">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isLoading}
              className="text-sm text-primary font-medium hover:text-primary/80 transition-colors duration-150 disabled:opacity-50"
            >
              {isLoading ? LABELS.LOADING_MORE : LABELS.LOAD_MORE}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
