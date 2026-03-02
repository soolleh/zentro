import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Utensils, Car, Home, Zap, Heart, Tv, ShoppingBag, RefreshCw } from 'lucide-react';
import type { UUID } from '@/shared/types/common.types';
import { useCurrentUser, useDerivedKey } from '@/app/stores/session.store';
import { useOnboardingStep, useOnboardingStatus, useOnboardingData, useOnboardingStore } from '@/app/stores/onboarding.store';
import { useOnboardingSubmit } from '../hooks/useOnboardingSubmit';
import { createFirstBudget } from '@/services/onboarding/onboarding.service';
import {
  CATEGORY_FOOD_DINING,
  CATEGORY_TRANSPORT,
  CATEGORY_HOUSING,
  CATEGORY_UTILITIES,
  CATEGORY_HEALTHCARE,
  CATEGORY_ENTERTAINMENT,
  CATEGORY_SHOPPING,
  CATEGORY_SUBSCRIPTIONS,
} from '@/shared/constants/categories.constants';

const FORM_ID = 'onboarding-step-form';

const BUDGET_CATEGORY_OPTIONS = [
  { category: CATEGORY_FOOD_DINING, Icon: Utensils },
  { category: CATEGORY_TRANSPORT, Icon: Car },
  { category: CATEGORY_HOUSING, Icon: Home },
  { category: CATEGORY_UTILITIES, Icon: Zap },
  { category: CATEGORY_HEALTHCARE, Icon: Heart },
  { category: CATEGORY_ENTERTAINMENT, Icon: Tv },
  { category: CATEGORY_SHOPPING, Icon: ShoppingBag },
  { category: CATEGORY_SUBSCRIPTIONS, Icon: RefreshCw },
];

const ALERT_THRESHOLDS = [
  { value: 0.7, label: '70%' },
  { value: 0.8, label: '80%' },
  { value: 0.9, label: '90%' },
] as const;

const SUGGESTIONS = [
  { pct: 0.1, label: 'Conservative', sub: '10% of income' },
  { pct: 0.2, label: 'Moderate', sub: '20% of income' },
  { pct: 0.3, label: 'Generous', sub: '30% of income' },
] as const;

const step3Schema = z.object({
  categoryId: z.string().min(1, 'Select a budget category'),
  amount: z
    .string()
    .min(1, 'Budget amount is required')
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Budget must be greater than 0'),
  alertThreshold: z.number().min(0.1).max(1),
});

type FormValues = z.infer<typeof step3Schema>;

