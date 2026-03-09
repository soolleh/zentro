/**
 * AlertForm.tsx
 *
 * SlidePanel form for creating or editing an account balance alert.
 * Uses react-hook-form + zod for validation.
 */
import { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Bell, Smartphone, TrendingDown, TrendingUp, Trash2 } from 'lucide-react';
import { SlidePanel } from '@/shared/components/SlidePanel';
import { SegmentedControl } from '@/features/settings/components/SegmentedControl';
import { useAlertForm, useAlertStore } from '@/app/stores/alert.store';
import { alertStorage } from '@/services/storage/alert.storage';
import { useCurrentUser } from '@/app/stores/session.store';
import { useDerivedKey } from '@/app/stores/session.store';
import { usePWAStore } from '@/app/stores/pwa.store';
import { useAccounts } from '@/app/stores/account.store';
import { useUIStore } from '@/app/ui.store';
import { formatCurrency } from '@/shared/utils/currency.utils';
import type { AlertCondition } from '@/shared/types/alert.types';
import type { UUID, Currency } from '@/shared/types/common.types';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { useState } from 'react';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const alertSchema = z.object({
  condition: z.enum(['below', 'above']),
  threshold: z.string().min(1, 'Threshold is required').refine(
    (v) => {
      const n = parseFloat(v);
      return !isNaN(n) && n > 0;
    },
    { message: 'Threshold must be greater than 0' }
  ),
  label: z.string().max(50, 'Maximum 50 characters').optional(),
  notifyInApp: z.boolean(),
  notifyPush: z.boolean(),
}).refine((v) => v.notifyInApp || v.notifyPush, {
  message: 'Enable at least one notification method.',
  path: ['notifyInApp'],
});

type AlertFormValues = z.infer<typeof alertSchema>;

// ---------------------------------------------------------------------------
// Toggle helper
// ---------------------------------------------------------------------------

