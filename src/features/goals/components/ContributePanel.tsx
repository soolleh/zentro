import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatISO } from 'date-fns';
import { Zap } from 'lucide-react';
import { SlidePanel } from '@/shared/components/SlidePanel';
import { AccountSelector } from '@/features/transactions/components/AccountSelector';
import { DatePicker } from '@/features/transactions/components/DatePicker';
import { useShallow } from 'zustand/react/shallow';
import { useGoalPanel, useGoalStore } from '@/app/stores/goal.store';
import { useCurrentUser } from '@/app/stores/session.store';
import { useUIStore } from '@/app/ui.store';
import { contribute as goalContribute } from '@/services/goals/goal.service';
import { formatCurrency } from '@/shared/utils/currency.utils';
import type { UUID, ISODateString } from '@/shared/types/common.types';
import type { Account } from '@/shared/types/account.types';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const ContributeSchema = z.object({
  amount: z
    .number()
    .positive('Must be greater than 0'),
  fromAccountId: z.string().min(1, 'Select an account'),
  date: z.string().min(1, 'Date is required'),
  notes: z.string().optional(),
});

type ContributeFormValues = z.infer<typeof ContributeSchema>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ContributePanel() {
  const { isPanelOpen, panelMode, activeGoal, closePanel } = useGoalPanel();
  const { refreshGoal, setCelebrating } = useGoalStore(
    useShallow((s) => ({ refreshGoal: s.refreshGoal, setCelebrating: s.setCelebrating }))
  );
  const currentUser = useCurrentUser();
  const addToast = useUIStore((s) => s.addToast);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOpen = isPanelOpen && panelMode === 'contribute';
  const enriched = activeGoal;
  const goal = enriched?.goal;
  const projection = enriched?.projection;

  const {
    control,
    handleSubmit,
    register,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ContributeFormValues>({
    resolver: zodResolver(ContributeSchema),
    defaultValues: {
      amount: undefined,
      fromAccountId: goal?.linkedAccountId ?? '',
      date: formatISO(new Date(), { representation: 'date' }) as ISODateString,
      notes: '',
    },
  });

  // Monthly-pace suggestion chips
  const suggestions: number[] = [];
  if (projection?.requiredMonthlyAmount && projection.requiredMonthlyAmount > 0) {
    suggestions.push(
      Math.round(projection.requiredMonthlyAmount * 0.5),
      Math.round(projection.requiredMonthlyAmount),
      Math.round(projection.requiredMonthlyAmount * 2),
    );
  }

  function handleAccountChange(accountId: UUID, _account: Account) {
    setValue('fromAccountId', accountId);
  }

  function handleClose() {
    reset({
      amount: undefined,
      fromAccountId: goal?.linkedAccountId ?? '',
      date: formatISO(new Date(), { representation: 'date' }) as ISODateString,
      notes: '',
    });
    closePanel();
  }

  async function onSubmit(values: ContributeFormValues) {
    if (!currentUser || !goal) return;
    setIsSubmitting(true);
    try {
      const result = await goalContribute(currentUser.id, {
        goalId: goal.id,
        amount: values.amount,
        date: values.date as ISODateString,
        fromAccountId: values.fromAccountId as UUID,
        notes: values.notes || undefined,
      });

      if (!result.success) {
        addToast({ message: result.error.message, type: 'error' });
        return;
      }

      const { milestonesReached } = result.data;

      milestonesReached.forEach((m) => {
        addToast({
          message: `Milestone: ${String(m.percent)}% of ${goal.name} reached!`,
          type: 'success',
        });
      });

      await refreshGoal(currentUser.id, goal.id);

      if (milestonesReached.some((m) => m.percent === 100)) {
        setCelebrating(goal.id);
      }

      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!goal) return null;

  return (
    <SlidePanel open={isOpen} onClose={handleClose} size="sm" title="Add contribution">
      <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} className="flex flex-col gap-5 px-6 pt-4 pb-8">
        {/* Goal context */}
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0"
            style={{ backgroundColor: `${goal.color}26` }}
          >
            {goal.emoji ?? '🎯'}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{goal.name}</p>
            <p className="text-xs text-muted-foreground">
              {enriched.percentComplete.toFixed(0)}% complete ·{' '}
              {formatCurrency(enriched.remainingAmount, goal.currency)} to go
            </p>
          </div>
        </div>

        {/* Amount */}
        <div>
          <label
            htmlFor="contribute-amount"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
              {goal.currency}
            </span>
            <input
              id="contribute-amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              {...register('amount', { valueAsNumber: true })}
              className="w-full h-10 pl-12 pr-3 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {errors.amount && (
            <p className="text-xs text-destructive mt-1">{errors.amount.message}</p>
          )}
        </div>

        {/* Suggestion chips */}
        {suggestions.length > 0 && (
          <div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <Zap className="w-3 h-3" />
              Suggestions based on your target
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => { setValue('amount', chip); }}
                  className="px-3 py-1 rounded-full border border-border text-xs hover:border-primary hover:text-primary transition-colors duration-150"
                >
                  {formatCurrency(chip, goal.currency)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Account */}
        <Controller
          name="fromAccountId"
          control={control}
          render={({ field }) => (
            <AccountSelector
              value={(field.value as UUID) || null}
              onChange={handleAccountChange}
              label="From account"
              error={errors.fromAccountId?.message}
            />
          )}
        />

        {/* Date */}
        <Controller
          name="date"
          control={control}
          render={({ field }) => (
            <DatePicker
              value={(field.value as ISODateString) || null}
              onChange={field.onChange}
              label="Date"
              error={errors.date?.message}
            />
          )}
        />

        {/* Notes */}
        <div>
          <label
            htmlFor="contribute-notes"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            Notes <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <textarea
            id="contribute-notes"
            rows={2}
            placeholder="e.g. Monthly savings transfer"
            {...register('notes')}
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving…' : 'Add contribution'}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="h-10 rounded-xl border border-border text-sm text-foreground hover:bg-muted/60 transition-colors duration-150"
          >
            Cancel
          </button>
        </div>
      </form>
    </SlidePanel>
  );
}
