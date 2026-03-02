import { useState, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Camera, X, ArrowRight, CornerDownLeft, AlertTriangle } from 'lucide-react';
import type { Transaction, TransactionType, RecurringFrequency } from '@/shared/types/transaction.types';
import type { UUID, ISODateString, Currency } from '@/shared/types/common.types';
import { transactionStorage } from '@/services/storage/transaction.storage';
import { recurringRuleStorage } from '@/services/storage/recurring-rule.storage';
import { attachReceipt } from '@/services/transactions/transaction.service';
import { useShallow } from 'zustand/react/shallow';
import { useTransactionStore } from '@/app/stores/transaction.store';
import { useSessionStore } from '@/app/stores/session.store';
import { useUIStore } from '@/app/ui.store';
import { useDateFormat } from '@/app/preferences.store';
import { AccountSelector } from './AccountSelector';
import { CategorySelector } from './CategorySelector';
import { DatePicker } from './DatePicker';
import { RecurringSubForm } from './RecurringSubForm';
import { useAutofill } from '../hooks/useAutofill';
import type { Account } from '@/shared/types/account.types';

type FormValues = {
  type: TransactionType;
  amount: string;
  accountId: string;
  toAccountId: string;
  categoryId: string;
  date: string;
  notes: string;
  isRecurring: boolean;
  recurringFrequency: RecurringFrequency;
  recurringEndDate: string;
};

type TransactionFormProps = {
  transaction?: Transaction; // If provided = edit mode
  onClose: () => void;
};

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'Income', label: 'Income' },
  { value: 'Expense', label: 'Expense' },
  { value: 'Transfer', label: 'Transfer' },
];

const TYPE_SELECTED: Record<TransactionType, string> = {
  Income: 'bg-[hsl(var(--chart-4)/0.12)] text-[hsl(var(--chart-4))]',
  Expense: 'bg-muted text-foreground',
  Transfer: 'bg-[hsl(var(--chart-2)/0.12)] text-[hsl(var(--chart-2))]',
};

function ConfirmDeleteDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-card rounded-2xl shadow-xl p-6 max-w-sm w-full flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
          <h3 className="text-base font-semibold text-foreground">Delete Transaction</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          This action cannot be undone.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 h-10 rounded-lg border border-border text-sm font-medium">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="flex-1 h-10 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export function TransactionForm({ transaction, onClose }: TransactionFormProps) {
  const isEdit = !!transaction;
  const { currentUser, derivedKey } = useSessionStore(
    useShallow((s) => ({ currentUser: s.currentUser, derivedKey: s.derivedKey }))
  );
  const addTransactionToList = useTransactionStore((s) => s.addTransactionToList);
  const updateTransactionInList = useTransactionStore((s) => s.updateTransactionInList);
  const removeTransactionFromList = useTransactionStore((s) => s.removeTransactionFromList);
  const addToast = useUIStore((s) => s.addToast);
  const { dateFormat } = useDateFormat();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, control, watch, setValue, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      type: transaction?.type ?? 'Expense',
      amount: transaction?.amount.toString() ?? '',
      accountId: transaction?.accountId ?? '',
      toAccountId: '',
      categoryId: transaction?.categoryId ?? '',
      date: transaction?.date ?? new Date().toISOString(),
      notes: transaction?.notes ?? '',
      isRecurring: !!transaction?.recurringRuleId,
      recurringFrequency: 'Monthly' as RecurringFrequency,
      recurringEndDate: '',
    },
  });

  const watchedType = watch('type');
  const watchedNotes = watch('notes');
  const watchedIsRecurring = watch('isRecurring');
  const watchedFrequency = watch('recurringFrequency');
  const watchedEndDate = watch('recurringEndDate');

  const { suggestion, clearSuggestion } = useAutofill(watchedNotes, {
    userId: (currentUser?.id ?? '') as UUID,
    cryptoKey: derivedKey,
  });

  // When type changes, clear category
  useEffect(() => {
    setValue('categoryId', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedType]);

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setReceiptError('Image must be 2MB or smaller.');
      return;
    }
    setReceiptError('');
    setReceiptFile(file);
    const url = URL.createObjectURL(file);
    setReceiptPreview(url);
  };

  const removeReceipt = () => {
    setReceiptFile(null);
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceiptPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const applySuggestion = () => {
    if (!suggestion) return;
    setValue('notes', suggestion.notes);
    setValue('categoryId', suggestion.categoryId);
    clearSuggestion();
  };

  const onSubmit = async (values: FormValues) => {
    if (!currentUser || !derivedKey) return;
    setIsSubmitting(true);

    try {
      if (!values.amount || isNaN(parseFloat(values.amount))) {
        addToast({ type: 'error', message: 'Please enter a valid amount.' });
        return;
      }
      if (!values.accountId) {
        addToast({ type: 'error', message: 'Please select an account.' });
        return;
      }
      if (!values.categoryId && values.type !== 'Transfer') {
        addToast({ type: 'error', message: 'Please select a category.' });
        return;
      }
      if (!values.date) {
        addToast({ type: 'error', message: 'Please select a date.' });
        return;
      }

      let recurringRuleId: UUID | undefined;

      // Create recurring rule first if needed (add mode only)
      if (!isEdit && values.isRecurring) {
        const ruleResult = await recurringRuleStorage.createRule(
          {
            userId: currentUser.id,
            accountId: values.accountId as UUID,
            categoryId: (values.categoryId as UUID) || ('' as UUID),
            type: values.type,
            amount: parseFloat(values.amount),
            currency: (selectedAccount?.currency ?? 'USD') as Currency,
            frequency: values.recurringFrequency,
            interval: 1,
            startDate: values.date as ISODateString,
            endDate: values.recurringEndDate ? values.recurringEndDate as ISODateString : undefined,
            notes: values.notes || undefined,
          },
          derivedKey
        );
        if (ruleResult.success) {
          recurringRuleId = ruleResult.data.id;
        }
      }

      if (transaction) {
        // Edit mode
        const result = await transactionStorage.updateTransaction(
          transaction.id,
          {
            type: values.type,
            amount: parseFloat(values.amount),
            accountId: values.accountId as UUID,
            categoryId: values.categoryId as UUID,
            date: values.date as ISODateString,
            notes: values.notes || undefined,
          },
          derivedKey
        );
        if (!result.success) {
          addToast({ type: 'error', message: 'Failed to update transaction.' });
          return;
        }
        let updatedTx = result.data;
        if (receiptFile) {
          const receiptResult = await attachReceipt(updatedTx.id, receiptFile, derivedKey);
          if (receiptResult.success) updatedTx = receiptResult.data;
        }
        updateTransactionInList(updatedTx);
        addToast({ type: 'success', message: 'Transaction updated.' });
        onClose();
      } else {
        // Add mode
        const result = await transactionStorage.createTransaction(
          {
            userId: currentUser.id,
            accountId: values.accountId as UUID,
            type: values.type,
            amount: parseFloat(values.amount),
            currency: (selectedAccount?.currency ?? 'USD') as Currency,
            categoryId: values.categoryId as UUID,
            date: values.date as ISODateString,
            notes: values.notes || undefined,
            recurringRuleId,
            isReconciled: false,
          },
          derivedKey
        );
        if (!result.success) {
          addToast({ type: 'error', message: 'Failed to add transaction.' });
          return;
        }
        let newTx = result.data;
        if (receiptFile) {
          const receiptResult = await attachReceipt(newTx.id, receiptFile, derivedKey);
          if (receiptResult.success) newTx = receiptResult.data;
        }
        addTransactionToList(newTx);
        addToast({ type: 'success', message: 'Transaction added.' });
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!transaction) return;
    const result = await transactionStorage.deleteTransaction(transaction.id);
    if (result.success) {
      removeTransactionFromList(transaction.id);
      addToast({ type: 'success', message: 'Transaction deleted.' });
      onClose();
    } else {
      addToast({ type: 'error', message: 'Failed to delete transaction.' });
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
        <h2 className="text-base font-semibold text-foreground">
          {isEdit ? 'Edit transaction' : 'Add transaction'}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-150"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Form */}
      <form
        onSubmit={(e) => { e.preventDefault(); void handleSubmit(onSubmit)(e); }}
        className="flex flex-col gap-5 px-6 py-6 pb-0"
      >
        {/* Type selector */}
        <div className="flex rounded-lg border border-border bg-muted p-0.5 gap-0.5 w-full">
          {TYPE_OPTIONS.map((t) => (
            <Controller
              key={t.value}
              name="type"
              control={control}
              render={({ field }) => (
                <button
                  type="button"
                  onClick={() => { field.onChange(t.value); }}
                  className={[
                    'flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-all duration-100',
                    field.value === t.value
                      ? TYPE_SELECTED[t.value]
                      : 'text-muted-foreground hover:text-foreground',
                  ]
                    .join(' ')}
                >
                  {t.label}
                </button>
              )}
            />
          ))}
        </div>

        {/* Amount */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Amount</label>
          <div className="flex items-center gap-2">
            <div className="h-10 px-3 rounded-lg border border-input bg-muted text-sm font-medium text-foreground flex items-center min-w-[56px]">
              {selectedAccount?.currency ?? 'USD'}
            </div>
            <input
              {...register('amount', { required: true })}
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="0.00"
              className={`flex-1 h-10 rounded-lg border ${errors.amount ? 'border-destructive' : 'border-input'} bg-background px-3 text-sm font-semibold tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-ring`}
            />
          </div>
          {errors.amount && <p className="text-xs text-destructive">Amount is required.</p>}
        </div>

        {/* Account */}
        {watchedType === 'Transfer' ? (
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Controller
                name="accountId"
                control={control}
                render={({ field }) => (
                  <AccountSelector
                    value={field.value as UUID | null}
                    onChange={(id, acc) => { field.onChange(id); setSelectedAccount(acc); }}
                    label="From account"
                    error={errors.accountId ? 'Required' : undefined}
                  />
                )}
              />
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground mb-3 shrink-0" />
            <div className="flex-1">
              <Controller
                name="toAccountId"
                control={control}
                render={({ field }) => (
                  <AccountSelector
                    value={field.value as UUID | null}
                    onChange={(id) => { field.onChange(id); }}
                    label="To account"
                  />
                )}
              />
            </div>
          </div>
        ) : (
          <Controller
            name="accountId"
            control={control}
            render={({ field }) => (
              <AccountSelector
                value={field.value as UUID | null}
                onChange={(id, acc) => { field.onChange(id); setSelectedAccount(acc); }}
                error={errors.accountId ? 'Required' : undefined}
              />
            )}
          />
        )}

        {/* Category */}
        {watchedType !== 'Transfer' && (
          <Controller
            name="categoryId"
            control={control}
            render={({ field }) => (
              <CategorySelector
                value={field.value as UUID | null}
                onChange={(id) => { field.onChange(id); }}
                transactionType={watchedType}
                error={errors.categoryId ? 'Required' : undefined}
              />
            )}
          />
        )}

        {/* Date */}
        <Controller
          name="date"
          control={control}
          render={({ field }) => (
            <DatePicker
              value={field.value ? field.value as ISODateString : null}
              onChange={(d) => { field.onChange(d); }}
              dateFormat={dateFormat}
              error={errors.date ? 'Required' : undefined}
            />
          )}
        />

        {/* Notes with autofill */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">
            Notes{' '}
            <span className="text-xs text-muted-foreground ml-1">(optional)</span>
          </label>
          <textarea
            {...register('notes')}
            placeholder="Add a note…"
            className="min-h-[72px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {suggestion && (
            <button
              type="button"
              onClick={applySuggestion}
              onKeyDown={(e) => {
                if (e.key === 'Escape') clearSuggestion();
              }}
              className="rounded-lg border border-border bg-muted/40 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-muted/60 transition-all duration-150 animate-in fade-in-0 slide-in-from-bottom-1 duration-150"
            >
              <span className="text-xs text-muted-foreground">
                Suggested:{' '}
                <span className="text-xs font-medium text-foreground">{suggestion.notes}</span>
              </span>
              <CornerDownLeft className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Receipt */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">Receipt</label>
            <span className="text-xs text-muted-foreground">(optional)</span>
          </div>
          {receiptPreview ? (
            <div className="relative w-full rounded-xl border border-border overflow-hidden">
              <img src={receiptPreview} alt="Receipt preview" className="w-full h-40 object-cover" />
              <button
                type="button"
                onClick={removeReceipt}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center"
                aria-label="Remove receipt"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { fileInputRef.current?.click(); }}
              className="w-full rounded-xl border-2 border-dashed border-border bg-muted/20 flex flex-col items-center justify-center py-6 gap-2 cursor-pointer hover:bg-muted/40 hover:border-primary/50 transition-all duration-150"
            >
              <Camera className="w-6 h-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Tap to attach receipt</span>
              <span className="text-xs text-muted-foreground">Max 2MB · JPG, PNG, WEBP</span>
            </button>
          )}
          {receiptError && <p className="text-xs text-destructive">{receiptError}</p>}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleReceiptChange}
            className="hidden"
          />
        </div>

        {/* Recurring */}
        <RecurringSubForm
          enabled={watchedIsRecurring}
          onToggle={(enabled) => { setValue('isRecurring', enabled); }}
          frequency={watchedFrequency}
          onFrequencyChange={(freq) => { setValue('recurringFrequency', freq); }}
          endDate={watchedEndDate ? watchedEndDate as ISODateString : null}
          onEndDateChange={(d) => { setValue('recurringEndDate', d ?? ''); }}
        />

        {/* Padding for sticky footer */}
        <div className="h-32" />
      </form>

      {/* Footer */}
      <div className="sticky bottom-0 bg-card border-t border-border px-6 py-4 flex flex-col gap-2">
        {isEdit && (
          <button
            type="button"
            onClick={() => { setShowDeleteConfirm(true); }}
            className="text-sm text-destructive hover:text-destructive/80 text-center cursor-pointer transition-colors duration-150"
          >
            Delete transaction
          </button>
        )}
        <button
          type="submit"
          form="transaction-form"
          disabled={isSubmitting}
          onClick={(e) => { e.preventDefault(); void handleSubmit(onSubmit)(); }}
          className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-150 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving…
            </>
          ) : isEdit ? (
            'Save changes'
          ) : (
            'Add transaction'
          )}
        </button>
      </div>

      {/* Delete confirm dialog */}
      {showDeleteConfirm && (
        <ConfirmDeleteDialog
          onConfirm={() => {
            setShowDeleteConfirm(false);
            void handleDelete();
          }}
          onCancel={() => { setShowDeleteConfirm(false); }}
        />
      )}
    </>
  );
}