function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => { onChange(!checked); }}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
        'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        checked ? 'bg-primary' : 'bg-input',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-150',
          checked ? 'translate-x-4' : 'translate-x-0',
        ].join(' ')}
        aria-hidden="true"
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type AlertFormProps = {
  readonly accountId: UUID;
  readonly accountCurrency: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AlertForm({ accountId, accountCurrency }: AlertFormProps) {
  const { isFormOpen, formMode, activeAlert, activeAccountId, closeForm } = useAlertForm();
  const addAlertToList = useAlertStore((s) => s.addAlertToList);
  const updateAlertInList = useAlertStore((s) => s.updateAlertInList);
  const removeAlertFromList = useAlertStore((s) => s.removeAlertFromList);
  const currentUser = useCurrentUser();
  const derivedKey = useDerivedKey();
  const addToast = useUIStore((s) => s.addToast);
  const { notificationPermission } = usePWAStore();
  const { accounts } = useAccounts();
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Only render form for this account
  const isRelevant = isFormOpen && activeAccountId === accountId;

  const currentAccountRow = useMemo(
    () => accounts.find((a) => a.account.id === accountId),
    [accounts, accountId]
  );
  const currentBalance = currentAccountRow?.currentBalance ?? 0;

  const currency = (accountCurrency || currentAccountRow?.account.currency || 'USD') as Currency;
  const pushAllowed = notificationPermission === 'granted';

  const title = formMode === 'add' ? 'New Balance Alert' : 'Edit Alert';

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AlertFormValues>({
    resolver: zodResolver(alertSchema),
    defaultValues: {
      condition: (activeAlert?.condition ?? 'below') as AlertCondition,
      threshold: activeAlert?.threshold?.toString() ?? '',
      label: activeAlert?.label ?? '',
      notifyInApp: activeAlert?.notifyInApp ?? true,
      notifyPush: activeAlert?.notifyPush ?? pushAllowed,
    },
  });

  // Reset when form opens
  useEffect(() => {
    if (isRelevant) {
      reset({
        condition: (activeAlert?.condition ?? 'below') as AlertCondition,
        threshold: activeAlert?.threshold?.toString() ?? '',
        label: activeAlert?.label ?? '',
        notifyInApp: activeAlert?.notifyInApp ?? true,
        notifyPush: activeAlert?.notifyPush ?? pushAllowed,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRelevant, activeAlert?.id]);

  const watchedCondition = watch('condition');
  const watchedThreshold = parseFloat(watch('threshold') || '0');

  // Visual indicator: 0–100% positions for current balance and threshold
  const indicatorMax = Math.max(currentBalance, watchedThreshold, 1) * 1.2;
  const balancePos = Math.min((currentBalance / indicatorMax) * 100, 100);
  const thresholdPos = Math.min((watchedThreshold / indicatorMax) * 100, 100);

  const onSubmit = handleSubmit(async (values) => {
    if (!currentUser || !derivedKey) return;

    const threshold = parseFloat(values.threshold);
    const label = values.label ?? '';

    if (formMode === 'add') {
      const result = await alertStorage.createAlert(
        {
          userId: currentUser.id as UUID,
          accountId,
          condition: values.condition,
          threshold,
          currency,
          label,
          isEnabled: true,
          status: 'active',
          lastTriggeredAt: null,
          lastTriggeredBalance: null,
          snoozeUntil: null,
          notifyInApp: values.notifyInApp,
          notifyPush: values.notifyPush,
        },
        derivedKey
      );
      if (!result.success) {
        addToast({ type: 'error', message: result.error.message });
        return;
      }
      if (currentAccountRow) {
        addAlertToList(result.data, currentAccountRow.account);
      }
      addToast({ type: 'success', message: 'Alert created.' });
      closeForm();
    } else if (activeAlert) {
      const result = await alertStorage.updateAlert(
        activeAlert.id,
        { condition: values.condition, threshold, label, notifyInApp: values.notifyInApp, notifyPush: values.notifyPush },
        derivedKey
      );
      if (!result.success) {
        addToast({ type: 'error', message: 'Failed to update alert.' });
        return;
      }
      updateAlertInList(result.data);
      addToast({ type: 'success', message: 'Alert updated.' });
      closeForm();
    }
  });

  async function handleDelete() {
    if (!activeAlert) return;
    const result = await alertStorage.deleteAlert(activeAlert.id);
    if (result.success) {
      removeAlertFromList(activeAlert.id);
      addToast({ type: 'success', message: 'Alert deleted.' });
      closeForm();
    } else {
      addToast({ type: 'error', message: 'Failed to delete alert.' });
    }
  }

  if (!isRelevant) return null;

  return (
    <>
      <SlidePanel open={isRelevant} onClose={closeForm} size="sm" title={title}>
        <form onSubmit={(e) => { void onSubmit(e); }} className="flex flex-col gap-5 px-6 py-5 pb-32">
          {/* Account read-only display */}
          {currentAccountRow && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/40 border border-border">
              <span className="text-base" aria-hidden>
                {getAccountEmoji(currentAccountRow.account.type)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{currentAccountRow.account.name}</p>
                <p className="text-xs text-muted-foreground">
                  Balance: {formatCurrency(currentBalance, currency)}
                </p>
              </div>
            </div>
          )}

          {/* Condition segmented control */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Condition</label>
            <Controller
              name="condition"
              control={control}
              render={({ field }) => (
                <SegmentedControl
                  value={field.value}
                  onChange={field.onChange}
                  ariaLabel="Alert condition"
                  options={[
                    { value: 'below' as const, label: 'Below', icon: <TrendingDown className="w-3.5 h-3.5" aria-hidden /> },
                    { value: 'above' as const, label: 'Above', icon: <TrendingUp className="w-3.5 h-3.5" aria-hidden /> },
                  ]}
                />
              )}
            />
          </div>

          {/* Threshold input */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="alert-threshold" className="text-sm font-medium text-foreground">
              Alert when balance is {watchedCondition}
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-sm font-semibold text-muted-foreground pointer-events-none select-none">
                {currency}
              </span>
              <input
                id="alert-threshold"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                className="w-full h-12 rounded-xl border border-input bg-background pl-12 pr-4 text-lg font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                {...register('threshold')}
              />
            </div>
            {errors.threshold && (
              <p className="text-xs text-destructive">{errors.threshold.message}</p>
            )}

            {/* Current balance reference + visual indicator */}
            <p className="text-xs text-muted-foreground">
              Current balance: {formatCurrency(currentBalance, currency)}
            </p>
            <div className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden mt-1" aria-hidden>
              {/* Fill between markers */}
              {watchedCondition === 'below' && watchedThreshold < currentBalance && (
                <div
                  className="absolute top-0 h-full bg-destructive/40 rounded-full"
                  style={{ left: 0, width: `${thresholdPos.toString()}%` }}
                />
              )}
              {watchedCondition === 'above' && watchedThreshold > currentBalance && (
                <div
                  className="absolute top-0 h-full bg-[hsl(155_65%_42%/0.4)] rounded-full"
                  style={{ left: `${balancePos.toString()}%`, width: `${Math.max(0, thresholdPos - balancePos).toString()}%` }}
                />
              )}
              {/* Current balance marker */}
              <div
                className="absolute top-0 h-full w-0.5 bg-foreground rounded-full transition-all duration-150"
                style={{ left: `${balancePos.toString()}%` }}
              />
              {/* Threshold marker */}
              {watchedThreshold > 0 && (
                <div
                  className="absolute top-0 h-full w-0.5 bg-primary rounded-full transition-all duration-150"
                  style={{ left: `${thresholdPos.toString()}%` }}
                />
              )}
            </div>
          </div>

          {/* Label (optional) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="alert-label" className="text-sm font-medium text-foreground">
              Label <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              id="alert-label"
              type="text"
              maxLength={50}
              placeholder="e.g. Low balance warning, Savings minimum…"
              className="h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              {...register('label')}
            />
            {errors.label && (
              <p className="text-xs text-destructive">{errors.label.message}</p>
            )}
          </div>

          {/* Notification type */}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">Notify me via</p>
            <Controller
              name="notifyInApp"
              control={control}
              render={({ field }) => (
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2.5">
                    <Smartphone className="w-4 h-4 text-muted-foreground" aria-hidden />
                    <span className="text-sm text-foreground">In-app notification</span>
                  </div>
                  <Toggle checked={field.value} onChange={field.onChange} label="In-app notification" />
                </div>
              )}
            />
            <Controller
              name="notifyPush"
              control={control}
              render={({ field }) => (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2.5">
                      <Bell className="w-4 h-4 text-muted-foreground" aria-hidden />
                      <span className={['text-sm', !pushAllowed ? 'text-muted-foreground' : 'text-foreground'].join(' ')}>
                        Push notification
                      </span>
                    </div>
                    <Toggle
                      checked={field.value}
                      onChange={field.onChange}
                      disabled={!pushAllowed}
                      label="Push notification"
                    />
                  </div>
                  {!pushAllowed && (
                    <p className="text-xs text-muted-foreground pl-6">
                      Enable notifications in Settings to use this.
                    </p>
                  )}
                </div>
              )}
            />
            {errors.notifyInApp && (
              <p className="text-xs text-destructive">{errors.notifyInApp.message}</p>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-card border-t border-border -mx-6 px-6 py-4 mt-4 flex items-center gap-3">
            {formMode === 'edit' && (
              <button
                type="button"
                onClick={() => { setDeleteOpen(true); }}
                className="text-xs text-destructive hover:underline font-medium flex-1 text-left"
              >
                <Trash2 className="w-3.5 h-3.5 inline mr-1" aria-hidden />
                Delete alert
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className={[
                'rounded-lg px-5 py-2.5 text-sm font-medium bg-primary text-primary-foreground',
                'hover:bg-primary/90 transition-colors duration-150 disabled:opacity-60',
                formMode === 'add' ? 'w-full' : 'flex-shrink-0',
              ].join(' ')}
            >
              {isSubmitting ? 'Saving…' : 'Save alert'}
            </button>
          </div>
        </form>
      </SlidePanel>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete alert?"
        description="This will permanently remove this balance alert. This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => { void handleDelete(); }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function getAccountEmoji(type: string): string {
  const map: Record<string, string> = {
    Cash: '💵',
    Bank: '🏦',
    Checking: '🏦',
    Savings: '💰',
    CreditCard: '💳',
    Loan: '🔖',
    Investment: '📈',
  };
  return map[type] ?? '💳';
}
