import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Trash2 } from 'lucide-react';
import { SlidePanel } from '@/shared/components/SlidePanel';
import { AccountSelector } from '@/features/transactions/components/AccountSelector';
import { CategorySelector } from '@/features/transactions/components/CategorySelector';
import { useTemplateStore, useTemplatePanel } from '@/app/stores/template.store';
import { useSessionStore } from '@/app/stores/session.store';
import { useUIStore } from '@/app/ui.store';
import { useBaseCurrency } from '@/app/preferences.store';
import { createTemplateManually } from '@/services/templates/template.service';
import { templateStorage } from '@/services/storage/template.storage';
import type { UUID } from '@/shared/types/common.types';
import type { TransactionType } from '@/shared/types/transaction.types';
import type { CreateTemplateParams } from '@/shared/types/template.types';
import { TEMPLATE_COLORS } from '@/services/templates/template.service';
import { useShallow } from 'zustand/react/shallow';

const EMOJIS_BY_TYPE: Record<TransactionType, string> = {
  Income: '💰',
  Expense: '💸',
  Transfer: '🔄',
};

const COMMON_EMOJIS = [
  '💰', '💸', '🔄', '🏠', '🚗', '🛒', '☕', '🍔', '✈️', '🎮',
  '💊', '🎓', '💼', '🏋️', '🎁', '⛽', '🐾', '📱', '🎵', '🍕',
];

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'Income', label: 'Income' },
  { value: 'Expense', label: 'Expense' },
  { value: 'Transfer', label: 'Transfer' },
];

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Max 50 characters'),
  description: z.string().max(100, 'Max 100 characters').optional(),
  type: z.enum(['Income', 'Expense', 'Transfer'] as const),
  fixedAmount: z.boolean(),
  amount: z.string().optional(),
  fixedAccount: z.boolean(),
  accountId: z.string().optional(),
  fixedToAccount: z.boolean(),
  toAccountId: z.string().optional(),
  categoryId: z.string().optional(),
  notes: z.string().optional(),
  emoji: z.string().min(1),
  color: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

type TemplateFormProps = {
  open: boolean;
};

