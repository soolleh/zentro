import { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isSameDay,
  isAfter,
  parseISO,
  startOfDay,
} from 'date-fns';
import type { ISODateString } from '@/shared/types/common.types';

type DatePickerProps = {
  value: ISODateString | null;
  onChange: (date: ISODateString) => void;
  label?: string;
  error?: string;
  dateFormat?: string;
};

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function formatDateDisplay(dateStr: ISODateString, dateFormat: string): string {
  try {
    const date = parseISO(dateStr);
    switch (dateFormat) {
      case 'MM/DD/YYYY':
        return format(date, 'MM/dd/yyyy');
      case 'YYYY-MM-DD':
        return format(date, 'yyyy-MM-dd');
      default:
        return format(date, 'dd/MM/yyyy');
    }
  } catch {
    return dateStr;
  }
}

export function DatePicker({
  value,
  onChange,
  label = 'Date',
  error,
  dateFormat = 'DD/MM/YYYY',
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(
    value ? parseISO(value) : new Date()
  );
  const popoverRef = useRef<HTMLDivElement>(null);
  const today = startOfDay(new Date());

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => { document.removeEventListener('mousedown', handler); };
  }, [isOpen]);

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(viewMonth),
    end: endOfMonth(viewMonth),
  });
  const startOffset = getDay(startOfMonth(viewMonth));

  const handleSelectDay = (day: Date) => {
    if (isAfter(startOfDay(day), today)) return;
    onChange(format(day, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'") as ISODateString);
    setIsOpen(false);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <div className="relative" ref={popoverRef}>
        <button
          type="button"
          onClick={() => { setIsOpen((o) => !o); }}
          className={`h-10 w-full rounded-lg border ${error ? 'border-destructive' : 'border-input'} bg-background px-3 text-sm flex items-center justify-between cursor-pointer transition-colors duration-150`}
        >
          {value ? (
            <span className="text-sm font-medium text-foreground">
              {formatDateDisplay(value, dateFormat)}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">Select date</span>
          )}
          <Calendar className="w-4 h-4 text-muted-foreground" />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-1 z-20 bg-card border border-border rounded-xl shadow-lg p-3 w-72">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => { setViewMonth((m) => subMonths(m, 1)); }}
                className="p-1 rounded-md hover:bg-muted/50 text-muted-foreground"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-foreground">
                {format(viewMonth, 'MMMM yyyy')}
              </span>
              <button
                type="button"
                onClick={() => { setViewMonth((m) => addMonths(m, 1)); }}
                className="p-1 rounded-md hover:bg-muted/50 text-muted-foreground"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Day labels */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_LABELS.map((d) => (
                <div key={d} className="text-center text-xs text-muted-foreground py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {/* Empty cells for offset */}
              {Array.from({ length: startOffset }).map((_, i) => (
                <div key={`empty-${i.toString()}`} />
              ))}
              {daysInMonth.map((day) => {
                const isSelected = value ? isSameDay(day, parseISO(value)) : false;
                const isToday = isSameDay(day, today);
                const isFuture = isAfter(startOfDay(day), today);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => { handleSelectDay(day); }}
                    disabled={isFuture}
                    className={[
                      'w-8 h-8 text-sm rounded-full flex items-center justify-center mx-auto transition-colors duration-100',
                      isSelected
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : isToday
                          ? 'bg-muted font-semibold text-foreground'
                          : isFuture
                            ? 'text-muted-foreground/40 cursor-not-allowed'
                            : 'text-foreground hover:bg-muted/50 cursor-pointer',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
