import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Info, Lightbulb } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { SlidePanel } from '@/shared/components/SlidePanel';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { ThresholdSlider } from '@/features/settings/components/ThresholdSlider';
import type { Category } from '@/shared/types/category.types';
import type { EnrichedBudget, SpendingVelocity } from '@/shared/types/budget.types';
import { useShallow } from 'zustand/react/shallow';
import { useDerivedKey, useCurrentUser } from '@/app/stores/session.store';
import { useBudgetPanel, useBudgetStore } from '@/app/stores/budget.store';
import { useBaseCurrency, usePreferencesStore } from '@/app/preferences.store';
import { useUIStore } from '@/app/ui.store';
import { categoryStorage } from '@/services/storage/category.storage';
import { budgetStorage } from '@/services/storage/budget.storage';
import { createBudgetForCycle } from '@/services/budgets/budget.service';
import type { UUID } from '@/shared/types/common.types';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const schema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  amount: z.string().min(1, 'Amount is required'),
  alertThreshold: z.number().min(50).max(100),
  carryForward: z.boolean(),
  applyToFuture: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function BudgetForm() {
  const { isPanelOpen, panelMode, activeBudget, closePanel } = useBudgetPanel();
  const { updateBudgetInList, removeBudgetFromList, addBudgetToList, cycleUtilization } =
    useBudgetStore(
      useShallow((s) => ({
        updateBudgetInList: s.updateBudgetInList,
        removeBudgetFromList: s.removeBudgetFromList,
        addBudgetToList: s.addBudgetToList,
        cycleUtilization: s.cycleUtilization,
      }))
    );
  const derivedKey = useDerivedKey();
  const currentUser = useCurrentUser();
  const { baseCurrency } = useBaseCurrency();
  const { defaultAlertThreshold, budgetCycleStartDay } = usePreferencesStore(
    useShallow((s) => ({
      defaultAlertThreshold: s.defaultAlertThreshold,
      budgetCycleStartDay: s.budgetCycleStartDay,
    }))
  );
  const addToast = useUIStore((s) => s.addToast);

  const [categories, setCategories] = useState<Category[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isEdit = panelMode === 'edit';
  const budgetedCategoryIds = new Set(
    cycleUtilization?.budgets.map((eb) => eb.budget.categoryId) ?? []
  );
  if (isEdit && activeBudget !== null) {
    budgetedCategoryIds.delete(activeBudget.categoryId);
  }

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      categoryId: activeBudget?.categoryId ?? '',
      amount: activeBudget ? String(activeBudget.amount) : '',
      alertThreshold: activeBudget?.alertThreshold ?? defaultAlertThreshold,
      carryForward: activeBudget?.carryForward ?? false,
      applyToFuture: true,
    },
  });

  const alertThreshold = watch('alertThreshold');
  const carryForward = watch('carryForward');
  const categoryId = watch('categoryId');

  // Load expense categories on open
  useEffect(() => {
    if (!isPanelOpen || !currentUser || !derivedKey) return;
    void categoryStorage.listCategoriesByUser(currentUser.id, derivedKey).then((result) => {
      if (result.success) {
        setCategories(result.data.filter((c) => c.transactionType === 'Expense' || !c.transactionType));
      }
    });
  }, [isPanelOpen, currentUser, derivedKey]);

  // Reset form on open/close
  useEffect(() => {
    if (isPanelOpen) {
      reset({
        categoryId: activeBudget?.categoryId ?? '',
        amount: activeBudget ? String(activeBudget.amount) : '',
        alertThreshold: activeBudget?.alertThreshold ?? defaultAlertThreshold,
        carryForward: activeBudget?.carryForward ?? false,
        applyToFuture: true,
      });
      setSubmitError(null);
    }
  }, [isPanelOpen, activeBudget, defaultAlertThreshold, reset]);

  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;
  const availableCategories = categories.filter((c) => !budgetedCategoryIds.has(c.id));

  const onSubmit = async (values: FormValues) => {
    if (!currentUser || !derivedKey) return;
    setSubmitError(null);

    const parsedAmount = parseFloat(values.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setSubmitError('Enter a valid amount greater than 0.');
      return;
    }

    if (isEdit && activeBudget !== null) {
      const result = await budgetStorage.updateBudget(
        activeBudget.id,
        {
          amount: parsedAmount,
          alertThreshold: values.alertThreshold,
          carryForward: values.carryForward,
        },
        derivedKey
      );
      if (!result.success) {
        setSubmitError(result.error.message);
        return;
      }
      updateBudgetInList(result.data);
      addToast({ type: 'success', message: 'Budget updated.' });
      closePanel();
      return;
    }

    // Add mode
    const result = await createBudgetForCycle(
      currentUser.id,
      {
        categoryId: values.categoryId as UUID,
        amount: parsedAmount,
        currency: baseCurrency,
        cycleStartDay: budgetCycleStartDay,
        carryForward: values.carryForward,
        alertThreshold: values.alertThreshold,
      },
      derivedKey
    );

    if (!result.success) {
      if (result.error.code === 'BUDGET_ALREADY_EXISTS') {
        setSubmitError('A budget for this category already exists this cycle.');
      } else {
        setSubmitError(result.error.message);
      }
      return;
    }

    // Build enriched budget for list
    const cat = categories.find((c) => c.id === values.categoryId);
    if (cat !== undefined && cycleUtilization !== null) {
      const today = new Date();
      const cycleStartDate = parseISO(cycleUtilization.cycleStart);
      const cycleEndDate = parseISO(cycleUtilization.cycleEnd);
      const daysInCycle = differenceInDays(cycleEndDate, cycleStartDate) + 1;
      const daysElapsed = Math.max(1, differenceInDays(today, cycleStartDate) + 1);
      const daysRemaining = Math.max(0, daysInCycle - daysElapsed);
      const velocity: SpendingVelocity = {
        dailyAverage: 0,
        projectedTotal: 0,
        projectedPercentUsed: 0,
        isOnTrack: true,
        daysRemaining,
      };
      const enriched: EnrichedBudget = {
        budget: result.data,
        category: cat,
        spent: 0,
        remaining: parsedAmount,
        percentUsed: 0,
        isOverBudget: false,
        isAlertTriggered: false,
        carryForwardAmount: 0,
        effectiveAmount: parsedAmount,
        velocity,
        transactions: [],
      };
      addBudgetToList(enriched);
    }

    addToast({ type: 'success', message: 'Budget added.' });
    closePanel();
  };

  const handleDelete = async () => {
    if (!activeBudget) return;
    const result = await budgetStorage.deleteBudget(activeBudget.id);
    if (result.success) {
      removeBudgetFromList(activeBudget.id);
      addToast({ type: 'success', message: 'Budget deleted.' });
    } else {
      addToast({ type: 'error', message: 'Failed to delete budget.' });
    }
    setDeleteDialogOpen(false);
    closePanel();
  };

  const editCategory = isEdit ? categories.find((c) => c.id === activeBudget?.categoryId) : null;

  return (
    <>
      <SlidePanel
        open={isPanelOpen}
        onClose={closePanel}
        title={isEdit ? 'Edit budget' : 'Add budget'}
        size="md"
      >
        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} className="flex flex-col h-full">
          <div className="flex flex-col gap-5 px-6 py-5 flex-1 overflow-y-auto">
            {/* Field 1: Category */}
            {isEdit ? (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Category</label>
                {editCategory !== null && editCategory !== undefined ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                    <div
                      className="w-5 h-5 rounded-full shrink-0"
                      style={{ backgroundColor: editCategory.color }}
                    />
                    <span className="text-sm font-medium text-foreground">{editCategory.name}</span>
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground mt-1">
                  Category cannot be changed after creation.
                </p>
              </div>
            ) : (
              <div>
                <label htmlFor="budget-category" className="block text-sm font-medium text-foreground mb-1.5">
                  Category
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  Categories already budgeted this cycle are excluded.
                </p>
                <select
                  id="budget-category"
                  {...register('categoryId')}
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select a category</option>
                  {availableCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {errors.categoryId !== undefined && (
                  <p className="text-xs text-destructive mt-1">{errors.categoryId.message}</p>
                )}
                {submitError !== null && submitError.includes('category') && (
                  <p className="text-xs text-destructive mt-1">{submitError}</p>
                )}
              </div>
            )}

            {/* Field 2: Monthly limit */}
            <div>
              <label htmlFor="budget-amount" className="block text-sm font-medium text-foreground mb-1.5">
                Monthly limit
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-2 py-1.5 rounded-md bg-muted text-muted-foreground shrink-0">
                  {baseCurrency}
                </span>
                <input
                  id="budget-amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="0.00"
                  {...register('amount')}
                  className="flex-1 h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              {selectedCategory !== null && errors.amount === undefined && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Lightbulb className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs text-muted-foreground">
                    Set a limit for {selectedCategory.name} expenses.
                  </span>
                </div>
              )}
              {errors.amount !== undefined && (
                <p className="text-xs text-destructive mt-1">{errors.amount.message}</p>
              )}
            </div>

            {/* Field 3: Alert threshold */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Alert threshold
              </label>
              <p className="text-xs text-muted-foreground mb-3">
                Notify when spending reaches this percentage.
              </p>
              <ThresholdSlider
                value={alertThreshold}
                onChange={(v) => { setValue('alertThreshold', v); }}
              />
            </div>

            {/* Field 4: Carry-forward */}
            <div>
              <div className="flex items-center justify-between py-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">Carry forward unspent amount</span>
                  <span className="text-xs text-muted-foreground">
                    Roll unspent budget into next month&apos;s cycle.
                  </span>
                </div>
                <input
                  type="checkbox"
                  {...register('carryForward')}
                  className="w-5 h-5 rounded cursor-pointer accent-primary"
                  aria-label="Carry forward unspent amount"
                />
              </div>
              {carryForward && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/40 border border-border animate-in slide-in-from-top-1 duration-200">
                  <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Unspent amounts from this cycle will be added to the same
                    category&apos;s budget in the next cycle.
                  </p>
                </div>
              )}
            </div>

            {/* Field 5: Apply to future cycles (add mode only) */}
            {!isEdit && (
              <div className="flex items-center justify-between py-2 border-t border-border">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">Apply to future cycles</span>
                  <span className="text-xs text-muted-foreground">
                    Automatically create this budget each month.
                  </span>
                </div>
                <input
                  type="checkbox"
                  {...register('applyToFuture')}
                  className="w-5 h-5 rounded cursor-pointer accent-primary"
                  aria-label="Apply to future cycles"
                />
              </div>
            )}

            {submitError !== null && !submitError.includes('category') && (
              <p className="text-xs text-destructive">{submitError}</p>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-card border-t border-border px-6 py-4 flex flex-col gap-2">
            {isEdit && (
              <button
                type="button"
                onClick={() => { setDeleteDialogOpen(true); }}
                className="text-sm text-destructive text-center cursor-pointer hover:text-destructive/80 transition-colors"
              >
                Delete budget
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 h-10 w-full rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all duration-150 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add budget'}
            </button>
          </div>
        </form>
      </SlidePanel>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={`Delete ${editCategory?.name ?? 'this'} budget?`}
        description="This will remove the budget for this cycle only."
        confirmLabel="Delete"
        destructive
        onConfirm={() => { void handleDelete(); }}
      />
    </>
  );
}
