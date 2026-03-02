import { Repeat } from 'lucide-react';
import type { RecurringFrequency } from '@/shared/types/transaction.types';
import type { ISODateString } from '@/shared/types/common.types';
import { DatePicker } from './DatePicker';

type RecurringSubFormProps = {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  frequency: RecurringFrequency;
  onFrequencyChange: (freq: RecurringFrequency) => void;
  endDate: ISODateString | null;
  onEndDateChange: (date: ISODateString | null) => void;
};

const FREQUENCIES: { value: RecurringFrequency; label: string }[] = [
  { value: 'Daily', label: 'Daily' },
  { value: 'Weekly', label: 'Weekly' },
  { value: 'Biweekly', label: 'Biweekly' },
  { value: 'Monthly', label: 'Monthly' },
  { value: 'Yearly', label: 'Yearly' },
];

export function RecurringSubForm({
  enabled,
  onToggle,
  frequency,
  onFrequencyChange,
  endDate,
  onEndDateChange,
}: RecurringSubFormProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Toggle row */}
      <div className="flex items-center justify-between py-2 cursor-pointer">
        <div className="flex items-center gap-2">
          <Repeat className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-foreground">Make recurring</span>
        </div>
        {/* Switch */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => { onToggle(!enabled); }}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${enabled ? 'bg-primary' : 'bg-input'}`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${enabled ? 'translate-x-4' : 'translate-x-0'}`}
          />
        </button>
      </div>

      {/* Sub-form (shown when enabled) */}
      {enabled && (
        <div className="flex flex-col gap-3 pl-6 border-l-2 border-primary/30 animate-in slide-in-from-top-2 duration-200">
          {/* Frequency */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Frequency</label>
            <div className="flex rounded-lg border border-border bg-muted p-0.5 gap-0.5 overflow-x-auto">
              {FREQUENCIES.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => { onFrequencyChange(f.value); }}
                  className={[
                    'flex-1 min-w-max px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-100 whitespace-nowrap',
                    frequency === f.value
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* End date */}
          <DatePicker
            value={endDate}
            onChange={(d) => { onEndDateChange(d); }}
            label="Ends on (optional)"
          />
          {endDate && (
            <button
              type="button"
              onClick={() => { onEndDateChange(null); }}
              className="text-xs text-muted-foreground hover:text-foreground text-left transition-colors duration-100"
            >
              Clear end date
            </button>
          )}
        </div>
      )}
    </div>
  );
}
