import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Banknote,
  Building2,
  CreditCard,
  PiggyBank,
  Landmark,
  TrendingUp,
} from 'lucide-react';
import type { AccountType } from '@/shared/types/account.types';
import type { Currency, ISODateString } from '@/shared/types/common.types';
import { useCurrentUser, useDerivedKey } from '@/app/stores/session.store';
import { usePreferencesStore } from '@/app/preferences.store';
import {
  useOnboardingStep,
  useOnboardingStatus,
  useOnboardingStore,
} from '@/app/stores/onboarding.store';
import { createFirstAccount } from '@/services/onboarding/onboarding.service';
import { DatePicker } from '@/features/transactions/components/DatePicker';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FORM_ID = 'onboarding-step-form';

const ACCOUNT_TYPES: { type: AccountType; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'Cash', label: 'Cash', Icon: Banknote },
  { type: 'Bank', label: 'Bank', Icon: Building2 },
  { type: 'Checking', label: 'Checking', Icon: CreditCard },
  { type: 'Savings', label: 'Savings', Icon: PiggyBank },
  { type: 'CreditCard', label: 'Credit Card', Icon: CreditCard },
  { type: 'Loan', label: 'Loan', Icon: Landmark },
  { type: 'Investment', label: 'Investment', Icon: TrendingUp },
];

const ACCOUNT_NAME_PLACEHOLDERS: Record<AccountType, string> = {
  Cash: 'My Wallet',
  Bank: 'My Bank Account',
  Checking: 'My Bank Account',
  Savings: 'My Bank Account',
  CreditCard: 'My Credit Card',
  Loan: 'My Loan',
  Investment: 'My Investments',
};

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'JPY', label: 'JPY — Japanese Yen' },
  { value: 'CHF', label: 'CHF — Swiss Franc' },
  { value: 'CNY', label: 'CNY — Chinese Yuan' },
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'BRL', label: 'BRL — Brazilian Real' },
  { value: 'MXN', label: 'MXN — Mexican Peso' },
  { value: 'SGD', label: 'SGD — Singapore Dollar' },
  { value: 'HKD', label: 'HKD — Hong Kong Dollar' },
  { value: 'NOK', label: 'NOK — Norwegian Krone' },
  { value: 'SEK', label: 'SEK — Swedish Krona' },
  { value: 'DKK', label: 'DKK — Danish Krone' },
  { value: 'NZD', label: 'NZD — New Zealand Dollar' },
  { value: 'ZAR', label: 'ZAR — South African Rand' },
  { value: 'MYR', label: 'MYR — Malaysian Ringgit' },
  { value: 'IDR', label: 'IDR — Indonesian Rupiah' },
];

const TODAY = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const step1Schema = z.object({
  accountType: z.enum(['Cash', 'Bank', 'Checking', 'Savings', 'CreditCard', 'Loan', 'Investment']),
  accountName: z
    .string()
    .min(2, 'Account name must be at least 2 characters')
    .max(50, 'Account name is too long'),
  currency: z.string().min(1, 'Currency is required'),
  openingBalance: z
    .string()
    .min(1, 'Balance is required')
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, 'Enter a valid balance'),
  openingDate: z
    .string()
    .min(1, 'Date is required')
    .refine((val) => {
      const d = new Date(val);
      return !isNaN(d.getTime()) && val.slice(0, 10) <= TODAY;
    }, 'Date cannot be in the future'),
  creditLimit: z.string().optional(),
  minimumPaymentDue: z.string().optional(),
  paymentDueDayOfMonth: z.string().optional(),
  outstandingPrincipal: z.string().optional(),
  interestRate: z.string().optional(),
});

