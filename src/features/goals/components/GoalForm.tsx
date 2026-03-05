import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatISO } from 'date-fns';
import { Trash2, Smile } from 'lucide-react';
import { SlidePanel } from '@/shared/components/SlidePanel';
import { AccountSelector } from '@/features/transactions/components/AccountSelector';
import { DatePicker } from '@/features/transactions/components/DatePicker';
import { EmojiPicker } from './EmojiPicker';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { useShallow } from 'zustand/react/shallow';
import { useGoalPanel, useGoalStore } from '@/app/stores/goal.store';
import { useCurrentUser } from '@/app/stores/session.store';
import { useBaseCurrency } from '@/app/preferences.store';
import { useUIStore } from '@/app/ui.store';
import {
  createGoalWithContributions,
  deleteGoalWithContributions,
} from '@/services/goals/goal.service';
import { goalStorage } from '@/services/storage/goal.storage';
import { useSessionStore } from '@/app/stores/session.store';
import type { UUID, ISODateString } from '@/shared/types/common.types';
import type { Account } from '@/shared/types/account.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GOAL_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
];

const TITLE = { add: 'New goal', edit: 'Edit goal' };

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const GoalSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60, 'Max 60 characters'),
  emoji: z.string().optional(),
  targetAmount: z
    .number()
    .positive('Must be greater than 0'),
  color: z.string().min(1, 'Select a color'),
  targetDate: z.string().optional(),
  linkedAccountId: z.string().optional(),
  // initial contribution (add mode only)
  enableInitial: z.boolean().optional(),
  initialAmount: z.number().optional(),
  initialAccountId: z.string().optional(),
});

