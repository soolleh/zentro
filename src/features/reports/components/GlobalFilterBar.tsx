/**
 * GlobalFilterBar.tsx
 *
 * Sticky filter bar for the Reports page.
 * Includes: date range, account filter, category filter, compare toggle, active chips.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { CalendarRange, Wallet, Tag, GitCompare, X, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { UUID, ISODateString } from '@/shared/types/common.types';
import type { Account } from '@/shared/types/account.types';
import type { Category } from '@/shared/types/category.types';
import type { ReportFilters } from '@/shared/types/reports.types';
import { accountStorage } from '@/services/storage/account.storage';
import { categoryStorage } from '@/services/storage/category.storage';
import { useDerivedKey, useCurrentUser } from '@/app/stores/session.store';
import { QuickRangePresets } from './QuickRangePresets';
import { PeriodCompareBar } from './PeriodCompareBar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatShort(date: ISODateString): string {
  try {
    return format(parseISO(date), 'MMM d');
  } catch {
    return date.substring(0, 10);
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PopoverType = 'date' | 'account' | 'category' | null;

type GlobalFilterBarProps = {
  filters: ReportFilters;
  onFiltersChange: (partial: Partial<ReportFilters>) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GlobalFilterBar({ filters, onFiltersChange }: GlobalFilterBarProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activePopover, setActivePopover] = useState<PopoverType>(null);

  const derivedKey = useDerivedKey();
  const currentUser = useCurrentUser();
  const popoverRef = useRef<HTMLDivElement>(null);

  // Local date state
  const [dateFrom, setDateFrom] = useState(filters.dateFrom);
  const [dateTo, setDateTo] = useState(filters.dateTo);

  useEffect(() => {
    if (!currentUser || !derivedKey) return;
    void accountStorage.listAccountsByUser(currentUser.id, derivedKey).then((r) => {
      if (r.success) setAccounts(r.data);
    });
    void categoryStorage.listCategoriesByUser(currentUser.id, derivedKey).then((r) => {
      if (r.success) setCategories(r.data);
    });
  }, [currentUser, derivedKey]);

  // Close popover on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setActivePopover(null);
      }
    };
    if (activePopover) document.addEventListener('mousedown', handler);
    return () => { document.removeEventListener('mousedown', handler); };
  }, [activePopover]);

  const toggleAccount = useCallback(
    (id: UUID) => {
      const current = filters.accountIds;
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      onFiltersChange({ accountIds: next });
    },
    [filters.accountIds, onFiltersChange]
  );

  const toggleCategory = useCallback(
    (id: UUID) => {
      const current = filters.categoryIds;
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      onFiltersChange({ categoryIds: next });
    },
    [filters.categoryIds, onFiltersChange]
  );

  const applyDateRange = (from: ISODateString, to: ISODateString) => {
    setDateFrom(from);
    setDateTo(to);
    onFiltersChange({ dateFrom: from, dateTo: to });
    setActivePopover(null);
  };

  const isDateActive =
    filters.dateFrom !== `${String(new Date().getFullYear())}-01-01T00:00:00.000Z` ||
    filters.dateTo.substring(0, 10) !== new Date().toISOString().substring(0, 10);

  const dateLabel = `${formatShort(filters.dateFrom)} – ${formatShort(filters.dateTo)}`;
  const accountLabel =
    filters.accountIds.length === 0
      ? 'All accounts'
      : `${String(filters.accountIds.length)} account${filters.accountIds.length > 1 ? 's' : ''}`;
  const categoryLabel =
    filters.categoryIds.length === 0
      ? 'All categories'
      : `${String(filters.categoryIds.length)} categor${filters.categoryIds.length > 1 ? 'ies' : 'y'}`;

  const incomeCategories = categories.filter(
    (c) => c.transactionType === 'Income' || !c.isSystem
  );
  const expenseCategories = categories.filter(
    (c) => c.transactionType !== 'Income'
  );

  // Active filter chips
  const hasActiveAccount = filters.accountIds.length > 0;
  const hasActiveCategory = filters.categoryIds.length > 0;
  const hasAnyFilter = isDateActive || hasActiveAccount || hasActiveCategory;

  const clearAll = () => {
    const now = new Date();
    onFiltersChange({
      dateFrom: `${String(now.getFullYear())}-01-01T00:00:00.000Z` as ISODateString,
      dateTo: `${now.toISOString().substring(0, 10)}T23:59:59.999Z` as ISODateString,
      accountIds: [],
      categoryIds: [],
    });
  };

  return (
    <div
      className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 py-3 mb-6"
      ref={popoverRef}
    >
      {/* Main filter row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Date range */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setActivePopover(activePopover === 'date' ? null : 'date'); }}
            className={`flex items-center gap-2 h-8 px-3 rounded-lg border text-sm whitespace-nowrap cursor-pointer transition-all duration-150 ${activePopover === 'date' || isDateActive
              ? 'border-primary text-primary bg-primary/5'
              : 'border-input bg-background text-foreground hover:border-border'
              }`}
          >
            <CalendarRange className="w-3.5 h-3.5 text-muted-foreground" />
            {dateLabel}
          </button>

          {activePopover === 'date' && (
            <div className="absolute top-full left-0 mt-1 z-30 bg-card border border-border rounded-xl shadow-md p-4 min-w-[300px]">
              <QuickRangePresets
                activeFrom={filters.dateFrom}
                activeTo={filters.dateTo}
                onSelect={applyDateRange}
              />
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">From</label>
                  <input
                    type="date"
                    value={dateFrom.substring(0, 10)}
                    onChange={(e) => {
                      if (e.target.value) {
                        setDateFrom(`${e.target.value}T00:00:00.000Z` as ISODateString);
                      }
                    }}
                    className="h-8 px-2 rounded-lg border border-input bg-background text-sm text-foreground"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">To</label>
                  <input
                    type="date"
                    value={dateTo.substring(0, 10)}
                    onChange={(e) => {
                      if (e.target.value) {
                        setDateTo(`${e.target.value}T23:59:59.999Z` as ISODateString);
                      }
                    }}
                    className="h-8 px-2 rounded-lg border border-input bg-background text-sm text-foreground"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => {
                    applyDateRange(dateFrom, dateTo);
                  }}
                  className="flex-1 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-medium"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const y = new Date().getFullYear();
                    const today = new Date().toISOString().substring(0, 10);
                    applyDateRange(
                      `${String(y)}-01-01T00:00:00.000Z` as ISODateString,
                      `${today}T23:59:59.999Z` as ISODateString
                    );
                  }}
                  className="flex-1 h-8 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/60"
                >
                  Reset to this year
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Account filter */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setActivePopover(activePopover === 'account' ? null : 'account'); }}
            className={`flex items-center gap-2 h-8 px-3 rounded-lg border text-sm whitespace-nowrap cursor-pointer transition-all duration-150 ${hasActiveAccount || activePopover === 'account'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-input bg-background text-foreground hover:border-border'
              }`}
          >
            <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
            {accountLabel}
          </button>

          {activePopover === 'account' && (
            <div className="absolute top-full left-0 mt-1 z-30 bg-card border border-border rounded-xl shadow-md p-3 min-w-[200px] max-h-64 overflow-y-auto">
              {accounts.length === 0 && (
                <p className="text-xs text-muted-foreground px-2">No accounts found</p>
              )}
              {accounts.map((acc) => {
                const checked = filters.accountIds.includes(acc.id);
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => { toggleAccount(acc.id); }}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-muted/40 text-left transition-colors duration-100"
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors duration-100 ${checked ? 'bg-primary border-primary' : 'border-border'
                        }`}
                    >
                      {checked && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                    </div>
                    <span className="text-sm text-foreground truncate">{acc.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{acc.type}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Category filter */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setActivePopover(activePopover === 'category' ? null : 'category'); }}
            className={`flex items-center gap-2 h-8 px-3 rounded-lg border text-sm whitespace-nowrap cursor-pointer transition-all duration-150 ${hasActiveCategory || activePopover === 'category'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-input bg-background text-foreground hover:border-border'
              }`}
          >
            <Tag className="w-3.5 h-3.5 text-muted-foreground" />
            {categoryLabel}
          </button>

          {activePopover === 'category' && (
            <div className="absolute top-full left-0 mt-1 z-30 bg-card border border-border rounded-xl shadow-md p-3 min-w-[220px] max-h-72 overflow-y-auto">
              {expenseCategories.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">
                    Expense
                  </p>
                  {expenseCategories.map((cat) => {
                    const checked = filters.categoryIds.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => { toggleCategory(cat.id); }}
                        className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-muted/40 text-left transition-colors duration-100"
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-primary border-primary' : 'border-border'
                            }`}
                        >
                          {checked && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                        </div>
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-sm text-foreground truncate">{cat.name}</span>
                      </button>
                    );
                  })}
                </>
              )}
              {incomeCategories.length > 0 && expenseCategories.length > 0 && (
                <div className="h-px bg-border my-2" />
              )}
              {incomeCategories.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">
                    Income
                  </p>
                  {incomeCategories.map((cat) => {
                    const checked = filters.categoryIds.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => { toggleCategory(cat.id); }}
                        className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-muted/40 text-left"
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-primary border-primary' : 'border-border'
                            }`}
                        >
                          {checked && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                        </div>
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-sm text-foreground truncate">{cat.name}</span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>

        {/* Compare toggle */}
        <button
          type="button"
          onClick={() => {
            onFiltersChange({ compareEnabled: !filters.compareEnabled });
          }}
          className={`flex items-center gap-2 h-8 px-3 rounded-lg border text-sm whitespace-nowrap cursor-pointer transition-all duration-150 ${filters.compareEnabled
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-input bg-background text-foreground hover:border-border'
            }`}
        >
          <GitCompare
            className={`w-3.5 h-3.5 ${filters.compareEnabled ? 'text-primary' : 'text-muted-foreground'}`}
          />
          Compare
        </button>
      </div>

      {/* Compare secondary bar */}
      {filters.compareEnabled && (
        <PeriodCompareBar filters={filters} onFiltersChange={onFiltersChange} />
      )}

      {/* Active filter chips */}
      {hasAnyFilter && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {isDateActive && (
            <span className="flex items-center gap-1 h-6 px-2.5 rounded-full border border-border bg-muted/40 text-xs font-medium text-muted-foreground">
              <CalendarRange className="w-3 h-3" />
              {dateLabel}
              <button
                type="button"
                className="ml-0.5 hover:text-foreground"
                onClick={() => {
                  const y = new Date().getFullYear();
                  const today = new Date().toISOString().substring(0, 10);
                  onFiltersChange({
                    dateFrom: `${String(y)}-01-01T00:00:00.000Z` as ISODateString,
                    dateTo: `${today}T23:59:59.999Z` as ISODateString,
                  });
                }}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )}
          {accounts
            .filter((a) => filters.accountIds.includes(a.id))
            .map((a) => (
              <span
                key={a.id}
                className="flex items-center gap-1 h-6 px-2.5 rounded-full border border-border bg-muted/40 text-xs font-medium text-muted-foreground"
              >
                {a.name}
                <button
                  type="button"
                  className="ml-0.5 hover:text-foreground"
                  onClick={() => { toggleAccount(a.id); }}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          {categories
            .filter((c) => filters.categoryIds.includes(c.id))
            .map((c) => (
              <span
                key={c.id}
                className="flex items-center gap-1 h-6 px-2.5 rounded-full border border-border bg-muted/40 text-xs font-medium text-muted-foreground"
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                {c.name}
                <button
                  type="button"
                  className="ml-0.5 hover:text-foreground"
                  onClick={() => { toggleCategory(c.id); }}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-primary hover:underline underline-offset-4 px-1"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
