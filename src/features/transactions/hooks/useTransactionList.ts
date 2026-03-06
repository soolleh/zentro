import { useEffect, useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTransactionStore } from '@/app/stores/transaction.store';
import { useCurrentUser, useDerivedKey } from '@/app/stores/session.store';
import { useAccountStore } from '@/app/stores/account.store';
import { categoryStorage } from '@/services/storage/category.storage';
import type { TransactionQueryOptions } from '@/shared/types/transaction.types';
import type { Category } from '@/shared/types/category.types';
import type { UUID } from '@/shared/types/common.types';

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

  // Accounts — load on mount if not already loaded
  const accounts = useAccountStore(useShallow((s) => s.accounts));
  const loadAccounts = useAccountStore((s) => s.loadAccounts);

  const hasAccounts = accounts.length > 0;

  // Categories — load once per user session
  const [categoryMap, setCategoryMap] = useState<Map<UUID, Category>>(new Map());

  useEffect(() => {
    if (!currentUser || !derivedKey) return;
    void categoryStorage.listCategoriesByUser(currentUser.id, derivedKey).then((result) => {
      if (result.success) {
        const map = new Map<UUID, Category>();
        for (const cat of result.data) map.set(cat.id as UUID, cat);
        setCategoryMap(map);
      }
    });
  }, [currentUser?.id, derivedKey]);

  // Ensure accounts are loaded when navigating directly to this page
  useEffect(() => {
    if (!currentUser || hasAccounts) return;
    void loadAccounts(currentUser.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, hasAccounts]);

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
    categoryMap,
    accounts,
  };
}