export function TemplateForm({ open }: TemplateFormProps) {
  const { activeTemplate, formMode, closeFormPanel } = useTemplatePanel();
  const addTemplateToList = useTemplateStore((s) => s.addTemplateToList);
  const updateTemplateInList = useTemplateStore((s) => s.updateTemplateInList);
  const removeTemplateFromList = useTemplateStore((s) => s.removeTemplateFromList);
  const addToast = useUIStore((s) => s.addToast);
  const { currentUser, derivedKey } = useSessionStore(
    useShallow((s) => ({
      currentUser: s.currentUser,
      derivedKey: s.derivedKey,
    })),
  );
  const { baseCurrency } = useBaseCurrency();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const isEdit = formMode === 'edit' && !!activeTemplate;

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      description: '',
      type: 'Expense',
      fixedAmount: false,
      amount: '',
      fixedAccount: false,
      accountId: '',
      fixedToAccount: false,
      toAccountId: '',
      categoryId: '',
      notes: '',
      emoji: EMOJIS_BY_TYPE.Expense,
      color: TEMPLATE_COLORS[5],
    },
  });

  const watchType = watch('type');
  const watchFixedAmount = watch('fixedAmount');
  const watchFixedAccount = watch('fixedAccount');
  const watchFixedToAccount = watch('fixedToAccount');
  const watchEmoji = watch('emoji');
  const watchColor = watch('color');
  const watchName = watch('name');

  // Sync emoji when type changes (only if it's the default)
  useEffect(() => {
    if (!isEdit) {
      const currentEmoji = watchEmoji;
      const isDefault = Object.values(EMOJIS_BY_TYPE).includes(currentEmoji as string);
      if (isDefault) {
        setValue('emoji', EMOJIS_BY_TYPE[watchType]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchType]);

  // Pre-fill when editing
  useEffect(() => {
    if (!open) return;
    if (isEdit && activeTemplate) {
      reset({
        name: activeTemplate.name,
        description: activeTemplate.description,
        type: activeTemplate.type,
        fixedAmount: activeTemplate.amount !== null,
        amount: activeTemplate.amount !== null ? String(activeTemplate.amount) : '',
        fixedAccount: activeTemplate.accountId !== null,
        accountId: activeTemplate.accountId ?? '',
        fixedToAccount: activeTemplate.toAccountId !== null,
        toAccountId: activeTemplate.toAccountId ?? '',
        categoryId: activeTemplate.categoryId ?? '',
        notes: activeTemplate.notes,
        emoji: activeTemplate.emoji,
        color: activeTemplate.color,
      });
    } else {
      reset({
        name: '',
        description: '',
        type: 'Expense',
        fixedAmount: false,
        amount: '',
        fixedAccount: false,
        accountId: '',
        fixedToAccount: false,
        toAccountId: '',
        categoryId: '',
        notes: '',
        emoji: EMOJIS_BY_TYPE.Expense,
        color: TEMPLATE_COLORS[5],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeTemplate?.id, formMode]);

  function handleClose() {
    reset();
    setShowEmojiPicker(false);
    closeFormPanel();
  }

  async function onSubmit(values: FormValues) {
    if (!currentUser || !derivedKey) return;
    setIsSubmitting(true);
    try {
      const params: CreateTemplateParams = {
        name: values.name,
        description: values.description ?? '',
        type: values.type,
        amount: values.fixedAmount && values.amount ? parseFloat(values.amount) : null,
        currency: baseCurrency,
        accountId: values.fixedAccount && values.accountId ? (values.accountId as UUID) : null,
        toAccountId:
          values.type === 'Transfer' && values.fixedToAccount && values.toAccountId
            ? (values.toAccountId as UUID)
            : null,
        categoryId: values.categoryId ? (values.categoryId as UUID) : null,
        tagIds: [],
        notes: values.notes ?? '',
        emoji: values.emoji,
        color: values.color,
      };

      if (isEdit && activeTemplate) {
        const result = await templateStorage.updateTemplate(
          activeTemplate.id,
          {
            name: params.name,
            description: params.description ?? '',
            type: params.type,
            amount: params.amount ?? null,
            currency: params.currency,
            accountId: params.accountId ?? null,
            toAccountId: params.toAccountId ?? null,
            categoryId: params.categoryId ?? null,
            tagIds: params.tagIds ?? [],
            notes: params.notes ?? '',
            emoji: params.emoji ?? EMOJIS_BY_TYPE[params.type],
            color: params.color ?? TEMPLATE_COLORS[5],
            isRecurring: activeTemplate.isRecurring,
            recurringFrequency: activeTemplate.recurringFrequency,
          },
          derivedKey
        );
        if (!result.success) {
          addToast({ message: result.error.message, type: 'error' });
          return;
        }
        updateTemplateInList(result.data);
        addToast({ message: `"${result.data.name}" updated.`, type: 'success' });
      } else {
        const result = await createTemplateManually(
          currentUser.id as UUID,
          params,
          derivedKey
        );
        if (!result.success) {
          addToast({ message: result.error.message, type: 'error' });
          return;
        }
        addTemplateToList(result.data);
        addToast({ message: `Template "${result.data.name}" saved.`, type: 'success' });
      }

      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!activeTemplate) return;
    setIsDeleting(true);
    try {
      const result = await templateStorage.deleteTemplate(activeTemplate.id);
      if (!result.success) {
        addToast({ message: result.error.message, type: 'error' });
        return;
      }
      removeTemplateFromList(activeTemplate.id);
      addToast({ message: 'Template deleted.', type: 'success' });
      handleClose();
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  return (
    <>
      <SlidePanel
        open={open}
        onClose={handleClose}
        size="md"
        title={isEdit ? 'Edit template' : 'New template'}
      >
        <form
          id="template-form"
          onSubmit={(e) => { void handleSubmit(onSubmit)(e); }}
          className="flex flex-col gap-5 px-6 py-5 pb-36"
        >
          {/* Name */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="tpl-name" className="text-sm font-medium text-foreground">
                Template name
              </label>
              <span className="text-xs text-muted-foreground">{watchName.length}/50</span>
            </div>
            <input
              id="tpl-name"
              type="text"
              placeholder="Monthly rent, Coffee run, Gym membership…"
              maxLength={50}
              {...register('name')}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.name && (
              <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="tpl-desc" className="block text-sm font-medium text-foreground mb-1.5">
              Description{' '}
              <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="tpl-desc"
              rows={2}
              placeholder="Optional note about this template."
              maxLength={100}
              {...register('description')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none min-h-[48px]"
            />
          </div>

          {/* Emoji + Color */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Icon &amp; color
            </label>
            <div className="flex items-center gap-3">
              {/* Emoji picker trigger */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setShowEmojiPicker((p) => !p); }}
                  className="w-10 h-10 rounded-lg border border-border bg-muted/40 flex items-center justify-center text-lg hover:bg-muted/70 transition-colors duration-150 shrink-0"
                  aria-label="Choose emoji"
                >
                  {watchEmoji}
                </button>
                {showEmojiPicker && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => { setShowEmojiPicker(false); }}
                    />
                    <div className="absolute left-0 top-full mt-1 z-20 bg-card border border-border rounded-xl p-2 shadow-lg grid grid-cols-7 gap-1 w-[220px]">
                      {COMMON_EMOJIS.map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => {
                            setValue('emoji', e);
                            setShowEmojiPicker(false);
                          }}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-base hover:bg-muted transition-colors ${watchEmoji === e ? 'bg-primary/10 ring-1 ring-primary' : ''
                            }`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Color swatches */}
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { setValue('color', c); }}
                    className={`w-6 h-6 rounded-full transition-transform duration-100 hover:scale-110 ${watchColor === c ? 'ring-2 ring-offset-2 ring-ring scale-110' : ''
                      }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Select color ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Transaction type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Transaction type
            </label>
            <div className="flex rounded-lg border border-border overflow-hidden">
              {TYPE_OPTIONS.map(({ value, label }) => (
                <Controller
                  key={value}
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <button
                      type="button"
                      onClick={() => { field.onChange(value); }}
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${field.value === value
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                        }`}
                    >
                      {label}
                    </button>
                  )}
                />
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Amount</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {watchFixedAmount ? 'Fixed amount' : 'Variable (ask on use)'}
                </span>
                <Controller
                  name="fixedAmount"
                  control={control}
                  render={({ field }) => (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={field.value}
                      onClick={() => { field.onChange(!field.value); }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${field.value ? 'bg-primary' : 'bg-muted'
                        }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${field.value ? 'translate-x-4' : 'translate-x-0'
                          }`}
                      />
                    </button>
                  )}
                />
              </div>
            </div>
            {watchFixedAmount ? (
              <div className="flex items-center gap-2 mt-2">
                <span className="shrink-0 text-xs font-medium text-muted-foreground border border-border rounded-lg px-2.5 py-2 bg-muted/40">
                  {baseCurrency}
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  {...register('amount')}
                  className="flex-1 h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic mt-2">
                User will enter amount each time.
              </p>
            )}
          </div>

          {/* From account */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">
                {watchType === 'Transfer' ? 'From account' : 'Account'}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {watchFixedAccount ? 'Fixed' : 'Ask on use'}
                </span>
                <Controller
                  name="fixedAccount"
                  control={control}
                  render={({ field }) => (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={field.value}
                      onClick={() => { field.onChange(!field.value); }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${field.value ? 'bg-primary' : 'bg-muted'
                        }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${field.value ? 'translate-x-4' : 'translate-x-0'
                          }`}
                      />
                    </button>
                  )}
                />
              </div>
            </div>
            {watchFixedAccount ? (
              <Controller
                name="accountId"
                control={control}
                render={({ field }) => (
                  <AccountSelector
                    value={field.value ? (field.value as UUID) : null}
                    onChange={(id) => { field.onChange(id); }}
                    label=""
                    placeholder="Select account"
                  />
                )}
              />
            ) : (
              <p className="text-xs text-muted-foreground italic">
                User will select account each time.
              </p>
            )}
          </div>

          {/* To account — Transfer only */}
          {watchType === 'Transfer' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">To account</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {watchFixedToAccount ? 'Fixed' : 'Ask on use'}
                  </span>
                  <Controller
                    name="fixedToAccount"
                    control={control}
                    render={({ field }) => (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={field.value}
                        onClick={() => { field.onChange(!field.value); }}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${field.value ? 'bg-primary' : 'bg-muted'
                          }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${field.value ? 'translate-x-4' : 'translate-x-0'
                            }`}
                        />
                      </button>
                    )}
                  />
                </div>
              </div>
              {watchFixedToAccount ? (
                <Controller
                  name="toAccountId"
                  control={control}
                  render={({ field }) => (
                    <AccountSelector
                      value={field.value ? (field.value as UUID) : null}
                      onChange={(id) => { field.onChange(id); }}
                      label=""
                      placeholder="Select destination account"
                    />
                  )}
                />
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  User will select destination account each time.
                </p>
              )}
            </div>
          )}

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Category{' '}
              <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </label>
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <CategorySelector
                  value={field.value ? (field.value as UUID) : null}
                  onChange={(id) => { field.onChange(id ?? ''); }}
                  transactionType={watchType}
                />
              )}
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="tpl-notes" className="block text-sm font-medium text-foreground mb-1.5">
              Notes{' '}
              <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="tpl-notes"
              rows={2}
              placeholder="Default notes for this template…"
              {...register('notes')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="sticky bottom-0 bg-card border-t border-border px-6 py-4 flex flex-col gap-2">
          {isEdit && (
            <button
              type="button"
              onClick={() => { setShowDeleteConfirm(true); }}
              className="text-sm text-destructive hover:text-destructive/80 text-center cursor-pointer transition-colors duration-150"
            >
              Delete template
            </button>
          )}
          <button
            type="submit"
            form="template-form"
            disabled={isSubmitting}
            className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-150 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              'Save template'
            )}
          </button>
        </div>
      </SlidePanel>

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => { setShowDeleteConfirm(false); }}
          />
          <div className="relative bg-card rounded-2xl p-6 max-w-sm w-full flex flex-col gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <Trash2 className="w-5 h-5 text-destructive shrink-0" />
              <h3 className="text-base font-semibold text-foreground">Delete template?</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              This cannot be undone. Transactions created from this template are not affected.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(false); }}
                className="flex-1 h-10 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => { void handleDelete(); }}
                className="flex-1 h-10 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-60"
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