type FormValues = z.infer<typeof step1Schema>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Step1Account() {
  const currentUser = useCurrentUser();
  const derivedKey = useDerivedKey();
  const baseCurrency = usePreferencesStore((s) => s.baseCurrency);
  const { nextStep } = useOnboardingStep();
  const { stepError } = useOnboardingStatus();
  const setCreatedAccount = useOnboardingStore((s) => s.setCreatedAccount);
  const { register, control, watch, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      accountType: 'Bank',
      accountName: '',
      currency: baseCurrency,
      openingBalance: '0',
      openingDate: TODAY,
    },
  });

  const watchedType = watch('accountType');
  const isCreditCard = watchedType === 'CreditCard';
  const isLoan = watchedType === 'Loan';

  const onValid = async (values: FormValues) => {
    if (!currentUser || !derivedKey) return;
    const { setSubmitting, setStepError } = {
      setSubmitting: useOnboardingStore.getState().setSubmitting,
      setStepError: useOnboardingStore.getState().setStepError,
    };
    setSubmitting(true);
    setStepError(null);
    try {
      const now = new Date().toISOString() as ISODateString;
      const result = await createFirstAccount(
        currentUser.id,
        {
          name: values.accountName.trim(),
          type: values.accountType,
          currency: values.currency as Currency,
          openingBalance: parseFloat(values.openingBalance),
          openingDate: values.openingDate as ISODateString,
          updatedAt: now,
          ...(isCreditCard && values.creditLimit
            ? { creditLimit: parseFloat(values.creditLimit) }
            : {}),
          ...(isCreditCard && values.minimumPaymentDue
            ? { minimumPaymentDue: parseFloat(values.minimumPaymentDue) }
            : {}),
          ...(isCreditCard && values.paymentDueDayOfMonth
            ? {
              paymentDueDate: `${values.openingDate.slice(0, 7)}-${values.paymentDueDayOfMonth.padStart(2, '0')}` as ISODateString,
            }
            : {}),
          ...(isLoan && values.outstandingPrincipal
            ? { outstandingPrincipal: parseFloat(values.outstandingPrincipal) }
            : {}),
          ...(isLoan && values.interestRate
            ? { interestRate: parseFloat(values.interestRate) }
            : {}),
        },
        derivedKey
      );
      if (!result.success) {
        setStepError(result.error.message);
        return;
      }
      setCreatedAccount(result.data);
      nextStep();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      id={FORM_ID}
      onSubmit={(e) => { void handleSubmit(onValid)(e); }}
      className="flex flex-col gap-5"
      noValidate
    >
      {/* Step intro */}
      <div className="flex flex-col gap-1 mt-2 mb-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Where do you keep your money?
        </h2>
        <p className="text-sm text-muted-foreground">
          Add your primary account to start tracking your finances.
        </p>
      </div>

      {/* Error callout */}
      {stepError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {stepError}
        </div>
      )}

      {/* Account type grid */}
      <div className="grid grid-cols-3 gap-2">
        {ACCOUNT_TYPES.map(({ type, label, Icon }) => {
          const isSelected = watchedType === type;
          return (
            <Controller
              key={type}
              name="accountType"
              control={control}
              render={({ field }) => (
                <button
                  type="button"
                  onClick={() => { field.onChange(type); }}
                  className={[
                    'flex flex-col items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all duration-150 active:scale-[0.97]',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30',
                  ].join(' ')}
                  aria-pressed={isSelected}
                >
                  <div
                    className={[
                      'w-10 h-10 rounded-xl flex items-center justify-center',
                      isSelected ? 'bg-primary/10' : 'bg-muted',
                    ].join(' ')}
                  >
                    <Icon
                      className={[
                        'w-5 h-5',
                        isSelected ? 'text-primary' : 'text-muted-foreground',
                      ].join(' ')}
                    />
                  </div>
                  <span
                    className={[
                      'text-xs font-medium text-center',
                      isSelected ? 'text-foreground' : 'text-muted-foreground',
                    ].join(' ')}
                  >
                    {label}
                  </span>
                </button>
              )}
            />
          );
        })}
      </div>

      {/* Account name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Account name</label>
        <input
          {...register('accountName')}
          type="text"
          placeholder={ACCOUNT_NAME_PLACEHOLDERS[watchedType]}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {errors.accountName && (
          <p className="text-xs text-destructive">{errors.accountName.message}</p>
        )}
      </div>

      {/* Currency */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Currency</label>
        <select
          {...register('currency')}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {CURRENCY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {errors.currency && (
          <p className="text-xs text-destructive">{errors.currency.message}</p>
        )}
      </div>

      {/* Opening balance */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Opening balance</label>
        <p className="text-xs text-muted-foreground -mt-1">
          Enter your current balance as of today.
        </p>
        <div className="flex items-center gap-2">
          <div className="h-10 px-3 rounded-lg border border-input bg-muted text-sm font-medium text-foreground flex items-center min-w-[56px]">
            {watch('currency') || 'USD'}
          </div>
          <input
            {...register('openingBalance')}
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            step="0.01"
            min="0"
            className="flex-1 h-10 rounded-lg border border-input bg-background px-3 text-sm tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {errors.openingBalance && (
          <p className="text-xs text-destructive">{errors.openingBalance.message}</p>
        )}
      </div>

      {/* Opening date */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">As of date</label>
        <Controller
          name="openingDate"
          control={control}
          render={({ field }) => (
            <DatePicker
              value={field.value ? field.value as ISODateString : null}
              onChange={(d) => { field.onChange(d); }}
              dateFormat="DD/MM/YYYY"
              error={errors.openingDate?.message}
            />
          )}
        />
      </div>

      {/* CreditCard-specific fields */}
      {isCreditCard && (
        <div className="flex flex-col gap-3 pl-4 border-l-2 border-primary/30 animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Credit limit</label>
            <input
              {...register('creditLimit')}
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              step="0.01"
              min="0.01"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.creditLimit && (
              <p className="text-xs text-destructive">{errors.creditLimit.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Minimum payment due{' '}
              <span className="text-xs text-muted-foreground">(optional)</span>
            </label>
            <input
              {...register('minimumPaymentDue')}
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              step="0.01"
              min="0"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Payment due day</label>
            <p className="text-xs text-muted-foreground -mt-1">Day of month (1–31)</p>
            <input
              {...register('paymentDueDayOfMonth')}
              type="number"
              inputMode="numeric"
              min="1"
              max="31"
              placeholder="15"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      )}

      {/* Loan-specific fields */}
      {isLoan && (
        <div className="flex flex-col gap-3 pl-4 border-l-2 border-primary/30 animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Outstanding balance</label>
            <input
              {...register('outstandingPrincipal')}
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              step="0.01"
              min="0"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.outstandingPrincipal && (
              <p className="text-xs text-destructive">{errors.outstandingPrincipal.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Interest rate{' '}
              <span className="text-xs text-muted-foreground">(optional)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                {...register('interestRate')}
                type="number"
                inputMode="decimal"
                placeholder="0.0"
                step="0.01"
                min="0"
                className="flex-1 h-10 rounded-lg border border-input bg-background px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="h-10 px-3 rounded-lg border border-input bg-muted text-sm font-medium text-foreground flex items-center">
                %
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
