/**
 * ExchangeRatesSection
 *
 * UI for manually entering exchange rates between currencies.
 * Save is a stub — exchange rate storage is not yet implemented.
 */

import { useState } from 'react';
import { ArrowLeftRight, Plus, X, Info } from 'lucide-react';
import { SettingsSection } from '../components/SettingsSection';
import { SettingsCard } from '../components/SettingsCard';
import { SettingsRow } from '../components/SettingsRow';
import { usePreferencesStore } from '@/app/preferences.store';
import { useUIStore } from '@/app/ui.store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RateEntry = {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: string; // user input as string to handle in-progress typing
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExchangeRatesSection() {
  const baseCurrency = usePreferencesStore((s) => s.baseCurrency);
  const addToast = useUIStore((s) => s.addToast);

  const [rates, setRates] = useState<RateEntry[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFrom, setNewFrom] = useState('');
  const [newTo, setNewTo] = useState(baseCurrency as unknown as string);
  const [newRate, setNewRate] = useState('');

  function handleAdd() {
    if (!newFrom || !newTo || !newRate || Number(newRate) <= 0) return;

    setRates((prev) => [
      ...prev,
      {
        id: `${newFrom}-${newTo}-${Date.now().toString()}`,
        fromCurrency: newFrom.toUpperCase(),
        toCurrency: newTo.toUpperCase(),
        rate: newRate,
      },
    ]);

    setNewFrom('');
    setNewRate('');
    setShowAddForm(false);

    // Storage is not yet implemented — inform user
    addToast({
      type: 'info',
      message: 'Exchange rate noted. Persistent storage coming in a future update.',
      duration: 4000,
    });
  }

  function handleRemove(id: string) {
    setRates((prev) => prev.filter((r) => r.id !== id));
  }

  function handleRateChange(id: string, value: string) {
    setRates((prev) => prev.map((r) => (r.id === id ? { ...r, rate: value } : r)));
  }

  const inputClass = [
    'rounded-lg border border-border bg-background px-3 py-2 text-sm',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
    'uppercase placeholder:normal-case',
  ].join(' ');

  return (
    <SettingsSection
      id="exchange-rates"
      title="Exchange Rates"
      description={`Manual exchange rates for converting foreign-currency accounts into your base currency (${baseCurrency}).`}
    >
      {/* Info banner */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3">
        <Info size={15} className="text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Zentro does not connect to any live exchange rate service. Rates entered here are static
          and must be updated manually. They are used only for dashboard display totals.
        </p>
      </div>

      <SettingsCard>
        {/* Existing rates */}
        {rates.length === 0 && !showAddForm && (
          <SettingsRow
            label="No exchange rates defined"
            description={`All accounts will display in their own currency. Add a rate to convert to ${baseCurrency}.`}
          />
        )}

        {rates.map((rate) => (
          <div key={rate.id} className="flex items-center gap-3 px-4 py-3">
            <span className="text-sm font-mono text-foreground w-10 uppercase">{rate.fromCurrency}</span>
            <ArrowLeftRight size={14} className="text-muted-foreground shrink-0" aria-hidden="true" />
            <span className="text-sm font-mono text-foreground w-10 uppercase">{rate.toCurrency}</span>
            <span className="text-muted-foreground text-sm">=</span>
            <input
              type="number"
              min={0}
              step="any"
              value={rate.rate}
              onChange={(e) => { handleRateChange(rate.id, e.target.value); }}
              className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Rate for ${rate.fromCurrency} to ${rate.toCurrency}`}
            />
            <button
              onClick={() => { handleRemove(rate.id); }}
              aria-label={`Remove ${rate.fromCurrency} to ${rate.toCurrency} rate`}
              className="ml-auto p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}

        {/* Add form */}
        {showAddForm && (
          <form
            onSubmit={(e) => { e.preventDefault(); handleAdd(); }}
            className="flex items-end gap-2 px-4 py-3 bg-muted/40 flex-wrap"
            aria-label="Add exchange rate"
          >
            <div className="flex flex-col gap-1">
              <label htmlFor="er-from" className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">From</label>
              <input
                id="er-from"
                type="text"
                placeholder="USD"
                maxLength={3}
                value={newFrom}
                onChange={(e) => { setNewFrom(e.target.value); }}
                required
                className={`${inputClass} w-20`}
              />
            </div>
            <ArrowLeftRight size={14} className="text-muted-foreground mb-2 shrink-0" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <label htmlFor="er-to" className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">To</label>
              <input
                id="er-to"
                type="text"
                placeholder={baseCurrency as unknown as string}
                maxLength={3}
                value={newTo}
                onChange={(e) => { setNewTo(e.target.value); }}
                required
                className={`${inputClass} w-20`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="er-rate" className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Rate</label>
              <input
                id="er-rate"
                type="number"
                min={0}
                step="any"
                placeholder="1.23"
                value={newRate}
                onChange={(e) => { setNewRate(e.target.value); }}
                required
                className={`${inputClass} w-24`}
              />
            </div>
            <div className="flex gap-2 mb-0">
              <button
                type="button"
                onClick={() => { setShowAddForm(false); }}
                className="rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newFrom || !newRate || Number(newRate) <= 0}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </form>
        )}

        {/* Add button */}
        {!showAddForm && (
          <button
            onClick={() => { setShowAddForm(true); }}
            className="flex items-center gap-2 w-full px-4 py-3 text-sm text-primary hover:bg-muted/50 transition-colors"
          >
            <Plus size={14} aria-hidden="true" />
            Add exchange rate
          </button>
        )}
      </SettingsCard>
    </SettingsSection>
  );
}
