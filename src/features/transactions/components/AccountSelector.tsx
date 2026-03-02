import { useState, useEffect, useRef } from 'react';
import { Check, ChevronDown, Wallet } from 'lucide-react';
import type { Account } from '@/shared/types/account.types';
import type { UUID } from '@/shared/types/common.types';
import { accountStorage } from '@/services/storage/account.storage';
import { useDerivedKey, useCurrentUser } from '@/app/stores/session.store';

type AccountSelectorProps = {
  value: UUID | null;
  onChange: (accountId: UUID, account: Account) => void;
  label?: string;
  placeholder?: string;
  error?: string;
};

const ACCOUNT_TYPE_ICONS: Record<string, string> = {
  Cash: '💵',
  Bank: '🏦',
  Checking: '🏦',
  Savings: '💰',
  CreditCard: '💳',
  Loan: '🔖',
  Investment: '📈',
};

export function AccountSelector({
  value,
  onChange,
  label = 'Account',
  placeholder = 'Select account',
  error,
}: AccountSelectorProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const derivedKey = useDerivedKey();
  const currentUser = useCurrentUser();

  useEffect(() => {
    if (!currentUser || !derivedKey) return;
    void accountStorage.listAccountsByUser(currentUser.id).then((result) => {
      if (result.success) setAccounts(result.data);
    });
  }, [currentUser, derivedKey]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => { document.removeEventListener('mousedown', handler); };
  }, [isOpen]);

  const selected = accounts.find((a) => a.id === value) ?? null;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-foreground">{label}</label>
      )}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => { setIsOpen((o) => !o); }}
          className={`h-10 w-full rounded-lg border ${error ? 'border-destructive' : 'border-input'} bg-background px-3 text-sm flex items-center gap-2 text-left cursor-pointer hover:border-border/80 transition-colors duration-150`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          {selected ? (
            <>
              <span className="text-sm">{ACCOUNT_TYPE_ICONS[selected.type] ?? '🏦'}</span>
              <span className="flex-1 truncate text-foreground font-medium">{selected.name}</span>
              <span className="text-xs text-muted-foreground ml-auto">{selected.currency}</span>
            </>
          ) : (
            <>
              <Wallet className="w-4 h-4 text-muted-foreground" />
              <span className="flex-1 text-muted-foreground">{placeholder}</span>
            </>
          )}
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-card border border-border rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
            {accounts.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                No accounts available
              </div>
            ) : (
              accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => {
                    onChange(account.id, account);
                    setIsOpen(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2.5 w-full text-left hover:bg-muted/50 transition-colors duration-100"
                  role="option"
                  aria-selected={account.id === value}
                >
                  <span className="text-sm">{ACCOUNT_TYPE_ICONS[account.type] ?? '🏦'}</span>
                  <span className="text-sm font-medium text-foreground flex-1">{account.name}</span>
                  <span className="text-xs text-muted-foreground">{account.currency}</span>
                  {account.id === value && (
                    <Check className="w-4 h-4 text-primary ml-1" />
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
