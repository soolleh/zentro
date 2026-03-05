/**
 * PeriodCompareBar.tsx
 *
 * Secondary date bar that appears when period comparison is enabled.
 */

import { useState, useRef, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { ISODateString } from '@/shared/types/common.types';
import type { ReportFilters } from '@/shared/types/reports.types';
import { QuickRangePresets } from './QuickRangePresets';

type PeriodCompareBarProps = {
  filters: ReportFilters;
  onFiltersChange: (partial: Partial<ReportFilters>) => void;
};

function formatShort(date: ISODateString): string {
  try {
    return format(parseISO(date), 'MMM d, yyyy');
  } catch {
    return date.substring(0, 10);
  }
}

export function PeriodCompareBar({ filters, onFiltersChange }: PeriodCompareBarProps) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => { document.removeEventListener('mousedown', handler); };
  }, [open]);

  const label = `${formatShort(filters.compareDateFrom)} – ${formatShort(filters.compareDateTo)}`;

  return (
    <div className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-lg bg-muted/40 border border-border relative" ref={popoverRef}>
      <span className="text-xs text-muted-foreground whitespace-nowrap">Compare with:</span>
      <button
        type="button"
        onClick={() => { setOpen((p) => !p); }}
        className={`flex items-center gap-2 h-7 px-2.5 rounded-lg border text-xs whitespace-nowrap cursor-pointer transition-all duration-150 ${open
            ? 'border-primary text-primary bg-primary/5'
            : 'border-input bg-background text-foreground hover:border-border'
          }`}
      >
        <Calendar className="w-3 h-3 text-muted-foreground" />
        {label}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 bg-card border border-border rounded-xl shadow-md p-4 min-w-[280px]">
          <QuickRangePresets
            activeFrom={filters.compareDateFrom}
            activeTo={filters.compareDateTo}
            onSelect={(from, to) => {
              onFiltersChange({ compareDateFrom: from, compareDateTo: to });
              setOpen(false);
            }}
          />
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">From</label>
              <input
                type="date"
                value={filters.compareDateFrom.substring(0, 10)}
                onChange={(e) => {
                  if (e.target.value) {
                    onFiltersChange({
                      compareDateFrom: `${e.target.value}T00:00:00.000Z` as ISODateString,
                    });
                  }
                }}
                className="h-8 px-2 rounded-lg border border-input bg-background text-sm text-foreground"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">To</label>
              <input
                type="date"
                value={filters.compareDateTo.substring(0, 10)}
                onChange={(e) => {
                  if (e.target.value) {
                    onFiltersChange({
                      compareDateTo: `${e.target.value}T23:59:59.999Z` as ISODateString,
                    });
                  }
                }}
                className="h-8 px-2 rounded-lg border border-input bg-background text-sm text-foreground"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setOpen(false); }}
            className="mt-3 w-full h-8 rounded-lg bg-primary text-primary-foreground text-xs font-medium"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