function formatAmount(n: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function Step3Budget() {
  const currentUser = useCurrentUser();
  const derivedKey = useDerivedKey();
  const { nextStep } = useOnboardingStep();
  const { stepError } = useOnboardingStatus();
  const { createdAccount, createdTransaction } = useOnboardingData();
  const setCreatedBudget = useOnboardingStore((s) => s.setCreatedBudget);
  const { submit } = useOnboardingSubmit();

  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      categoryId: CATEGORY_FOOD_DINING.id,
      amount: '',
      alertThreshold: 0.8,
    },
  });

  const selectedCategoryId = watch('categoryId');
  const selectedThreshold = watch('alertThreshold');
  const incomeAmount = createdTransaction?.amount ?? 0;
  const currency = createdAccount?.currency ?? 'USD';

  const onValid = async (values: FormValues) => {
    if (!currentUser || !derivedKey || !createdAccount) return;

    let captured: Parameters<typeof setCreatedBudget>[0] | undefined;
    const ok = await submit(async () => {
      const result = await createFirstBudget(
        currentUser.id,
        {
          categoryId: values.categoryId as UUID,
          amount: parseFloat(values.amount),
          currency: createdAccount.currency,
          alertThreshold: values.alertThreshold,
        },
        derivedKey
      );
      if (result.success) captured = result.data;
      return result;
    });

    if (ok && captured !== undefined) {
      setCreatedBudget(captured);
      nextStep();
    }
  };

  return (
    <form
      id={FORM_ID}
      onSubmit={(e) => { void handleSubmit(onValid)(e); }}
      className="flex flex-col gap-5"
      noValidate
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Set your first budget
        </h2>
        <p className="text-sm text-muted-foreground">
          Choose a spending category and set a monthly limit to stay on track.
        </p>
      </div>

      {stepError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive" role="alert">
          {stepError}
        </div>
      )}

      {/* Income reference */}
      {incomeAmount > 0 && (
        <div className="rounded-lg bg-muted/40 border border-border px-3 py-2.5 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Your monthly income</p>
          <p className="text-sm font-semibold text-foreground tabular-nums">
            {formatAmount(incomeAmount, currency)}
          </p>
        </div>
      )}

      {/* Category grid */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">Category</label>
        <div className="grid grid-cols-4 gap-2">
          {BUDGET_CATEGORY_OPTIONS.map(({ category, Icon }) => {
            const isSelected = selectedCategoryId === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => { setValue('categoryId', category.id, { shouldValidate: true }); }}
                className={[
                  'flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 cursor-pointer',
                  'transition-all duration-150 active:scale-[0.97]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30',
                ].join(' ')}
                aria-pressed={isSelected}
                aria-label={category.name}
              >
                <div
                  className={[
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    isSelected ? 'bg-primary/10' : 'bg-muted',
                  ].join(' ')}
                >
                  <Icon
                    className={['w-4 h-4', isSelected ? 'text-primary' : 'text-muted-foreground'].join(' ')}
                  />
                </div>
                <span
                  className={[
                    'text-[10px] font-medium text-center leading-tight',
                    isSelected ? 'text-foreground' : 'text-muted-foreground',
                  ].join(' ')}
                >
                  {category.name}
                </span>
              </button>
            );
          })}
        </div>
        {errors.categoryId && (
          <p className="text-xs text-destructive" role="alert">{errors.categoryId.message}</p>
        )}
      </div>

      {/* Budget amount */}
      <div className="flex flex-col gap-2">
        <label htmlFor="budgetAmount" className="text-sm font-medium text-foreground">
          Monthly limit
        </label>

        {/* Suggestion chips */}
        {incomeAmount > 0 && (
          <div className="flex gap-2 flex-wrap">
            {SUGGESTIONS.map(({ pct, label, sub }) => {
              const suggested = Math.round(incomeAmount * pct);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => { setValue('amount', String(suggested), { shouldValidate: true }); }}
                  className="flex flex-col items-center px-3 py-1.5 rounded-lg border border-border bg-card text-left hover:border-primary/40 hover:bg-muted/30 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="text-xs font-semibold text-foreground tabular-nums">
                    {formatAmount(suggested, currency)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{label} · {sub}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="h-10 px-3 rounded-lg border border-input bg-muted text-sm font-medium text-foreground flex items-center min-w-[52px] select-none">
            {currency}
          </div>
          <input
            id="budgetAmount"
            {...register('amount')}
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            step="0.01"
            min="0.01"
            className="flex-1 h-10 rounded-lg border border-input bg-background px-3 text-sm tabular-nums text-right placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {errors.amount && (
          <p className="text-xs text-destructive" role="alert">{errors.amount.message}</p>
        )}
      </div>

      {/* Alert threshold */}
      <div className="flex flex-col gap-2">
        <div>
          <label className="text-sm font-medium text-foreground">Alert threshold</label>
          <p className="text-xs text-muted-foreground mt-0.5">
            You'll be notified when spending reaches this percentage of your budget.
          </p>
        </div>
        <div className="flex rounded-lg border border-input overflow-hidden" role="radiogroup" aria-label="Alert threshold">
          {ALERT_THRESHOLDS.map(({ value, label }) => {
            const isSelected = selectedThreshold === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => { setValue('alertThreshold', value); }}
                className={[
                  'flex-1 h-9 text-sm font-medium transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-ring',
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-foreground hover:bg-muted/50',
                ].join(' ')}
              >
                {label}
              </button>
            );
          })}
        </div>
        {/* hidden input to satisfy RHF registration */}
        <input type="hidden" {...register('alertThreshold', { valueAsNumber: true })} />
      </div>
    </form>
  );
}
