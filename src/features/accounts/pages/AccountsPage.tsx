/**
 * AccountsPage.tsx
 *
 * Main page for the Accounts module.
 * Renders net worth summary, grouped account cards (assets / liabilities),
 * and manages all account-related panels and dialogs.
 */

import { useEffect, useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import {
  useAccounts,
  useNetWorth,
  useAccountPanel,
  useAssets,
  useLiabilities,
  useAccountStore,
} from '@/app/stores/account.store';
import { useCurrentUser, useDerivedKey } from '@/app/stores/session.store';
import { deleteAccount } from '@/services/accounts/account.service';
import { transactionStorage } from '@/services/storage/transaction.storage';
import { useUIStore } from '@/app/ui.store';
import type { AccountWithBalance } from '@/shared/types/account.types';
import type { Account } from '@/shared/types/account.types';
import { NetWorthCard } from '@/features/accounts/components/NetWorthCard';
import { AccountCard } from '@/features/accounts/components/AccountCard';
import { AccountDetail } from '@/features/accounts/components/AccountDetail';
import { AccountForm } from '@/features/accounts/components/AccountForm';
import { TransferForm } from '@/features/accounts/components/TransferForm';
import { DeleteAccountDialog } from '@/features/accounts/components/DeleteAccountDialog';
import { SlidePanel } from '@/shared/components/SlidePanel';

const LABELS = {
  TITLE: 'Accounts',
  ADD: 'Add account',
  ASSETS: 'Assets',
  LIABILITIES: 'Liabilities',
  EMPTY: 'No accounts yet. Add your first account.',
  LOADING_ERROR: 'Failed to load accounts.',
} as const;

type DeleteState = {
  readonly row: AccountWithBalance;
  readonly txCount: number | 'loading';
};

export function AccountsPage() {
  const currentUser = useCurrentUser();
  const derivedKey = useDerivedKey();
  const addToast = useUIStore((s) => s.addToast);

  const { accounts, isLoading, loadError, loadAccounts } = useAccounts();
  const { netWorth, loadNetWorth } = useNetWorth();
  const { isPanelOpen, panelMode, activeAccount, openPanel, closePanel } = useAccountPanel();
  const assets = useAssets();
  const liabilities = useLiabilities();
  const removeAccountFromList = useAccountStore((s) => s.removeAccountFromList);

  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Initial data load
  useEffect(() => {
    if (!currentUser) return;
    void loadAccounts(currentUser.id);
    void loadNetWorth(currentUser.id);
  }, [currentUser, loadAccounts, loadNetWorth]);

  // ----- Delete flow -----
  const handleDeleteRequest = useCallback(
    async (row: AccountWithBalance) => {
      if (!derivedKey) return;
      setDeleteState({ row, txCount: 'loading' });
      const txResult = await transactionStorage.listTransactionsByAccount(
        row.account.id,
        { limit: 1 },
        derivedKey
      );
      const count = txResult.success ? txResult.data.totalCount : 0;
      setDeleteState({ row, txCount: count });
    },
    [derivedKey]
  );

  const handleDeleteConfirm = async () => {
    if (!deleteState || !derivedKey) return;
    if (deleteState.txCount !== 0 && deleteState.txCount !== 'loading') return;
    setIsDeleting(true);
    const result = await deleteAccount(deleteState.row.account.id, derivedKey);
    setIsDeleting(false);
    if (!result.success) {
      addToast({ type: 'error', message: result.error.message, duration: 4000 });
      setDeleteState(null);
      return;
    }
    removeAccountFromList(deleteState.row.account.id);
    if (currentUser) void loadNetWorth(currentUser.id);
    addToast({ type: 'success', message: `"${deleteState.row.account.name}" deleted.`, duration: 3000 });
    setDeleteState(null);
    // Close panel if deleting the active account
    if (activeAccount?.account.id === deleteState.row.account.id) {
      closePanel();
    }
  };

  // ----- Panel handlers -----
  const handleDeleteRequestFromCard = useCallback(
    (row: AccountWithBalance) => { void handleDeleteRequest(row); },
    [handleDeleteRequest]
  );

  const handleDeleteRequestFromAccount = useCallback(
    (account: Account) => {
      const row = accounts.find((r) => r.account.id === account.id);
      if (row) void handleDeleteRequest(row);
    },
    [accounts, handleDeleteRequest]
  );

  const handleEditRequest = useCallback(
    (account: Account) => {
      const row = accounts.find((r) => r.account.id === account.id);
      if (row) openPanel('edit', row);
    },
    [accounts, openPanel]
  );

  const handleTransferRequest = useCallback(
    (account: Account) => {
      const row = accounts.find((r) => r.account.id === account.id);
      if (row) openPanel('transfer', row);
    },
    [accounts, openPanel]
  );

  // ----- Render helpers -----
  const renderAccountGroup = (group: AccountWithBalance[], title: string) => {
    if (group.length === 0) return null;
    return (
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          {title}
        </h2>
        <div className="flex flex-col gap-3">
          {group.map((row) => (
            <AccountCard
              key={row.account.id}
              accountWithBalance={row}
              onDeleteRequest={handleDeleteRequestFromCard}
            />
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">{LABELS.TITLE}</h1>
          <button
            type="button"
            onClick={() => { openPanel('add'); }}
            className="hidden sm:flex h-9 items-center gap-1.5 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-150"
            aria-label={LABELS.ADD}
          >
            <Plus className="w-4 h-4" />
            {LABELS.ADD}
          </button>
        </div>

        {/* Net worth card */}
        <NetWorthCard netWorth={netWorth} isLoading={isLoading} />

        {/* Error state */}
        {loadError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive mb-4">
            {LABELS.LOADING_ERROR}
          </div>
        )}

        {/* Account groups */}
        {!isLoading && accounts.length === 0 && !loadError && (
          <p className="text-center text-muted-foreground text-sm py-12">{LABELS.EMPTY}</p>
        )}

        {/* Loading skeletons */}
        {isLoading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-2xl border border-border bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && accounts.length > 0 && (
          <div className="flex flex-col gap-6">
            {renderAccountGroup(assets, LABELS.ASSETS)}
            {renderAccountGroup(liabilities, LABELS.LIABILITIES)}
          </div>
        )}
      </div>

      {/* Mobile FAB */}
      <button
        type="button"
        onClick={() => { openPanel('add'); }}
        className="sm:hidden fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors duration-150"
        aria-label={LABELS.ADD}
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* ---- Panels ---- */}

      {/* Account detail (view / reconcile) */}
      <AccountDetail
        open={isPanelOpen && (panelMode === 'view' || panelMode === 'reconcile')}
        row={activeAccount}
        onClose={closePanel}
        onEditRequest={handleEditRequest}
        onTransferRequest={handleTransferRequest}
        onDeleteRequest={handleDeleteRequestFromAccount}
      />

      {/* Add / Edit account form */}
      <AccountForm
        open={isPanelOpen && (panelMode === 'add' || panelMode === 'edit')}
        editRow={panelMode === 'edit' ? activeAccount : null}
        onClose={closePanel}
        onDeleteRequest={handleDeleteRequestFromAccount}
      />

      {/* Transfer form */}
      <SlidePanel
        open={isPanelOpen && panelMode === 'transfer'}
        onClose={closePanel}
        title="Transfer funds"
        size="md"
      >
        {isPanelOpen && panelMode === 'transfer' && (
          <TransferForm
            initialFromId={activeAccount?.account.id}
            onSuccess={closePanel}
            onCancel={closePanel}
          />
        )}
      </SlidePanel>

      {/* Delete dialog */}
      {deleteState && (
        <DeleteAccountDialog
          accountName={deleteState.row.account.name}
          hasTransactions={
            deleteState.txCount !== 'loading' && deleteState.txCount > 0
          }
          transactionCount={
            deleteState.txCount !== 'loading' ? deleteState.txCount : undefined
          }
          isDeleting={isDeleting}
          onConfirm={() => { void handleDeleteConfirm(); }}
          onCancel={() => { setDeleteState(null); }}
        />
      )}
    </div>
  );
}
