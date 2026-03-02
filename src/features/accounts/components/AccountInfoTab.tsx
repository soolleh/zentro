/**
 * AccountInfoTab.tsx
 *
 * Display read-only account details inside the account detail panel.
 * Uses SettingsCard / SettingsRow for consistent layout.
 */

import { Wallet, CalendarDays, DollarSign, Percent, Clock, Trash2 } from 'lucide-react';
import type { Account, AccountWithBalance } from '@/shared/types/account.types';
import { SettingsCard } from '@/features/settings/components/SettingsCard';
import { SettingsRow } from '@/features/settings/components/SettingsRow';
import { ACCOUNT_TYPE_META } from '@/features/accounts/utils/accountTypeMetadata';
import { formatCurrency } from '@/shared/utils/currency.utils';

const LABELS = {
  ACCOUNT_TYPE: 'Account type',
  CURRENCY: 'Currency',
  OPENING_BALANCE: 'Opening balance',
  OPENING_DATE: 'Opening date',
  CREATED_ON: 'Created on',
  CREDIT_LIMIT: 'Credit limit',
  MIN_PAYMENT: 'Minimum payment due',
  PAYMENT_DUE_DATE: 'Payment due date',
  OUTSTANDING: 'Outstanding principal',
  INTEREST_RATE: 'Interest rate',
  DELETE: 'Delete account',
  DELETE_DESC: 'Permanently remove this account and all its data.',
} as const;

function fmtIsoDate(iso: string): string {
  const [y = '', m = '', d = ''] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

type AccountInfoTabProps = {
  readonly row: AccountWithBalance;
  readonly onDeleteRequest: (account: Account) => void;
};

export function AccountInfoTab({ row, onDeleteRequest }: AccountInfoTabProps) {
  const { account, currentBalance } = row;
  const meta = ACCOUNT_TYPE_META[account.type];
  const isCreditCard = account.type === 'CreditCard';
  const isLoan = account.type === 'Loan';

  return (
    <div className="px-6 py-5 flex flex-col gap-5">
      {/* General info */}
      <SettingsCard>
        <SettingsRow
          label={LABELS.ACCOUNT_TYPE}
          icon={meta.Icon}
          control={<span className="text-sm text-muted-foreground">{meta.label}</span>}
        />
        <SettingsRow
          label={LABELS.CURRENCY}
          icon={DollarSign}
          control={<span className="text-sm text-muted-foreground">{account.currency}</span>}
        />
        <SettingsRow
          label={LABELS.OPENING_BALANCE}
          icon={Wallet}
          control={
            <span className="text-sm text-muted-foreground">
              {formatCurrency(account.openingBalance, account.currency)}
            </span>
          }
        />
        <SettingsRow
          label={LABELS.OPENING_DATE}
          icon={CalendarDays}
          control={
            <span className="text-sm text-muted-foreground">
              {fmtIsoDate(account.openingDate)}
            </span>
          }
        />
        <SettingsRow
          label={LABELS.CREATED_ON}
          icon={Clock}
          control={
            <span className="text-sm text-muted-foreground">
              {fmtIsoDate(account.createdAt)}
            </span>
          }
        />
      </SettingsCard>

      {/* Credit card specific */}
      {isCreditCard && (
        <SettingsCard>
          <SettingsRow
            label={LABELS.CREDIT_LIMIT}
            icon={Wallet}
            control={
              <span className="text-sm text-muted-foreground">
                {account.creditLimit != null
                  ? formatCurrency(account.creditLimit, account.currency)
                  : '—'}
              </span>
            }
          />
          <SettingsRow
            label={LABELS.MIN_PAYMENT}
            icon={DollarSign}
            control={
              <span className="text-sm text-muted-foreground">
                {account.minimumPaymentDue != null
                  ? formatCurrency(account.minimumPaymentDue, account.currency)
                  : '—'}
              </span>
            }
          />
          {account.paymentDueDate != null && (
            <SettingsRow
              label={LABELS.PAYMENT_DUE_DATE}
              icon={CalendarDays}
              control={
                <span className="text-sm text-muted-foreground">
                  {fmtIsoDate(account.paymentDueDate)}
                </span>
              }
            />
          )}
        </SettingsCard>
      )}

      {/* Loan specific */}
      {isLoan && (
        <SettingsCard>
          <SettingsRow
            label={LABELS.OUTSTANDING}
            icon={Wallet}
            control={
              <span className="text-sm text-muted-foreground">
                {account.outstandingPrincipal != null
                  ? formatCurrency(account.outstandingPrincipal, account.currency)
                  : formatCurrency(Math.abs(currentBalance), account.currency)}
              </span>
            }
          />
          {account.interestRate != null && (
            <SettingsRow
              label={LABELS.INTEREST_RATE}
              icon={Percent}
              control={
                <span className="text-sm text-muted-foreground">
                  {`${String(account.interestRate)}%`}
                </span>
              }
            />
          )}
        </SettingsCard>
      )}

      {/* Delete */}
      <SettingsCard>
        <SettingsRow
          label={LABELS.DELETE}
          description={LABELS.DELETE_DESC}
          icon={Trash2}
          control={
            <button
              type="button"
              onClick={() => { onDeleteRequest(account); }}
              className="text-xs font-medium text-destructive hover:text-destructive/80 transition-colors duration-150"
              aria-label={`Delete ${account.name}`}
            >
              Delete
            </button>
          }
        />
      </SettingsCard>
    </div>
  );
}
