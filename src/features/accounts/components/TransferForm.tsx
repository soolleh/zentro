/**
 * TransferForm.tsx
 *
 * SlidePanel form for transferring funds between two accounts.
 * Uses the account store (not AccountSelector) for the from/to selectors.
 */

import { useState } from 'react';
import { ArrowLeftRight, AlertTriangle, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { UUID, ISODateString } from '@/shared/types/common.types';
import { useDerivedKey, useCurrentUser } from '@/app/stores/session.store';
import { useAccounts, useAccountStore } from '@/app/stores/account.store';
import { transferBetweenAccounts } from '@/services/accounts/account.service';
import { useUIStore } from '@/app/ui.store';
import { DatePicker } from '@/features/transactions/components/DatePicker';
import { usePreferencesStore } from '@/app/preferences.store';
import { formatCurrency } from '@/shared/utils/currency.utils';

const LABELS = {
  FROM: 'From account',
  TO: 'To account',
  SELECT_ACCOUNT: 'Select account',
  SWAP: 'Swap accounts',
  AMOUNT: 'Amount',
  DATE: 'Date',
  NOTES: 'Notes (optional)',
  NOTES_PLACEHOLDER: 'e.g. Monthly savings transfer',
  SUBMIT: 'Transfer funds',
  SUBMITTING: 'Transferring…',
  SAME_ACCOUNT: 'From and To accounts must be different.',
  LOW_BALANCE: 'The from account balance may be insufficient for this transfer.',
} as const;

const schema = z.object({
  fromAccountId: z.string().min(1, 'Select a from account'),
  toAccountId: z.string().min(1, 'Select a to account'),
  amount: z.string().min(1, 'Amount is required'),
  date: z.string().min(1, 'Date is required'),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type TransferFormProps = {
  readonly initialFromId?: UUID;
  readonly onSuccess: () => void;
  readonly onCancel: () => void;
};

export function TransferForm({ initialFromId, onSuccess, onCancel }: TransferFormProps) {
  const derivedKey = useDerivedKey();
  const currentUser = useCurrentUser();
  const addToast = useUIStore((s) => s.addToast);
  const { accounts } = useAccounts();
  const refreshAccount = useAccountStore((s) => s.refreshAccount);
  const loadNetWorth = useAccountStore((s) => s.loadNetWorth);
  const dateFormat = usePreferencesStore((s) => s.dateFormat);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fromAccountId: initialFromId ?? '',
      toAccountId: '',
      amount: '',
      date: today,
      notes: '',
    },
  });

  const fromId = watch('fromAccountId');
  const toId = watch('toAccountId');
  const amount = watch('amount');

  const fromRow = accounts.find((r) => r.account.id === fromId);
  const toRow = accounts.find((r) => r.account.id === toId);

  const parsedAmount = parseFloat(amount);
  const isSameAccount = fromId !== '' && toId !== '' && fromId === toId;
  const isLowBalance =
    fromRow != null &&
    !isNaN(parsedAmount) &&
    parsedAmount > 0 &&
    parsedAmount > fromRow.currentBalance;

  const handleSwap = () => {
    const prev = fromId;
    setValue('fromAccountId', toId, { shouldValidate: false });
    setValue('toAccountId', prev, { shouldValidate: false });
  };

  const onSubmit = async (values: FormValues) => {
    if (!derivedKey || !currentUser) return;
    if (values.fromAccountId === values.toAccountId) return;

    const parsed = parseFloat(values.amount);
    if (isNaN(parsed) || parsed <= 0) return;

    setIsSubmitting(true);
    const result = await transferBetweenAccounts(
      {
        fromAccountId: values.fromAccountId as UUID,
        toAccountId: values.toAccountId as UUID,
        amount: parsed,
        date: values.date as ISODateString,
        notes: values.notes ?? undefined,
      },
      currentUser.id,
      derivedKey
    );
    setIsSubmitting(false);

    if (!result.success) {
      addToast({ type: 'error', message: result.error.message, duration: 4000 });
      return;
    }

    addToast({ type: 'success', message: 'Transfer completed.', duration: 3000 });
    void refreshAccount(values.fromAccountId as UUID);
    void refreshAccount(values.toAccountId as UUID);
    void loadNetWorth(currentUser.id);
    onSuccess();
  };

  return (
    <form
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-5 px-6 py-5"
    >
      {/* From / To selectors */}
      <div className="flex items-end gap-2">
        {/* From */}
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="transfer-from">
            {LABELS.FROM}
          </label>
          <select
            id="transfer-from"
            {...register('fromAccountId')}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">{LABELS.SELECT_ACCOUNT}</option>
            {accounts.map((r) => (
              <option key={r.account.id} value={r.account.id} disabled={r.account.id === toId}>
                {r.account.name} ({formatCurrency(r.currentBalance, r.account.currency)})
              </option>
            ))}
          </select>
          {errors.fromAccountId && (
            <span className="text-xs text-destructive">{errors.fromAccountId.message}</span>
          )}
        </div>

        {/* Swap button */}
        <button
          type="button"
          onClick={handleSwap}
          className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg border border-input bg-background text-muted-foreground hover:text-foreground transition-colors duration-150"
          aria-label={LABELS.SWAP}
        >
          <ArrowLeftRight className="w-4 h-4" />
        </button>

        {/* To */}
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="transfer-to">
            {LABELS.TO}
          </label>
          <select
            id="transfer-to"
            {...register('toAccountId')}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">{LABELS.SELECT_ACCOUNT}</option>
            {accounts.map((r) => (
              <option key={r.account.id} value={r.account.id} disabled={r.account.id === fromId}>
                {r.account.name} ({formatCurrency(r.currentBalance, r.account.currency)})
              </option>
            ))}
          </select>
          {errors.toAccountId && (
            <span className="text-xs text-destructive">{errors.toAccountId.message}</span>
          )}
        </div>
      </div>

      {/* Same account error */}
      {isSameAccount && (
        <p className="text-xs text-destructive -mt-2">{LABELS.SAME_ACCOUNT}</p>
      )}

      {/* Currency mismatch note */}
      {fromRow && toRow && fromRow.account.currency !== toRow.account.currency && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <span className="text-xs text-amber-700">
            {`These accounts use different currencies (${fromRow.account.currency} → ${toRow.account.currency}). The transfer amount will be recorded as-is in each account's currency.`}
          </span>
        </div>
      )}

      {/* Amount */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground" htmlFor="transfer-amount">
          {LABELS.AMOUNT}
        </label>
        <div className="flex items-center h-10 rounded-lg border border-input bg-background overflow-hidden focus-within:ring-1 focus-within:ring-ring">
          {fromRow && (
            <span className="px-3 text-sm font-medium text-muted-foreground border-r border-input bg-muted/30 h-full flex items-center">
              {fromRow.account.currency}
            </span>
          )}
          <input
            id="transfer-amount"
            type="number"
            step="0.01"
            min="0.01"
            {...register('amount')}
            className="flex-1 h-full px-3 text-sm bg-transparent text-foreground focus:outline-none"
            placeholder="0.00"
          />
        </div>
        {errors.amount && (
          <span className="text-xs text-destructive">{errors.amount.message}</span>
        )}
        {/* Low balance warning */}
        {isLowBalance && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs text-amber-600">{LABELS.LOW_BALANCE}</span>
          </div>
        )}
      </div>

      {/* Date */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">{LABELS.DATE}</label>
        <DatePicker
          value={watch('date') as ISODateString}
          onChange={(d) => { setValue('date', d, { shouldValidate: true }); }}
          dateFormat={dateFormat}
          error={errors.date?.message}
        />
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground" htmlFor="transfer-notes">
          {LABELS.NOTES}
        </label>
        <input
          id="transfer-notes"
          type="text"
          {...register('notes')}
          placeholder={LABELS.NOTES_PLACEHOLDER}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-10 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-colors duration-150"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || isSameAccount}
          className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-150 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {LABELS.SUBMITTING}
            </>
          ) : (
            LABELS.SUBMIT
          )}
        </button>
      </div>
    </form>
  );
}
