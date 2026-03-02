/**
 * PreferencesSection
 *
 * Regional and formatting preferences: date format, base currency,
 * and budget cycle start day.
 */

import { Calendar, DollarSign, RefreshCw } from 'lucide-react';
import { SettingsSection } from '../components/SettingsSection';
import { SettingsCard } from '../components/SettingsCard';
import { SettingsRow } from '../components/SettingsRow';
import { usePreferencesStore } from '@/app/preferences.store';
import type { DateFormat } from '@/shared/types/settings.types';
import type { Currency } from '@/shared/types/common.types';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const DATE_FORMAT_OPTIONS: { value: DateFormat; label: string }[] = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY — 31/12/2024' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY — 12/31/2024' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD — 2024-12-31' },
];

const CURRENCY_OPTIONS: { value: string; label: string }[] = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'JPY', label: 'JPY — Japanese Yen' },
  { value: 'CHF', label: 'CHF — Swiss Franc' },
  { value: 'CNY', label: 'CNY — Chinese Yuan' },
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'BRL', label: 'BRL — Brazilian Real' },
  { value: 'MXN', label: 'MXN — Mexican Peso' },
  { value: 'SGD', label: 'SGD — Singapore Dollar' },
  { value: 'HKD', label: 'HKD — Hong Kong Dollar' },
  { value: 'NOK', label: 'NOK — Norwegian Krone' },
  { value: 'SEK', label: 'SEK — Swedish Krona' },
  { value: 'DKK', label: 'DKK — Danish Krone' },
  { value: 'NZD', label: 'NZD — New Zealand Dollar' },
  { value: 'ZAR', label: 'ZAR — South African Rand' },
  { value: 'MYR', label: 'MYR — Malaysian Ringgit' },
  { value: 'IDR', label: 'IDR — Indonesian Rupiah' },
];

const CYCLE_DAY_OPTIONS: { value: number; label: string }[] = Array.from(
  { length: 28 },
  (_, i) => {
    const day = i + 1;
    const suffix =
      day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th';
    return { value: day, label: `${day.toString()}${suffix} of each month` };
  }
);

// ---------------------------------------------------------------------------
// Shared select class
// ---------------------------------------------------------------------------

const SELECT_CLASS = [
  'rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
  'cursor-pointer appearance-none',
  'bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238a9aa8\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")]',
  'bg-no-repeat bg-[right_0.5rem_center] bg-[length:1rem_1rem] pr-8',
].join(' ');

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PreferencesSection() {
  const dateFormat = usePreferencesStore((s) => s.dateFormat);
  const baseCurrency = usePreferencesStore((s) => s.baseCurrency);
  const budgetCycleStartDay = usePreferencesStore((s) => s.budgetCycleStartDay);
  const updateDateFormat = usePreferencesStore((s) => s.updateDateFormat);
  const updateBaseCurrency = usePreferencesStore((s) => s.updateBaseCurrency);
  const updateBudgetCycleStartDay = usePreferencesStore((s) => s.updateBudgetCycleStartDay);

  return (
    <SettingsSection
      id="preferences"
      title="Preferences"
      description="Regional and formatting preferences applied across the app."
    >
      <SettingsCard>
        {/* Date Format */}
        <SettingsRow
          label="Date Format"
          description="How dates are displayed throughout the app."
          icon={Calendar}
          control={
            <select
              value={dateFormat}
              onChange={(e) => { updateDateFormat(e.target.value as DateFormat); }}
              aria-label="Select date format"
              className={SELECT_CLASS}
            >
              {DATE_FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          }
        />

        {/* Base Currency */}
        <SettingsRow
          label="Base Currency"
          description="All dashboard totals and reports are shown in this currency."
          icon={DollarSign}
          control={
            <select
              value={baseCurrency}
              onChange={(e) => { updateBaseCurrency(e.target.value as Currency); }}
              aria-label="Select base currency"
              className={SELECT_CLASS}
            >
              {CURRENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          }
        />

        {/* Budget Cycle Start Day */}
        <SettingsRow
          label="Budget Cycle Start"
          description="The day each month when budget categories reset."
          icon={RefreshCw}
          control={
            <select
              value={budgetCycleStartDay}
              onChange={(e) => { updateBudgetCycleStartDay(Number(e.target.value)); }}
              aria-label="Select budget cycle start day"
              className={SELECT_CLASS}
            >
              {CYCLE_DAY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          }
        />
      </SettingsCard>
    </SettingsSection>
  );
}
