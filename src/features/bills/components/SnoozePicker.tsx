import { useState, useEffect } from 'react';
import { X, AlarmClock } from 'lucide-react';
import { addDays, format } from 'date-fns';
import type { EnrichedBillEntry } from '@/shared/types/bill.types';
import type { ISODateString } from '@/shared/types/common.types';
import { useBillStore } from '@/app/stores/bill.store';

const TITLE = 'Snooze Bill';
const BTN_SNOOZE = 'Snooze';
const BTN_CANCEL = 'Cancel';
const LABEL_UNTIL = 'Snooze Until';

const QUICK_OPTIONS = [
  { label: '2 days', days: 2 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
] as const;

type SnoozePickerProps = {
  entry: EnrichedBillEntry;
  onClose: () => void;
};

export function SnoozePicker({ entry, onClose }: SnoozePickerProps) {
  const snoozeEntry = useBillStore((s) => s.snoozeEntry);
  const isLoading = useBillStore((s) => s.isLoading);

  const minDate = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const [snoozeDate, setSnoozeDate] = useState<string>(format(addDays(new Date(), 2), 'yyyy-MM-dd'));

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => { window.removeEventListener('keydown', handler); };
  }, [onClose]);

  // Scroll lock
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleSnooze = async () => {
    await snoozeEntry({
      entryId: entry.id,
      snoozeUntil: `${snoozeDate}T00:00:00.000Z` as ISODateString,
    });
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={TITLE}
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-card border-t border-border shadow-xl p-6 flex flex-col gap-5 lg:max-w-sm lg:mx-auto lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:rounded-2xl lg:border"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlarmClock size={18} className="text-chart-3" aria-hidden="true" />
            <div>
              <h2 className="font-semibold text-foreground">{TITLE}</h2>
              <p className="text-xs text-muted-foreground">{entry.bill.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label={BTN_CANCEL}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Quick options */}
        <div className="flex gap-2">
          {QUICK_OPTIONS.map((opt) => {
            const dateVal = format(addDays(new Date(), opt.days), 'yyyy-MM-dd');
            const active = snoozeDate === dateVal;
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => { setSnoozeDate(dateVal); }}
                className={[
                  'flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors',
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary hover:text-primary',
                ].join(' ')}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Custom date */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="snooze-date" className="text-sm font-medium text-foreground">
            {LABEL_UNTIL}
          </label>
          <input
            id="snooze-date"
            type="date"
            min={minDate}
            value={snoozeDate}
            onChange={(e) => { setSnoozeDate(e.target.value); }}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            {BTN_CANCEL}
          </button>
          <button
            type="button"
            onClick={() => { void handleSnooze(); }}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-chart-3 text-white font-semibold text-sm disabled:opacity-50 transition-opacity"
          >
            {isLoading ? '…' : BTN_SNOOZE}
          </button>
        </div>
      </div>
    </>
  );
}
