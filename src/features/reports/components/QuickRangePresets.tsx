/**
 * QuickRangePresets.tsx
 *
 * Date range quick-select preset chips for the filter bar popover.
 */

import type { ISODateString } from '@/shared/types/common.types';

type Preset = {
  label: string;
  value: string;
  resolve: () => { from: ISODateString; to: ISODateString };
};

function isoDate(d: Date): ISODateString {
  return d.toISOString() as ISODateString;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

const PRESETS: Preset[] = [
  {
    label: 'This month',
    value: 'this-month',
    resolve: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      return { from: isoDate(from), to: isoDate(to) };
    },
  },
  {
    label: 'Last month',
    value: 'last-month',
    resolve: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
      return { from: isoDate(from), to: isoDate(to) };
    },
  },
  {
    label: 'This quarter',
    value: 'this-quarter',
    resolve: () => {
      const now = new Date();
      const qStart = Math.floor(now.getMonth() / 3) * 3;
      const from = new Date(now.getFullYear(), qStart, 1);
      const to = endOfDay(new Date(now.getFullYear(), qStart + 3, 0));
      return { from: isoDate(from), to: isoDate(to) };
    },
  },
  {
    label: 'Last quarter',
    value: 'last-quarter',
    resolve: () => {
      const now = new Date();
      const qStart = Math.floor(now.getMonth() / 3) * 3;
      const prevQStart = qStart === 0 ? 9 : qStart - 3;
      const prevQYear = qStart === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const from = new Date(prevQYear, prevQStart, 1);
      const to = endOfDay(new Date(prevQYear, prevQStart + 3, 0));
      return { from: isoDate(from), to: isoDate(to) };
    },
  },
  {
    label: 'This year',
    value: 'this-year',
    resolve: () => {
      const y = new Date().getFullYear();
      const from = new Date(y, 0, 1);
      const to = endOfDay(new Date());
      return { from: isoDate(from), to: isoDate(to) };
    },
  },
  {
    label: 'Last year',
    value: 'last-year',
    resolve: () => {
      const y = new Date().getFullYear() - 1;
      const from = new Date(y, 0, 1);
      const to = endOfDay(new Date(y, 11, 31));
      return { from: isoDate(from), to: isoDate(to) };
    },
  },
  {
    label: 'Last 12 months',
    value: 'last-12-months',
    resolve: () => {
      const to = endOfDay(new Date());
      const from = new Date();
      from.setMonth(from.getMonth() - 12);
      from.setDate(1);
      return { from: isoDate(startOfDay(from)), to: isoDate(to) };
    },
  },
];

type QuickRangePresetsProps = {
  activeFrom: ISODateString;
  activeTo: ISODateString;
  onSelect: (from: ISODateString, to: ISODateString) => void;
};

function isActivePreset(preset: Preset, from: ISODateString, to: ISODateString): boolean {
  try {
    const resolved = preset.resolve();
    return (
      resolved.from.substring(0, 10) === from.substring(0, 10) &&
      resolved.to.substring(0, 10) === to.substring(0, 10)
    );
  } catch {
    return false;
  }
}

export function QuickRangePresets({ activeFrom, activeTo, onSelect }: QuickRangePresetsProps) {
  return (
    <div className="flex gap-1.5 flex-wrap mb-3">
      {PRESETS.map((preset) => {
        const active = isActivePreset(preset, activeFrom, activeTo);
        return (
          <button
            key={preset.value}
            type="button"
            onClick={() => {
              const { from, to } = preset.resolve();
              onSelect(from, to);
            }}
            className={`h-6 px-2.5 rounded-full border text-xs font-medium cursor-pointer transition-all duration-150 ${active
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-muted/40 text-muted-foreground hover:border-border hover:text-foreground'
              }`}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
