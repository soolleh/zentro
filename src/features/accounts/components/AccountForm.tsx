/**
 * AccountForm.tsx
 *
 * SlidePanel form for creating or editing an account.
 * Add mode: shows account-type selector grid and all type-specific fields.
 * Edit mode: type is locked; shows editable fields + delete link.
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { SlidePanel } from '@/shared/components/SlidePanel';
import type { Account, AccountType, AccountWithBalance } from '@/shared/types/account.types';
import type { Currency, ISODateString } from '@/shared/types/common.types';
import { useDerivedKey, useCurrentUser } from '@/app/stores/session.store';
import { useAccountStore } from '@/app/stores/account.store';
import { accountStorage } from '@/services/storage/account.storage';
import { useUIStore } from '@/app/ui.store';
import { DatePicker } from '@/features/transactions/components/DatePicker';
import { usePreferencesStore } from '@/app/preferences.store';
import { ACCOUNT_TYPE_META } from '@/features/accounts/utils/accountTypeMetadata';

const ACCOUNT_TYPES: AccountType[] = [
  'Cash',
  'Bank',
  'Checking',
  'Savings',
  'CreditCard',
  'Loan',
  'Investment',
];

const LABELS = {
  ADD_TITLE: 'Add account',
  EDIT_TITLE: 'Edit account',
  CHOOSE_TYPE: 'Choose account type',
  NAME: 'Account name',
  NAME_PLACEHOLDER: 'e.g. Main Savings',
  CURRENCY: 'Currency',
  OPENING_BALANCE: 'Opening balance',
  OPENING_DATE: 'Opening date',
  CREDIT_LIMIT: 'Credit limit',
  MIN_PAYMENT: 'Minimum payment due',
  PAYMENT_DUE_DATE: 'Payment due date',
  OUTSTANDING: 'Outstanding principal',
  INTEREST_RATE: 'Interest rate (%)',
  SAVE: 'Save account',
  SAVING: 'Saving…',
  DELETE_LINK: 'Delete this account',
} as const;

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'SGD', 'HKD', 'INR', 'BRL', 'MXN', 'ZAR', 'NGN', 'KES', 'AED'];

const schema = z.object({
  name: z.string().min(1, 'Account name is required').max(60),
  currency: z.string().min(1, 'Currency is required'),
  openingBalance: z.string().min(1, 'Opening balance is required'),
  openingDate: z.string().min(1, 'Opening date is required'),
  // CreditCard
  creditLimit: z.string().optional(),
  minimumPaymentDue: z.string().optional(),
  paymentDueDate: z.string().optional(),
  // Loan
  outstandingPrincipal: z.string().optional(),
  interestRate: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type AccountFormProps = {
  readonly open: boolean;
  readonly editRow?: AccountWithBalance | null;
  readonly onClose: () => void;
  readonly onDeleteRequest?: (account: Account) => void;
};

export function AccountForm({ open, editRow, onClose, onDeleteRequest }: AccountFormProps) {
  const isEdit = editRow != null;
  const derivedKey = useDerivedKey();
  const currentUser = useCurrentUser();
  const addToast = useUIStore((s) => s.addToast);
  const addAccountToList = useAccountStore((s) => s.addAccountToList);
  const refreshAccount = useAccountStore((s) => s.refreshAccount);
  const loadNetWorth = useAccountStore((s) => s.loadNetWorth);
  const dateFormat = usePreferencesStore((s) => s.dateFormat);
  const userBaseCurrency = usePreferencesStore((s) => s.baseCurrency);

  const today = new Date().toISOString().slice(0, 10);

  const [selectedType, setSelectedType] = useState<AccountType>(
    editRow?.account.type ?? 'Bank'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: editRow?.account.name ?? '',
      currency: editRow?.account.currency ?? userBaseCurrency,
      openingBalance: editRow?.account.openingBalance != null
        ? String(editRow.account.openingBalance)
        : '0',
      openingDate: editRow?.account.openingDate ?? (today as ISODateString),
      creditLimit: editRow?.account.creditLimit != null ? String(editRow.account.creditLimit) : '',
      minimumPaymentDue: editRow?.account.minimumPaymentDue != null
        ? String(editRow.account.minimumPaymentDue)
        : '',
      paymentDueDate: editRow?.account.paymentDueDate ?? '',
      outstandingPrincipal: editRow?.account.outstandingPrincipal != null
        ? String(editRow.account.outstandingPrincipal)
        : '',
      interestRate: editRow?.account.interestRate != null ? String(editRow.account.interestRate) : '',
    },
  });

  const isCreditCard = selectedType === 'CreditCard';
  const isLoan = selectedType === 'Loan';

  const handleClose = () => {
    reset();
    setSelectedType(editRow?.account.type ?? 'Bank');
    onClose();
  };

  const onSubmit = async (values: FormValues) => {
    if (!derivedKey || !currentUser) return;

    const openingBalance = parseFloat(values.openingBalance);
    if (isNaN(openingBalance)) return;

    const now = new Date().toISOString() as ISODateString;

    const base: Omit<Account, 'id' | 'createdAt'> = {
      userId: currentUser.id,
      name: values.name.trim(),
      type: selectedType,
      currency: values.currency as Currency,
      openingBalance,
      openingDate: values.openingDate as ISODateString,
      updatedAt: now,
      ...(isCreditCard && values.creditLimit
        ? { creditLimit: parseFloat(values.creditLimit) }
        : {}),
      ...(isCreditCard && values.minimumPaymentDue
        ? { minimumPaymentDue: parseFloat(values.minimumPaymentDue) }
        : {}),
      ...(isCreditCard && values.paymentDueDate
        ? { paymentDueDate: values.paymentDueDate as ISODateString }
        : {}),
      ...(isLoan && values.outstandingPrincipal
        ? { outstandingPrincipal: parseFloat(values.outstandingPrincipal) }
        : {}),
      ...(isLoan && values.interestRate
        ? { interestRate: parseFloat(values.interestRate) }
        : {}),
    };

    setIsSubmitting(true);

    if (editRow) {
      const result = await accountStorage.updateAccount(editRow.account.id, base, derivedKey);
      setIsSubmitting(false);
      if (!result.success) {
        addToast({ type: 'error', message: result.error.message, duration: 4000 });
        return;
      }
      void refreshAccount(editRow.account.id);
      void loadNetWorth(currentUser.id);
      addToast({ type: 'success', message: 'Account updated.', duration: 3000 });
    } else {
      const result = await accountStorage.createAccount(base, derivedKey);
      setIsSubmitting(false);
      if (!result.success) {
        addToast({ type: 'error', message: result.error.message, duration: 4000 });
        return;
      }
      const newRow = {
        account: result.data,
        currentBalance: openingBalance,
        isAsset: ['Cash', 'Bank', 'Checking', 'Savings', 'Investment'].includes(selectedType),
        isLiability: ['CreditCard', 'Loan'].includes(selectedType),
      };
      addAccountToList(newRow);
      void loadNetWorth(currentUser.id);
      addToast({ type: 'success', message: 'Account created.', duration: 3000 });
    }

    handleClose();
  };

  return (
    <SlidePanel
      open={open}
      onClose={handleClose}
      title={isEdit ? LABELS.EDIT_TITLE : LABELS.ADD_TITLE}
      size="md"
    >
      <form
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-5 px-6 py-5"
      >
        {/* Type selector (add only) */}
        {!isEdit && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">{LABELS.CHOOSE_TYPE}</span>
            <div className="grid grid-cols-4 gap-2">
              {ACCOUNT_TYPES.map((type) => {
                const m = ACCOUNT_TYPE_META[type];
                const Icon = m.Icon;
                const active = selectedType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => { setSelectedType(type); }}
                    className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl border transition-all duration-150 ${active
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'border-border hover:border-primary/40 hover:bg-muted/30'
                      }`}
                    aria-pressed={active}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: m.bgColor }}
                      aria-hidden="true"
                    >
                      <Icon className="w-4 h-4" style={{ color: m.color }} />
                    </div>
                    <span className={`text-[10px] font-medium text-center leading-tight ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                      {m.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="acct-name">
            {LABELS.NAME}
          </label>
          <input
            id="acct-name"
            type="text"
            {...register('name')}
            placeholder={LABELS.NAME_PLACEHOLDER}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {errors.name && (
            <span className="text-xs text-destructive">{errors.name.message}</span>
          )}
        </div>

        {/* Currency */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="acct-currency">
            {LABELS.CURRENCY}
          </label>
          <select
            id="acct-currency"
            {...register('currency')}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {errors.currency && (
            <span className="text-xs text-destructive">{errors.currency.message}</span>
          )}
        </div>

        {/* Opening balance + Opening date */}
        <div className="flex gap-3">
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="acct-balance">
              {LABELS.OPENING_BALANCE}
            </label>
            <div className="flex items-center h-10 rounded-lg border border-input bg-background overflow-hidden focus-within:ring-1 focus-within:ring-ring">
              <span className="px-2.5 text-xs font-medium text-muted-foreground border-r border-input bg-muted/30 h-full flex items-center">
                {watch('currency')}
              </span>
              <input
                id="acct-balance"
                type="number"
                step="0.01"
                {...register('openingBalance')}
                className="flex-1 h-full px-2.5 text-sm bg-transparent text-foreground focus:outline-none"
                placeholder="0.00"
              />
            </div>
            {errors.openingBalance && (
              <span className="text-xs text-destructive">{errors.openingBalance.message}</span>
            )}
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">{LABELS.OPENING_DATE}</label>
            <DatePicker
              value={watch('openingDate') as ISODateString}
              onChange={(d) => { setValue('openingDate', d, { shouldValidate: true }); }}
              dateFormat={dateFormat}
              error={errors.openingDate?.message}
            />
          </div>
        </div>

        {/* Credit card specific fields */}
        {isCreditCard && (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="acct-credit-limit">
                {LABELS.CREDIT_LIMIT}
                <span className="text-destructive ml-0.5">*</span>
              </label>
              <div className="flex items-center h-10 rounded-lg border border-input bg-background overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                <span className="px-2.5 text-xs text-muted-foreground border-r border-input bg-muted/30 h-full flex items-center">
                  {watch('currency')}
                </span>
                <input
                  id="acct-credit-limit"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('creditLimit')}
                  className="flex-1 h-full px-2.5 text-sm bg-transparent text-foreground focus:outline-none"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="acct-min-pay">
                  {LABELS.MIN_PAYMENT}
                </label>
                <input
                  id="acct-min-pay"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('minimumPaymentDue')}
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="0.00"
                />
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  {LABELS.PAYMENT_DUE_DATE}
                </label>
                <DatePicker
                  value={watch('paymentDueDate') as ISODateString | null}
                  onChange={(d) => { setValue('paymentDueDate', d, { shouldValidate: false }); }}
                  dateFormat={dateFormat}
                />
              </div>
            </div>
          </>
        )}

        {/* Loan specific fields */}
        {isLoan && (
          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="acct-principal">
                {LABELS.OUTSTANDING}
              </label>
              <input
                id="acct-principal"
                type="number"
                step="0.01"
                min="0"
                {...register('outstandingPrincipal')}
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="0.00"
              />
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="acct-rate">
                {LABELS.INTEREST_RATE}
              </label>
              <input
                id="acct-rate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                {...register('interestRate')}
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="0.00"
              />
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 h-10 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-colors duration-150"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-150 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {LABELS.SAVING}
              </>
            ) : (
              LABELS.SAVE
            )}
          </button>
        </div>

        {/* Delete link (edit mode only) */}
        {isEdit && onDeleteRequest && (
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={() => { onDeleteRequest(editRow.account); }}
              className="text-xs text-destructive hover:text-destructive/80 transition-colors duration-150"
            >
              {LABELS.DELETE_LINK}
            </button>
          </div>
        )}
      </form>
    </SlidePanel>
  );
}
