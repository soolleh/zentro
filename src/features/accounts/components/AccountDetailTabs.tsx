/**
 * AccountDetailTabs.tsx
 *
 * Three-tab navigation inside AccountDetail:
 *   Transactions | Reconcile | Info
 */

import { useState } from 'react';
import type { Account, AccountWithBalance } from '@/shared/types/account.types';
import { ScopedTransactionList } from './ScopedTransactionList';
import { ReconcileTab } from './ReconcileTab';
import { AccountInfoTab } from './AccountInfoTab';

type Tab = 'transactions' | 'reconcile' | 'info';

const TABS: { id: Tab; label: string }[] = [
  { id: 'transactions', label: 'Transactions' },
  { id: 'reconcile', label: 'Reconcile' },
  { id: 'info', label: 'Info' },
];

type AccountDetailTabsProps = {
  readonly row: AccountWithBalance;
  readonly onDeleteRequest: (account: Account) => void;
};

export function AccountDetailTabs({ row, onDeleteRequest }: AccountDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('transactions');

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Tab header */}
      <div className="flex border-b border-border px-6 shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => { setActiveTab(tab.id); }}
            className={`py-3 px-1 mr-6 text-sm font-medium transition-colors duration-150 border-b-2 -mb-px ${activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === 'transactions' && (
          <ScopedTransactionList accountId={row.account.id} account={row.account} />
        )}
        {activeTab === 'reconcile' && (
          <ReconcileTab
            accountId={row.account.id}
            account={row.account}
            currentBalance={row.currentBalance}
            onReconcileComplete={() => { setActiveTab('transactions'); }}
          />
        )}
        {activeTab === 'info' && (
          <AccountInfoTab row={row} onDeleteRequest={onDeleteRequest} />
        )}
      </div>
    </div>
  );
}
