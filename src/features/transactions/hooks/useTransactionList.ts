import { useEffect, useCallback } from 'react';
import { useTransactionStore } from '@/app/stores/transaction.store';
import { useCurrentUser, useDerivedKey } from '@/app/stores/session.store';
import type { TransactionQueryOptions } from '@/shared/types/transaction.types';

/**
 * Initializes the transaction store for the current user and provides
 * convenience functions for filter management.
 */
export function useTransactionList() {
  const currentUser = useCurrentUser();
  const derivedKey = useDerivedKey();
  const loadTransactions = useTransactionStore((s) => s.loadTransactions);
  const setFilters = useTransactionStore((s) => s.setFilters);
  const clearFilters = useTransactionStore((s) => s.clearFilters);
  const filters = useTransactionStore((s) => s.filters);
  const isLoading = useTransactionStore((s) => s.isLoading);
  const isLoadingMore = useTransactionStore((s) => s.isLoadingMore);
  const transactions = useTransactionStore((s) => s.transactions);
  const nextCursor = useTransactionStore((s) => s.nextCursor);
  const totalCount = useTransactionStore((s) => s.totalCount);
  const loadMore = useTransactionStore((s) => s.loadMore);

  useEffect(() => {
    if (!currentUser || !derivedKey) return;
    const initial: TransactionQueryOptions = {
      userId: currentUser.id,
      limit: 30,
      sortBy: 'date',
      sortOrder: 'desc',
    };
    void loadTransactions(initial);
    // Only run when user/key changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, derivedKey]);

  const updateFilters = useCallback(
    (partial: Partial<TransactionQueryOptions>) => {
      if (!currentUser) return;
      setFilters({ ...partial, userId: currentUser.id });
    },
    [currentUser, setFilters]
  );

  return {
    transactions,
    isLoading,
    isLoadingMore,
    totalCount,
    nextCursor,
    filters,
    updateFilters,
    clearFilters,
    loadMore,
    userId: currentUser?.id,
  };
}
