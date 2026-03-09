import { useState, useEffect } from 'react';
import { Play, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import type { UUID, ISODateString } from '@/shared/types/common.types';
import { SlidePanel } from '@/shared/components/SlidePanel';
import { AccountSelector } from '@/features/transactions/components/AccountSelector';
import { DatePicker } from '@/features/transactions/components/DatePicker';
import { useQuickUsePanel, useTemplateStore } from '@/app/stores/template.store';
import { useSessionStore } from '@/app/stores/session.store';
import { useTransactionStore } from '@/app/stores/transaction.store';
import { useUIStore } from '@/app/ui.store';
import { useAccountStore } from '@/app/stores/account.store';
import { useCategoryStore } from '@/app/stores/category.store';
import { useDateFormat } from '@/app/preferences.store';
import { replayTemplate } from '@/services/templates/template.service';
import { useShallow } from 'zustand/react/shallow';

type QuickUsePanelProps = {
  open: boolean;
};

export function QuickUsePanel({ open }: QuickUsePanelProps) {
  const { activeTemplate, closeQuickUsePanel } = useQuickUsePanel();
  const bumpTemplateToTop = useTemplateStore((s) => s.bumpTemplateToTop);
  const openFormPanel = useTemplateStore((s) => s.openFormPanel);
  const addTransactionToList = useTransactionStore((s) => s.addTransactionToList);
  const addToast = useUIStore((s) => s.addToast);
  const { currentUser, derivedKey } = useSessionStore(
    useShallow((s) => ({
      currentUser: s.currentUser,
      derivedKey: s.derivedKey,
    })),
  );
  const accounts = useAccountStore((s) => s.accounts);
  const categories = useCategoryStore((s) => s.categories);
  const { dateFormat } = useDateFormat();

  // Form state
  const todayISO = format(new Date(), 'yyyy-MM-dd') + 'T00:00:00.000Z';
  const [date, setDate] = useState<ISODateString>(todayISO as ISODateString);
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState<UUID | null>(null);
  const [toAccountId, setToAccountId] = useState<UUID | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when template changes
  useEffect(() => {
    if (!activeTemplate) return;
    setDate(todayISO as ISODateString);
    setAmount('');
    setAccountId(null);
    setToAccountId(null);
    setNotes(activeTemplate.notes);
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTemplate?.id]);

  if (!activeTemplate) return null;

  const account = activeTemplate.accountId
    ? accounts.find((a) => a.account.id === (activeTemplate.accountId as UUID))
    : null;

  const category = activeTemplate.categoryId
    ? categories.find((c) => c.id === (activeTemplate.categoryId as UUID))
    : null;

  const needsAmount = activeTemplate.amount === null;
  const needsAccount = activeTemplate.accountId === null;
  const needsToAccount = activeTemplate.type === 'Transfer' && activeTemplate.toAccountId === null;

  async function handleSubmit() {
    if (!currentUser || !derivedKey || !activeTemplate) return;
    setError('');

    if (needsAmount) {
      const parsed = parseFloat(amount);
      if (isNaN(parsed) || parsed <= 0) {
        setError('Enter a valid amount greater than 0.');
        return;
      }
    }
    if (needsAccount && !accountId) {
      setError('Please select an account.');
      return;
    }
    if (needsToAccount && !toAccountId) {
      setError('Please select a destination account.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await replayTemplate(
        currentUser.id as UUID,
        activeTemplate.id,
        {
          date,
          amount: needsAmount ? parseFloat(amount) : undefined,
          accountId: needsAccount ? (accountId ?? undefined) : undefined,
          toAccountId: needsToAccount ? (toAccountId ?? undefined) : undefined,
          notes,
        },
        derivedKey,
      );

      if (!result.success) {
        setError(result.error.message);
        return;
      }

      addTransactionToList(result.data.transaction);
      bumpTemplateToTop(activeTemplate.id);
      closeQuickUsePanel();
      addToast({ message: 'Transaction recorded from template.', type: 'success' });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SlidePanel
      open={open}
      onClose={closeQuickUsePanel}
      size="sm"
      title={`${activeTemplate.emoji} ${activeTemplate.name}`}
    >
      <div className="flex flex-col gap-4 px-6 py-5 pb-36">
        {/* Summary card */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
          <span className="text-2xl shrink-0" aria-hidden>{activeTemplate.emoji}</span>
          <div className="flex flex-col gap-0 min-w-0">
            <span className="text-sm font-semibold text-foreground truncate">
              {activeTemplate.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {activeTemplate.type}
              {' · '}
              {activeTemplate.amount !== null
                ? new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: activeTemplate.currency,
                }).format(activeTemplate.amount)
                : 'Variable amount'}
            </span>
          </div>
        </div>

        {/* Confirm details label */}
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Confirm details
        </p>

        {/* Date */}
        <DatePicker
          value={date}
          onChange={setDate}
          label="Date"
          dateFormat={dateFormat}
        />

        {/* Amount — only when variable */}
        {needsAmount && (
          <div className="animate-in fade-in-0 duration-200">
            <label className="block text-sm font-medium text-foreground mb-1.5">Amount</label>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xs font-medium text-muted-foreground border border-border rounded-lg px-2.5 py-2 bg-muted/40">
                {activeTemplate.currency}
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); }}
                className="flex-1 h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        )}

        {/* Account — only when null */}
        {needsAccount && (
          <AccountSelector
            value={accountId}
            onChange={(id) => { setAccountId(id); }}
            label="Account"
            placeholder="Select account"
          />
        )}

        {/* To account — Transfer only, when null */}
        {needsToAccount && (
          <AccountSelector
            value={toAccountId}
            onChange={(id) => { setToAccountId(id); }}
            label="To account"
            placeholder="Select destination account"
          />
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Notes{' '}
            <span className="text-xs text-muted-foreground font-normal">(optional)</span>
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => { setNotes(e.target.value); }}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            placeholder="Add a note…"
          />
        </div>

        {/* Pre-filled fields summary */}
        {(account ?? category) && (
          <div className="flex flex-col gap-1 p-3 rounded-xl bg-muted/20 border border-border">
            <p className="text-xs font-semibold text-muted-foreground mb-1">
              Using from template
            </p>
            {account && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Account</span>
                <span className="text-foreground font-medium">{account.account.name}</span>
              </div>
            )}
            {category && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Category</span>
                <span className="text-foreground font-medium">{category.name}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                closeQuickUsePanel();
                openFormPanel('edit', activeTemplate);
              }}
              className="text-xs text-primary hover:underline cursor-pointer text-left mt-1 flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" aria-hidden />
              Change these
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-card border-t border-border px-6 py-4 flex flex-col gap-2">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => { void handleSubmit(); }}
          className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-150 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Recording…
            </>
          ) : (
            <>
              <Play className="w-4 h-4" aria-hidden />
              Record transaction
            </>
          )}
        </button>
        <button
          type="button"
          onClick={closeQuickUsePanel}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors text-center cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </SlidePanel>
  );
}
