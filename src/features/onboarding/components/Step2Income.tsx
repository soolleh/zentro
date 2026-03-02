import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Briefcase, Laptop, TrendingUp, Home, PlusCircle } from 'lucide-react';
import type { UUID, ISODateString } from '@/shared/types/common.types';
import { useCurrentUser, useDerivedKey } from '@/app/stores/session.store';
import { useOnboardingStep, useOnboardingStatus, useOnboardingData, useOnboardingStore } from '@/app/stores/onboarding.store';
import { useOnboardingSubmit } from '../hooks/useOnboardingSubmit';
import { createFirstIncome } from '@/services/onboarding/onboarding.service';
import { DatePicker } from '@/features/transactions/components/DatePicker';
import {
  CATEGORY_SALARY,
  CATEGORY_FREELANCE,
  CATEGORY_INVESTMENT_RETURNS,
  CATEGORY_RENTAL_INCOME,
  CATEGORY_OTHER_INCOME,
} from '@/shared/constants/categories.constants';

const FORM_ID = 'onboarding-step-form';
const TODAY = new Date().toISOString().slice(0, 10);

const INCOME_CATEGORY_OPTIONS = [
  { category: CATEGORY_SALARY, Icon: Briefcase },
  { category: CATEGORY_FREELANCE, Icon: Laptop },
  { category: CATEGORY_INVESTMENT_RETURNS, Icon: TrendingUp },
  { category: CATEGORY_RENTAL_INCOME, Icon: Home },
  { category: CATEGORY_OTHER_INCOME, Icon: PlusCircle },
];

const step2Schema = z.object({
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Amount must be greater than 0'),
  categoryId: z.string().min(1, 'Select an income category'),
  date: z
    .string()
    .min(1, 'Date is required')
    .refine((val) => !isNaN(new Date(val).getTime()) && val <= TODAY, 'Date cannot be in the future'),
  notes: z.string().max(200, 'Notes must be at most 200 characters').optional(),
});

type FormValues = z.infer<typeof step2Schema>;

export function Step2Income() {
  const currentUser = useCurrentUser();
  const derivedKey = useDerivedKey();
  const { nextStep, prevStep } = useOnboardingStep();
  const { stepError } = useOnboardingStatus();
  const { createdAccount } = useOnboardingData();
  const setCreatedTransaction = useOnboardingStore((s) => s.setCreatedTransaction);
  const { submit } = useOnboardingSubmit();

  const {
    register,
    control,
    watch,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      amount: '',
      categoryId: CATEGORY_SALARY.id,
      date: TODAY,
      notes: '',
    },
  });

  const selectedCategoryId = watch('categoryId');

  const onValid = async (values: FormValues) => {
    if (!currentUser || !derivedKey || !createdAccount) return;

    const tx = await (async () => {
      let captured: Parameters<typeof setCreatedTransaction>[0] | undefined;
      const ok = await submit(async () => {
        const result = await createFirstIncome(
          currentUser.id,
          {
            accountId: createdAccount.id,
            amount: parseFloat(values.amount),
            currency: createdAccount.currency,
            categoryId: values.categoryId as UUID,
            date: values.date as ISODateString,
            notes: values.notes?.trim() || undefined,
          },
          derivedKey
        );
        if (result.success) captured = result.data;
        return result;
      });
      return ok ? captured : undefined;
    })();

    if (tx) {
      setCreatedTransaction(tx);
      nextStep();
    }
  };

  const currency = createdAccount?.currency ?? 'USD';

  return (
    <form
      id={FORM_ID}
      onSubmit={(e) => { void handleSubmit(onValid)(e); }}
      className="flex flex-col gap-5"
      noValidate
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Record your primary income
        </h2>
        <p className="text-sm text-muted-foreground">
          Add your main source of income to set a starting baseline.
        </p>
      </div>

      {stepError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive" role="alert">
          {stepError}
        </div>
      )}

      {/* Account context */}
      {createdAccount && (
        <div className="flex items-center justify-between rounded-lg bg-muted/50 border border-border px-3 py-2.5">
          <div>
            <p className="text-xs text-muted-foreground">Recording to</p>
            <p className="text-sm font-medium text-foreground">{createdAccount.name}</p>
          </div>
          <button
            type="button"
            onClick={prevStep}
            className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Change
          </button>
        </div>
      )}

      {/* Category chips */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">Category</label>
        <div className="flex gap-2 flex-wrap">
          {INCOME_CATEGORY_OPTIONS.map(({ category, Icon }) => {
            const isSelected = selectedCategoryId === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => { setValue('categoryId', category.id, { shouldValidate: true }); }}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/30',
                ].join(' ')}
                aria-pressed={isSelected}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {category.name}
              </button>
            );
          })}
        </div>
        {errors.categoryId && (
          <p className="text-xs text-destructive" role="alert">{errors.categoryId.message}</p>
        )}
      </div>

      {/* Amount */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="incomeAmount" className="text-sm font-medium text-foreground">
          Monthly amount
        </label>
        <div className="flex items-center gap-2">
          <div className="h-10 px-3 rounded-lg border border-input bg-muted text-sm font-medium text-foreground flex items-center min-w-[52px] select-none">
            {currency}
          </div>
          <input
            id="incomeAmount"
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

      {/* Date */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Date received</label>
        <Controller
          name="date"
          control={control}
          render={({ field }) => (
            <DatePicker
              value={field.value ? (field.value as ISODateString) : null}
              onChange={(d) => { field.onChange(d); }}
              dateFormat="DD/MM/YYYY"
              error={errors.date?.message}
            />
          )}
        />
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="incomeNotes" className="text-sm font-medium text-foreground">
          Notes{' '}
          <span className="text-xs font-normal text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="incomeNotes"
          {...register('notes')}
          rows={2}
          placeholder="e.g. Monthly salary from Acme Corp"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {errors.notes && (
          <p className="text-xs text-destructive" role="alert">{errors.notes.message}</p>
        )}
      </div>
    </form>
  );
}
