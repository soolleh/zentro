import { useState, useCallback } from 'react';
import { AlertCircle, Check } from 'lucide-react';
import type { Bill } from '@/shared/types/bill.types';
import type { UUID, Currency } from '@/shared/types/common.types';
import { SlidePanel } from '@/shared/components/SlidePanel';
import { AccountSelector } from '@/features/transactions/components/AccountSelector';
import { CategorySelector } from '@/features/transactions/components/CategorySelector';
import { useBillStore } from '@/app/stores/bill.store';
import { useCurrentUser } from '@/app/stores/session.store';
import { usePreferencesStore } from '@/app/preferences.store';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TITLE_ADD = 'New Bill';
const TITLE_EDIT = 'Edit Bill';
const BTN_SAVE = 'Save Bill';
const BTN_SAVING = 'Saving…';

const EMOJI_SUGGESTIONS = [
  '💳', '🏠', '💡', '🌊', '📱', '🚗', '📺', '🛒', '🏋️', '🎵',
  '📚', '💊', '🔧', '🌐', '☕', '🏦',
];

const COLOR_OPTIONS = [
  '#0891b2', // primary cyan
  '#7c3aed', // violet
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#f97316', // orange
  '#06b6d4', // sky
  '#8b5cf6', // purple
];

type FormState = {
  name: string;
  emoji: string;
  color: string;
  amount: string;
  currency: string;
  dueDayOfMonth: string;
  categoryId: UUID | null;
  accountId: UUID | null;
  notes: string;
  isActive: boolean;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

function makeInitialState(bill: Bill | null, baseCurrency: Currency): FormState {
  if (bill) {
    return {
      name: bill.name,
      emoji: bill.emoji,
      color: bill.color,
      amount: bill.amount.toFixed(2),
      currency: bill.currency,
      dueDayOfMonth: String(bill.dueDayOfMonth),
      categoryId: bill.categoryId,
      accountId: bill.accountId,
      notes: bill.notes ?? '',
      isActive: bill.isActive,
    };
  }
  return {
    name: '',
    emoji: '💳',
    color: '#0891b2',
    amount: '',
    currency: baseCurrency,
    dueDayOfMonth: '1',
    categoryId: null,
    accountId: null,
    notes: '',
    isActive: true,
  };
}

// ---------------------------------------------------------------------------
// BillForm — outer shell (SlidePanel) + inner content (remounts on open)
// ---------------------------------------------------------------------------

type BillFormProps = {
  open: boolean;
  editingBill: Bill | null;
  onClose: () => void;
};

type BillFormContentProps = {
  editingBill: Bill | null;
  onClose: () => void;
};

function BillFormContent({ editingBill, onClose }: BillFormContentProps) {
  const currentUser = useCurrentUser();
  const baseCurrency = usePreferencesStore((s) => s.baseCurrency);
  const addBill = useBillStore((s) => s.addBill);
  const editBill = useBillStore((s) => s.editBill);
  const isLoading = useBillStore((s) => s.isLoading);

  // State is initialized once on mount — component is remounted each time panel opens
  const [form, setForm] = useState<FormState>(() => makeInitialState(editingBill, baseCurrency));
  const [errors, setErrors] = useState<FormErrors>({});

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }, []);

  const validate = (): boolean => {
    const errs: FormErrors = {};
    if (!form.name.trim()) errs.name = 'Bill name is required.';
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) errs.amount = 'Amount must be greater than 0.';
    const day = parseInt(form.dueDayOfMonth, 10);
    if (isNaN(day) || day < 1 || day > 31) errs.dueDayOfMonth = 'Day must be between 1 and 31.';
    if (!form.categoryId) errs.categoryId = 'Category is required.';
    if (!form.accountId) errs.accountId = 'Account is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !currentUser) return;

    const input = {
      userId: currentUser.id,
      name: form.name.trim(),
      emoji: form.emoji,
      color: form.color,
      amount: parseFloat(form.amount),
      currency: form.currency as Currency,
      dueDayOfMonth: parseInt(form.dueDayOfMonth, 10),
      categoryId: form.categoryId as UUID,
      accountId: form.accountId as UUID,
      notes: form.notes.trim() || undefined,
      isActive: form.isActive,
    };

    if (editingBill) {
      await editBill(editingBill.id, input);
    } else {
      await addBill(currentUser.id, input);
    }
    onClose();
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }} className="flex flex-col gap-5 p-6">
        {/* Emoji + Name row */}
        <div className="flex gap-3">
          {/* Emoji display + picker trigger */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Icon</span>
            <div className="relative">
              <button
                type="button"
                className="h-11 w-11 rounded-xl border border-input bg-background text-2xl flex items-center justify-center hover:bg-muted transition-colors"
                aria-label="Select emoji"
                onClick={(e) => {
                  e.preventDefault();
                  const idx = (EMOJI_SUGGESTIONS.indexOf(form.emoji) + 1) % EMOJI_SUGGESTIONS.length;
                  const next = EMOJI_SUGGESTIONS[idx];
                  setField('emoji', next);
                }}
                title="Click to cycle through icons"
              >
                {form.emoji}
              </button>
            </div>
          </div>

          {/* Name */}
          <div className="flex-1 flex flex-col gap-1.5">
            <label htmlFor="bill-name" className="text-sm font-medium text-foreground">
              Bill Name
            </label>
            <input
              id="bill-name"
              type="text"
              value={form.name}
              onChange={(e) => { setField('name', e.target.value); }}
              placeholder="e.g. Netflix, Electricity…"
              className={[
                'h-11 w-full px-3 rounded-xl border bg-background text-sm',
                'focus:outline-none focus:ring-2 focus:ring-ring',
                errors.name ? 'border-destructive' : 'border-input',
              ].join(' ')}
              aria-describedby={errors.name ? 'bill-name-error' : undefined}
            />
            {errors.name && (
              <p id="bill-name-error" role="alert" className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle size={11} aria-hidden="true" />
                {errors.name}
              </p>
            )}
          </div>
        </div>

        {/* Emoji quick picks */}
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground font-medium">Quick icons</span>
          <div className="flex flex-wrap gap-2">
            {EMOJI_SUGGESTIONS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => { setField('emoji', em); }}
                aria-label={em}
                className={[
                  'h-9 w-9 rounded-lg text-xl border transition-colors',
                  form.emoji === em
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary hover:bg-muted',
                ].join(' ')}
              >
                {em}
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Color</span>
          <div className="flex gap-2 flex-wrap">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { setField('color', c); }}
                aria-label={`Color ${c}`}
                className="h-8 w-8 rounded-full border-2 transition-all flex items-center justify-center"
                style={{
                  backgroundColor: c,
                  borderColor: form.color === c ? c : 'transparent',
                  boxShadow: form.color === c ? `0 0 0 3px ${c}40` : 'none',
                }}
              >
                {form.color === c && <Check size={12} color="white" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </div>

        {/* Amount + Currency */}
        <div className="flex gap-3">
          <div className="flex-1 flex flex-col gap-1.5">
            <label htmlFor="bill-amount" className="text-sm font-medium text-foreground">
              Amount
            </label>
            <input
              id="bill-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={form.amount}
              onChange={(e) => { setField('amount', e.target.value); }}
              placeholder="0.00"
              className={[
                'h-11 w-full px-3 rounded-xl border bg-background text-sm',
                'focus:outline-none focus:ring-2 focus:ring-ring',
                errors.amount ? 'border-destructive' : 'border-input',
              ].join(' ')}
              aria-describedby={errors.amount ? 'bill-amount-error' : undefined}
            />
            {errors.amount && (
              <p id="bill-amount-error" role="alert" className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle size={11} aria-hidden="true" />
                {errors.amount}
              </p>
            )}
          </div>
          <div className="w-24 flex flex-col gap-1.5">
            <label htmlFor="bill-currency" className="text-sm font-medium text-foreground">
              Currency
            </label>
            <input
              id="bill-currency"
              type="text"
              maxLength={3}
              value={form.currency}
              onChange={(e) => { setField('currency', e.target.value.toUpperCase()); }}
              className="h-11 w-full px-3 rounded-xl border border-input bg-background text-sm uppercase font-medium focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Due day */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="bill-due-day" className="text-sm font-medium text-foreground">
            Due Day of Month
          </label>
          <div className="flex items-center gap-3">
            <input
              id="bill-due-day"
              type="number"
              min={1}
              max={31}
              value={form.dueDayOfMonth}
              onChange={(e) => { setField('dueDayOfMonth', e.target.value); }}
              className={[
                'h-11 w-24 px-3 rounded-xl border bg-background text-sm',
                'focus:outline-none focus:ring-2 focus:ring-ring',
                errors.dueDayOfMonth ? 'border-destructive' : 'border-input',
              ].join(' ')}
              aria-describedby={errors.dueDayOfMonth ? 'bill-due-day-error' : undefined}
            />
            <span className="text-sm text-muted-foreground">of every month</span>
          </div>
          {errors.dueDayOfMonth && (
            <p id="bill-due-day-error" role="alert" className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle size={11} aria-hidden="true" />
              {errors.dueDayOfMonth}
            </p>
          )}
        </div>

        {/* Category */}
        <div className="flex flex-col gap-1">
          <CategorySelector
            value={form.categoryId}
            onChange={(id) => { setField('categoryId', id); }}
            transactionType="Expense"
            label="Category"
            error={errors.categoryId}
          />
        </div>

        {/* Account */}
        <div className="flex flex-col gap-1">
          <AccountSelector
            value={form.accountId}
            onChange={(_id, account) => { setField('accountId', account.id); }}
            label="Pay From Account"
            error={errors.accountId}
          />
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="bill-notes" className="text-sm font-medium text-foreground">
            Notes <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <textarea
            id="bill-notes"
            value={form.notes}
            onChange={(e) => { setField('notes', e.target.value); }}
            placeholder="Autopay, provider info, login…"
            rows={2}
            className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Active toggle (edit only) */}
        {editingBill !== null && (
          <div className="flex items-center justify-between py-3 border-t border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Active</p>
              <p className="text-xs text-muted-foreground">Inactive bills won&apos;t generate new entries.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.isActive}
              onClick={() => { setField('isActive', !form.isActive); }}
              className={[
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                form.isActive ? 'bg-primary' : 'bg-muted-foreground/30',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                  form.isActive ? 'translate-x-6' : 'translate-x-1',
                ].join(' ')}
              />
            </button>
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 transition-opacity"
          >
            {isLoading ? BTN_SAVING : BTN_SAVE}
          </button>
        </div>
      </form>
  );
}

export function BillForm({ open, editingBill, onClose }: BillFormProps) {
  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title={editingBill ? TITLE_EDIT : TITLE_ADD}
      size="md"
    >
      {open && (
        <BillFormContent
          key={editingBill?.id ?? 'new'}
          editingBill={editingBill}
          onClose={onClose}
        />
      )}
    </SlidePanel>
  );
}
