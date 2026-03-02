/**
 * AccountDetail.tsx
 *
 * Full account detail view inside a large SlidePanel.
 * Shows the account header, balance hero, history chart, and tabbed content.
 */

import { useState } from 'react';
import { X, ArrowLeftRight, Pencil } from 'lucide-react';
import { SlidePanel } from '@/shared/components/SlidePanel';
import type { Account, AccountWithBalance } from '@/shared/types/account.types';
import { ACCOUNT_TYPE_META } from '@/features/accounts/utils/accountTypeMetadata';
import { formatCurrency } from '@/shared/utils/currency.utils';
import { useBalanceHistory } from '@/features/accounts/hooks/useBalanceHistory';
import { BalanceHistoryChart } from './BalanceHistoryChart';
import { CreditCardHero } from './CreditCardHero';
import { AccountDetailTabs } from './AccountDetailTabs';

const LABELS = {
  CLOSE: 'Close panel',
  TRANSFER: 'Transfer',
  EDIT: 'Edit',
  CURRENT_BALANCE: 'Current balance',
} as const;

type AccountDetailProps = {
  readonly open: boolean;
  readonly row: AccountWithBalance | null;
  readonly onClose: () => void;
  readonly onEditRequest: (account: Account) => void;
  readonly onTransferRequest: (account: Account) => void;
  readonly onDeleteRequest: (account: Account) => void;
};

function AccountDetailContent({
  row,
  onClose,
  onEditRequest,
  onTransferRequest,
  onDeleteRequest,
}: Required<Omit<AccountDetailProps, 'open'>> & { row: AccountWithBalance }) {
  const [historyMonths, setHistoryMonths] = useState(6);
  const { history, isLoading: historyLoading } = useBalanceHistory(
    row.account.id,
    historyMonths
  );
  const meta = ACCOUNT_TYPE_META[row.account.type];
  const isCreditCard = row.account.type === 'CreditCard';
  const Icon = meta.Icon;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Custom header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
        {/* Account icon */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: meta.bgColor }}
          aria-hidden="true"
        >
          <Icon className="w-4.5 h-4.5" style={{ color: meta.color }} />
        </div>
        {/* Name + type */}
        <div className="flex flex-col min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground leading-tight truncate">
            {row.account.name}
          </h2>
          <span className="text-xs text-muted-foreground">{meta.label}</span>
        </div>
        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => { onTransferRequest(row.account); }}
            className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/50 flex items-center gap-1.5 transition-colors duration-150"
            aria-label={LABELS.TRANSFER}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            {LABELS.TRANSFER}
          </button>
          <button
            type="button"
            onClick={() => { onEditRequest(row.account); }}
            className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/50 flex items-center gap-1.5 transition-colors duration-150"
            aria-label={LABELS.EDIT}
          >
            <Pencil className="w-3.5 h-3.5" />
            {LABELS.EDIT}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-150"
            aria-label={LABELS.CLOSE}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Balance hero */}
        <div className="px-6 pt-5 pb-4">
          {isCreditCard ? (
            <CreditCardHero account={row.account} currentBalance={row.currentBalance} />
          ) : (
            <div className="text-center py-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                {LABELS.CURRENT_BALANCE}
              </p>
              <p
                className={`text-3xl font-bold ${row.currentBalance < 0 ? 'text-destructive' : 'text-foreground'
                  }`}
              >
                {formatCurrency(row.currentBalance, row.account.currency)}
              </p>
              {row.account.currency !== 'USD' && (
                <span className="text-xs text-muted-foreground mt-0.5 block">
                  {row.account.currency}
                </span>
              )}
            </div>
          )}
        </div>

        {/* History chart */}
        <div className="px-6 pb-4">
          <BalanceHistoryChart
            history={history}
            isLoading={historyLoading}
            isLiability={row.isLiability}
            currency={row.account.currency}
            selectedMonths={historyMonths}
            onPeriodChange={setHistoryMonths}
          />
        </div>

        {/* Tabs */}
        <AccountDetailTabs row={row} onDeleteRequest={onDeleteRequest} />
      </div>
    </div>
  );
}

export function AccountDetail({
  open,
  row,
  onClose,
  onEditRequest,
  onTransferRequest,
  onDeleteRequest,
}: AccountDetailProps) {
  return (
    <SlidePanel open={open} onClose={onClose} size="lg">
      {row ? (
        <AccountDetailContent
          row={row}
          onClose={onClose}
          onEditRequest={onEditRequest}
          onTransferRequest={onTransferRequest}
          onDeleteRequest={onDeleteRequest}
        />
      ) : null}
    </SlidePanel>
  );
}
