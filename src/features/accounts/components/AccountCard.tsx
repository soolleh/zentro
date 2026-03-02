/**
 * AccountCard.tsx
 *
 * Card component for displaying a single account in the accounts list.
 * Shows balance, account type, credit card utilization, and a 3-dot menu.
 */

import { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, ArrowLeftRight } from 'lucide-react';
import type { AccountWithBalance } from '@/shared/types/account.types';
import { formatCurrency, formatPercent } from '@/shared/utils/currency.utils';
import { ACCOUNT_TYPE_META } from '../utils/accountTypeMetadata';
import { useAccountStore } from '@/app/stores/account.store';
import { usePreferencesStore } from '@/app/preferences.store';

const LABELS = {
  CURRENT_BALANCE: 'Current balance',
  EDIT: 'Edit',
  TRANSFER: 'Transfer',
  RECONCILE: 'Reconcile',
  DELETE: 'Delete',
  ACCOUNT_MENU: 'Account options',
  USED_OF: 'used of',
} as const;

type AccountCardProps = {
  readonly accountWithBalance: AccountWithBalance;
  readonly onDeleteRequest: (accountWithBalance: AccountWithBalance) => void;
};

export function AccountCard({ accountWithBalance, onDeleteRequest }: AccountCardProps) {
  const { account, currentBalance, isAsset } = accountWithBalance;
  const meta = ACCOUNT_TYPE_META[account.type];
  const { Icon, label, color, bgColor } = meta;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const openPanel = useAccountStore((s) => s.openPanel);
  const baseCurrency = usePreferencesStore((s) => s.baseCurrency);

  const isForeignCurrency = account.currency !== baseCurrency;
  const isCreditCard = account.type === 'CreditCard';
  const creditLimit = account.creditLimit ?? 0;
  const utilizationRatio = isCreditCard && creditLimit > 0
    ? Math.min(1, Math.max(0, currentBalance / creditLimit))
    : 0;

  const balanceColor = isCreditCard || (!isAsset && currentBalance > 0)
    ? 'text-destructive'
    : 'text-foreground';

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => { document.removeEventListener('mousedown', handler); };
  }, [menuOpen]);

  const handleCardClick = () => {
    openPanel('view', accountWithBalance);
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen((v) => !v);
  };

  return (
    <div
      className="rounded-xl border border-border bg-card p-4 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all duration-150 active:scale-[0.99] flex flex-col gap-3"
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      aria-label={`${account.name} account`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(); }
      }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className="flex items-center">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: bgColor }}
          >
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          <div className="ml-3 flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">{account.name}</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground self-start">
              {label}
            </span>
          </div>
        </div>

        {/* 3-dot menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-150"
            onClick={handleMenuClick}
            aria-label={LABELS.ACCOUNT_MENU}
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-card border border-border rounded-xl shadow-lg z-10 py-1 overflow-hidden">
              <button
                type="button"
                className="w-full px-3 py-2 text-sm text-foreground text-left hover:bg-muted/50 transition-colors duration-150"
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); openPanel('edit', accountWithBalance); }}
              >
                {LABELS.EDIT}
              </button>
              <button
                type="button"
                className="w-full px-3 py-2 text-sm text-foreground text-left hover:bg-muted/50 transition-colors duration-150"
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); openPanel('transfer', accountWithBalance); }}
              >
                {LABELS.TRANSFER}
              </button>
              <button
                type="button"
                className="w-full px-3 py-2 text-sm text-foreground text-left hover:bg-muted/50 transition-colors duration-150"
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); openPanel('reconcile', accountWithBalance); }}
              >
                {LABELS.RECONCILE}
              </button>
              <div className="border-t border-border my-1" />
              <button
                type="button"
                className="w-full px-3 py-2 text-sm text-destructive text-left hover:bg-destructive/5 transition-colors duration-150"
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDeleteRequest(accountWithBalance); }}
              >
                {LABELS.DELETE}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Balance row */}
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{LABELS.CURRENT_BALANCE}</span>
        <div className="flex items-baseline gap-1">
          <span className={`text-xl font-bold tabular-nums tracking-tight ${balanceColor}`}>
            {formatCurrency(currentBalance, account.currency)}
          </span>
          <span className="text-xs text-muted-foreground">{account.currency}</span>
        </div>
      </div>

      {/* Credit card utilization */}
      {isCreditCard && creditLimit > 0 && (
        <div className="flex flex-col gap-1.5 pt-2 border-t border-border/50">
          <div className="flex justify-between">
            <span className="text-xs text-muted-foreground">
              {`${formatCurrency(currentBalance, account.currency)} ${LABELS.USED_OF} ${formatCurrency(creditLimit, account.currency)}`}
            </span>
            <span
              className={`text-xs font-medium ${utilizationRatio >= 0.8
                  ? 'text-destructive'
                  : utilizationRatio >= 0.5
                    ? 'text-[hsl(var(--chart-3))]'
                    : 'text-[hsl(var(--chart-4))]'
                }`}
            >
              {formatPercent(utilizationRatio, 0)}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${utilizationRatio >= 0.8
                  ? 'bg-destructive'
                  : utilizationRatio >= 0.5
                    ? 'bg-[hsl(var(--chart-3))]'
                    : 'bg-[hsl(var(--chart-4))]'
                }`}
              style={{ width: `${(utilizationRatio * 100).toFixed(1)}%` }}
            />
          </div>
        </div>
      )}

      {/* Foreign currency tag */}
      {isForeignCurrency && (
        <div className="flex items-center gap-1 mt-1">
          <ArrowLeftRight className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{`${account.currency} account`}</span>
        </div>
      )}
    </div>
  );
}