type GoalFormValues = z.infer<typeof GoalSchema>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GoalForm() {
  const { isPanelOpen, panelMode, activeGoal, closePanel } = useGoalPanel();
  const {
    addGoalToList,
    refreshGoal,
    removeGoalFromList,
    setFeaturedGoal,
  } = useGoalStore(
    useShallow((s) => ({
      addGoalToList: s.addGoalToList,
      refreshGoal: s.refreshGoal,
      removeGoalFromList: s.removeGoalFromList,
      setFeaturedGoal: s.setFeaturedGoal,
    }))
  );
  const currentUser = useCurrentUser();
  const { baseCurrency } = useBaseCurrency();
  const addToast = useUIStore((s) => s.addToast);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOpen = isPanelOpen && (panelMode === 'add' || panelMode === 'edit');
  const isEdit = panelMode === 'edit';
  const editGoal = activeGoal?.goal;

  const {
    control,
    handleSubmit,
    register,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<GoalFormValues>({
    resolver: zodResolver(GoalSchema),
    values: {
      name: editGoal?.name ?? '',
      emoji: editGoal?.emoji ?? '',
      targetAmount: editGoal?.targetAmount ?? (undefined as unknown as number),
      color: editGoal?.color ?? GOAL_COLORS[5],
      targetDate: editGoal?.targetDate ?? '',
      linkedAccountId: editGoal?.linkedAccountId ?? '',
      enableInitial: false,
      initialAmount: undefined,
      initialAccountId: '',
    },
  });

  const watchColor = watch('color');
  const watchEmoji = watch('emoji');
  const watchEnableInitial = watch('enableInitial');

  function handleAccountChange(accountId: UUID, _account: Account) {
    setValue('linkedAccountId', accountId);
  }

  function handleInitialAccountChange(accountId: UUID, _account: Account) {
    setValue('initialAccountId', accountId);
  }

  function handleClose() {
    reset();
    setShowEmojiPicker(false);
    closePanel();
  }

  async function onSubmit(values: GoalFormValues) {
    if (!currentUser) return;
    setIsSubmitting(true);
    try {
      if (isEdit && editGoal) {
        const key = useSessionStore.getState().derivedKey;
        if (!key) {
          addToast({ message: 'Session expired. Please log in again.', type: 'error' });
          return;
        }
        const result = await goalStorage.updateGoal(
          editGoal.id,
          {
            name: values.name,
            emoji: values.emoji || undefined,
            targetAmount: values.targetAmount,
            color: values.color,
            targetDate: values.targetDate ? (values.targetDate as ISODateString) : undefined,
            linkedAccountId: values.linkedAccountId
              ? (values.linkedAccountId as UUID)
              : undefined,
          },
          key
        );
        if (!result.success) {
          addToast({ message: result.error.message, type: 'error' });
          return;
        }
        await refreshGoal(currentUser.id, editGoal.id);
        addToast({ message: `"${values.name}" updated.`, type: 'success' });
        handleClose();
      } else {
        const today = formatISO(new Date(), { representation: 'date' });
        const result = await createGoalWithContributions(
          currentUser.id,
          {
            userId: currentUser.id,
            name: values.name,
            emoji: values.emoji || undefined,
            targetAmount: values.targetAmount,
            currency: baseCurrency,
            color: values.color,
            targetDate: values.targetDate ? (values.targetDate as ISODateString) : undefined,
            linkedAccountId: values.linkedAccountId
              ? (values.linkedAccountId as UUID)
              : undefined,
            completedAt: undefined,
          },
          values.enableInitial && values.initialAmount && values.initialAmount > 0
            ? {
              amount: values.initialAmount,
              fromAccountId: values.initialAccountId as UUID,
              date: today as ISODateString,
            }
            : undefined
        );
        if (!result.success) {
          addToast({ message: result.error.message, type: 'error' });
          return;
        }
        addGoalToList(result.data);
        setFeaturedGoal(result.data.goal.id);
        addToast({ message: `Goal "${values.name}" created!`, type: 'success' });
        handleClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!editGoal) return;
    setIsDeleting(true);
    try {
      const result = await deleteGoalWithContributions(editGoal.id);
      if (!result.success) {
        addToast({ message: result.error.message, type: 'error' });
        return;
      }
      removeGoalFromList(editGoal.id);
      setShowDeleteConfirm(false);
      addToast({ message: `Goal "${editGoal.name}" deleted.`, type: 'success' });
      handleClose();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <SlidePanel
        open={isOpen}
        onClose={handleClose}
        size="md"
        title={isEdit ? TITLE.edit : TITLE.add}
      >
        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} className="flex flex-col gap-5 px-6 pt-4 pb-8">
          {/* Name + Emoji */}
          <div>
            <label
              htmlFor="goal-name"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Goal name
            </label>
            <div className="flex gap-2">
              {/* Emoji toggle */}
              <button
                type="button"
                onClick={() => { setShowEmojiPicker((v) => !v); }}
                className="w-10 h-10 rounded-lg border border-border bg-muted/40 flex items-center justify-center text-lg hover:bg-muted/70 transition-colors duration-150 shrink-0"
                aria-label="Pick emoji"
              >
                {watchEmoji ? (
                  <span>{watchEmoji}</span>
                ) : (
                  <Smile className="w-5 h-5 text-muted-foreground" />
                )}
              </button>
              <input
                id="goal-name"
                type="text"
                placeholder="e.g. Emergency fund"
                {...register('name')}
                className="flex-1 h-10 px-3 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {errors.name && (
              <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
            )}
            {/* Emoji picker dropdown */}
            {showEmojiPicker && (
              <div className="mt-2 rounded-xl border border-border bg-card shadow-md p-3">
                <EmojiPicker
                  value={watchEmoji ?? ''}
                  onChange={(emoji: string) => {
                    setValue('emoji', emoji);
                    setShowEmojiPicker(false);
                  }}
                />
              </div>
            )}
          </div>

          {/* Target amount */}
          <div>
            <label
              htmlFor="goal-target"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Target amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                {baseCurrency}
              </span>
              <input
                id="goal-target"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                {...register('targetAmount', { valueAsNumber: true })}
                className="w-full h-10 pl-14 pr-3 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {errors.targetAmount && (
              <p className="text-xs text-destructive mt-1">{errors.targetAmount.message}</p>
            )}
          </div>

          {/* Color swatches */}
          <div>
            <p className="block text-sm font-medium text-foreground mb-2">Color</p>
            <div className="flex flex-wrap gap-2">
              {GOAL_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setValue('color', c); }}
                  className="w-8 h-8 rounded-full transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring"
                  style={{
                    backgroundColor: c,
                    boxShadow: watchColor === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined,
                  }}
                  aria-label={`Color ${c}`}
                  aria-pressed={watchColor === c}
                />
              ))}
            </div>
          </div>

          {/* Target date */}
          <Controller
            name="targetDate"
            control={control}
            render={({ field }) => (
              <DatePicker
                value={(field.value as ISODateString) || null}
                onChange={field.onChange}
                label="Target date (optional)"
                error={errors.targetDate?.message}
              />
            )}
          />

          {/* Linked account */}
          <Controller
            name="linkedAccountId"
            control={control}
            render={({ field }) => (
              <AccountSelector
                value={(field.value as UUID) || null}
                onChange={handleAccountChange}
                label="Linked savings account (optional)"
                placeholder="None"
                error={errors.linkedAccountId?.message}
              />
            )}
          />

          {/* Initial contribution toggle (add mode only) */}
          {!isEdit && (
            <div className="flex flex-col gap-3 rounded-xl border border-border px-4 py-4 bg-muted/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Add initial contribution</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Optional: start this goal with a first deposit
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={watchEnableInitial}
                  onClick={() => { setValue('enableInitial', !watchEnableInitial); }}
                  className={[
                    'relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring',
                    watchEnableInitial ? 'bg-primary' : 'bg-muted',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
                      watchEnableInitial ? 'translate-x-5' : 'translate-x-0',
                    ].join(' ')}
                  />
                </button>
              </div>
              {watchEnableInitial && (
                <div className="flex flex-col gap-3 pt-1">
                  <div>
                    <label
                      htmlFor="initial-amount"
                      className="block text-xs font-medium text-muted-foreground mb-1"
                    >
                      Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                        {baseCurrency}
                      </span>
                      <input
                        id="initial-amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        {...register('initialAmount', { valueAsNumber: true })}
                        className="w-full h-9 pl-12 pr-3 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                  <Controller
                    name="initialAccountId"
                    control={control}
                    render={({ field }) => (
                      <AccountSelector
                        value={(field.value as UUID) || null}
                        onChange={handleInitialAccountChange}
                        label="From account"
                      />
                    )}
                  />
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? isEdit
                  ? 'Saving…'
                  : 'Creating…'
                : isEdit
                  ? 'Save changes'
                  : 'Create goal'}
            </button>
            {isEdit && (
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(true); }}
                className="h-10 rounded-xl border border-destructive/40 text-destructive text-sm hover:bg-destructive/10 transition-colors duration-150 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete goal
              </button>
            )}
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

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete goal?"
        description={`"${editGoal?.name ?? 'This goal'}" and all its contribution records will be permanently deleted. This cannot be undone.`}
        confirmLabel={isDeleting ? 'Deleting…' : 'Delete'}
        destructive
        onConfirm={() => { void handleDelete(); }}
      />
    </>
  );
}
