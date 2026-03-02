/**
 * RecentTransactionsCard.tsx
 *
 * Dashboard widget — last 5 transactions.
 */

import { ReceiptText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DashboardCard } from './DashboardCard';
import { TransactionRow } from '@/features/transactions/components/TransactionRow';
import { useRecentTransactions } from '@/app/stores/dashboard.store';
import { useAccounts } from '@/app/stores/account.store';
import { useTransactionPanel, useTransactionStore } from '@/app/stores/transaction.store';
import type { Transaction } from '@/shared/types/transaction.types';
import type { Category } from '@/shared/types/category.types';
import type { Account } from '@/shared/types/account.types';

// ---------------------------------------------------------------------------
// Skeleton row
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <div className="w-10 h-10 rounded-full animate-pulse bg-muted shrink-0" />
      <div className="flex flex-col gap-1.5 flex-1">
        <div className="h-3 w-24 rounded animate-pulse bg-muted" />
        <div className="h-2.5 w-16 rounded animate-pulse bg-muted" />
      </div>
      <div className="h-3 w-14 rounded animate-pulse bg-muted" />
    </div>
  );
}

function TransactionsSkeleton() {
  return (
    <div className="-mx-5 divide-y divide-border">
      {[1, 2, 3, 4, 5].map((i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecentTransactionsCard() {
  const { recentTransactions, categories } = useRecentTransactions();
  const { accounts, isLoading } = useAccounts();
  const { openPanel } = useTransactionPanel();
  const setActiveTransaction = useTransactionStore((s) => s.setActiveTransaction);
  const navigate = useNavigate();

  const categoryMap = new Map<string, Category>(categories.map((c) => [c.id, c]));
  const accountMap = new Map<string, Account>(accounts.map((a) => [a.account.id, a.account]));

  function handlePress(tx: Transaction) {
    setActiveTransaction(tx);
    openPanel('view');
    void navigate('/transactions');
  }

  function handleEdit(tx: Transaction) {
    setActiveTransaction(tx);
    openPanel('edit');
    void navigate('/transactions');
  }

  return (
    <DashboardCard
      title="Recent Transactions"
      subtitle="Last 5"
      action={{ label: 'View all', href: '/transactions' }}
      isLoading={isLoading}
      skeleton={<TransactionsSkeleton />}
    >
      {recentTransactions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 mx-5">
          <ReceiptText className="w-8 h-8 text-muted-foreground/30" aria-hidden />
          <p className="text-xs text-muted-foreground text-center">
            No transactions yet. Add one to start tracking.
          </p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border -mx-5">
          {recentTransactions.map((tx) => (
            <TransactionRow
              key={tx.id}
              transaction={tx}
              category={categoryMap.get(tx.categoryId)}
              account={accountMap.get(tx.accountId)}
              onPress={() => { handlePress(tx); }}
              onEdit={() => { handleEdit(tx); }}
              onDelete={() => { /* no-op on dashboard */ }}
            />
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
