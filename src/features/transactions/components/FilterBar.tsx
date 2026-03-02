import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Calendar,
  Wallet,
  Tag,
  DollarSign,
  SlidersHorizontal,
  X,
  Check,
} from 'lucide-react';
import type { Account } from '@/shared/types/account.types';
import type { Category } from '@/shared/types/category.types';
import type { TransactionQueryOptions, TransactionType } from '@/shared/types/transaction.types';
import type { UUID, ISODateString } from '@/shared/types/common.types';
import { accountStorage } from '@/services/storage/account.storage';
import { categoryStorage } from '@/services/storage/category.storage';
import { useDerivedKey, useCurrentUser } from '@/app/stores/session.store';
import { useDateFormat } from '@/app/preferences.store';
import { format, parseISO } from 'date-fns';

type FilterBarProps = {
  filters: TransactionQueryOptions;
  onFiltersChange: (partial: Partial<TransactionQueryOptions>) => void;
  onClearFilters: () => void;
};

type PopoverType = 'date' | 'account' | 'category' | 'amount' | null;

const TRANSACTION_TYPES: { value: TransactionType | 'All'; label: string }[] = [
  { value: 'All', label: 'All' },
  { value: 'Income', label: 'Income' },
  { value: 'Expense', label: 'Expense' },
  { value: 'Transfer', label: 'Transfer' },
];

function formatDateRange(from?: ISODateString, to?: ISODateString): string {
  if (!from && !to) return 'Date range';
  try {
    const fromStr = from ? format(parseISO(from), 'MMM d') : '...';
    const toStr = to ? format(parseISO(to), 'MMM d') : '...';
    return `${fromStr} – ${toStr}`;
  } catch {
    return 'Date range';
  }
}

export function FilterBar({ filters, onFiltersChange, onClearFilters }: FilterBarProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activePopover, setActivePopover] = useState<PopoverType>(null);
  const [mobileExpanded, setMobileExpanded] = useState(false);

  // Local search state (debounced)
  const [searchInput, setSearchInput] = useState(filters.search ?? '');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Local date range state
  const [dateFrom, setDateFrom] = useState(filters.dateFrom ?? '');
  const [dateTo, setDateTo] = useState(filters.dateTo ?? '');

  // Local amount state
  const [amtMin, setAmtMin] = useState(filters.amountMin?.toString() ?? '');
  const [amtMax, setAmtMax] = useState(filters.amountMax?.toString() ?? '');

  const derivedKey = useDerivedKey();
  const currentUser = useCurrentUser();
  const dateFormat = useDateFormat();

  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentUser || !derivedKey) return;
    const uid = currentUser.id;
    void accountStorage.listAccountsByUser(uid).then((r) => {
      if (r.success) setAccounts(r.data);
    });
    void categoryStorage.listCategoriesByUser(uid, derivedKey).then((r) => {
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

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimer.current !== null) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      onFiltersChange({ search: value || undefined });
    }, 350);
  };

  const toggleAccount = useCallback(
    (accountId: UUID) => {
      const current = filters.accountIds ?? [];
      const next = current.includes(accountId)
        ? current.filter((id) => id !== accountId)
        : [...current, accountId];
      onFiltersChange({ accountIds: next.length > 0 ? next : undefined });
    },
    [filters.accountIds, onFiltersChange]
  );

  const toggleCategory = useCallback(
    (categoryId: UUID) => {
      const current = filters.categoryIds ?? [];
      const next = current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId];
      onFiltersChange({ categoryIds: next.length > 0 ? next : undefined });
    },
    [filters.categoryIds, onFiltersChange]
  );

  const applyDateRange = () => {
    onFiltersChange({
      dateFrom: dateFrom ? (dateFrom as ISODateString) : undefined,
      dateTo: dateTo ? (dateTo as ISODateString) : undefined,
    });
    setActivePopover(null);
  };

  const clearDateRange = () => {
    setDateFrom('');
    setDateTo('');
    onFiltersChange({ dateFrom: undefined, dateTo: undefined });
    setActivePopover(null);
  };

  const applyAmountRange = () => {
    onFiltersChange({
      amountMin: amtMin ? parseFloat(amtMin) : undefined,
      amountMax: amtMax ? parseFloat(amtMax) : undefined,
    });
    setActivePopover(null);
  };

  const clearAmountRange = () => {
    setAmtMin('');
    setAmtMax('');
    onFiltersChange({ amountMin: undefined, amountMax: undefined });
    setActivePopover(null);
  };

  const hasDateFilter = !!(filters.dateFrom ?? filters.dateTo);
  const hasAccountFilter = (filters.accountIds?.length ?? 0) > 0;
  const hasCategoryFilter = (filters.categoryIds?.length ?? 0) > 0;
  const hasTypeFilter = (filters.types?.length ?? 0) > 0;
  const hasAmountFilter = filters.amountMin !== undefined || filters.amountMax !== undefined;
  const hasSearchFilter = !!filters.search;
  const hasAnyFilter = hasDateFilter || hasAccountFilter || hasCategoryFilter || hasTypeFilter || hasAmountFilter || hasSearchFilter;

  const activeType: TransactionType | 'All' =
    filters.types && filters.types.length === 1 ? filters.types[0] : 'All';

  function renderFilterControls() {
    return (
      <>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => { handleSearchChange(e.target.value); }}
            placeholder="Search notes…"
            className="h-8 rounded-lg border border-input bg-background pl-8 pr-8 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-ring max-sm:w-full"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => { handleSearchChange(''); }}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Date range */}
        <div className="relative" ref={activePopover === 'date' ? popoverRef : undefined}>
          <button
            type="button"
            onClick={() => { setActivePopover(activePopover === 'date' ? null : 'date'); }}
            className={`h-8 px-3 rounded-lg border text-sm flex items-center gap-1.5 transition-all duration-150 whitespace-nowrap ${hasDateFilter ? 'border-primary text-primary bg-primary/5' : 'border-input bg-background text-muted-foreground hover:text-foreground hover:border-border'}`}
          >
            <Calendar className="w-3.5 h-3.5" />
            {formatDateRange(filters.dateFrom, filters.dateTo)}
          </button>
          {activePopover === 'date' && (
            <div ref={popoverRef} className="absolute top-full left-0 mt-1 z-20 bg-card border border-border rounded-xl shadow-lg p-4 w-64">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); }}
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm w-full"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); }}
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm w-full"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={applyDateRange}
                    className="flex-1 h-8 rounded-md bg-primary text-primary-foreground text-xs font-medium"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={clearDateRange}
                    className="h-8 px-3 rounded-md border border-border text-xs text-muted-foreground"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Account filter */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setActivePopover(activePopover === 'account' ? null : 'account'); }}
            className={`h-8 px-3 rounded-lg border text-sm flex items-center gap-1.5 transition-all duration-150 whitespace-nowrap ${hasAccountFilter ? 'border-primary text-primary bg-primary/5' : 'border-input bg-background text-muted-foreground hover:text-foreground hover:border-border'}`}
          >
            <Wallet className="w-3.5 h-3.5" />
            {hasAccountFilter
              ? `${(filters.accountIds?.length ?? 0).toString()} account${(filters.accountIds?.length ?? 0) > 1 ? 's' : ''}`
              : 'Account'}
          </button>
          {activePopover === 'account' && (
            <div ref={popoverRef} className="absolute top-full left-0 mt-1 z-20 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[180px] max-h-52 overflow-y-auto">
              <button
                type="button"
                onClick={() => { onFiltersChange({ accountIds: undefined }); setActivePopover(null); }}
                className="flex items-center gap-2 px-3 py-2 w-full hover:bg-muted/50 text-sm"
              >
                All accounts
                {!hasAccountFilter && <Check className="w-4 h-4 text-primary ml-auto" />}
              </button>
              {accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => { toggleAccount(account.id); }}
                  className="flex items-center gap-2 px-3 py-2 w-full hover:bg-muted/50 text-sm"
                >
                  <span className="flex-1 text-left">{account.name}</span>
                  <span className="text-xs text-muted-foreground">{account.type}</span>
                  {filters.accountIds?.includes(account.id) && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Category filter */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setActivePopover(activePopover === 'category' ? null : 'category'); }}
            className={`h-8 px-3 rounded-lg border text-sm flex items-center gap-1.5 transition-all duration-150 whitespace-nowrap ${hasCategoryFilter ? 'border-primary text-primary bg-primary/5' : 'border-input bg-background text-muted-foreground hover:text-foreground hover:border-border'}`}
          >
            <Tag className="w-3.5 h-3.5" />
            {hasCategoryFilter
              ? `${(filters.categoryIds?.length ?? 0).toString()} categories`
              : 'Category'}
          </button>
          {activePopover === 'category' && (
            <div ref={popoverRef} className="absolute top-full left-0 mt-1 z-20 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[200px] max-h-52 overflow-y-auto">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => { toggleCategory(cat.id); }}
                  className="flex items-center gap-2 px-3 py-2 w-full hover:bg-muted/50 text-sm"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="flex-1 text-left">{cat.name}</span>
                  {filters.categoryIds?.includes(cat.id) && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Type filter */}
        <div className="flex rounded-lg border border-border bg-muted p-0.5 gap-0.5">
          {TRANSACTION_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                if (t.value === 'All') {
                  onFiltersChange({ types: undefined });
                } else {
                  onFiltersChange({ types: [t.value] });
                }
              }}
              className={[
                'flex items-center px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-100 whitespace-nowrap',
                activeType === t.value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              ]
                .join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Amount range */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setActivePopover(activePopover === 'amount' ? null : 'amount'); }}
            className={`h-8 px-3 rounded-lg border text-sm flex items-center gap-1.5 transition-all duration-150 whitespace-nowrap ${hasAmountFilter ? 'border-primary text-primary bg-primary/5' : 'border-input bg-background text-muted-foreground hover:text-foreground hover:border-border'}`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Amount
          </button>
          {activePopover === 'amount' && (
            <div ref={popoverRef} className="absolute top-full left-0 mt-1 z-20 bg-card border border-border rounded-xl shadow-lg p-4 w-52">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Min</label>
                  <input
                    type="number"
                    value={amtMin}
                    onChange={(e) => { setAmtMin(e.target.value); }}
                    placeholder="0"
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm w-full"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Max</label>
                  <input
                    type="number"
                    value={amtMax}
                    onChange={(e) => { setAmtMax(e.target.value); }}
                    placeholder="∞"
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm w-full"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={applyAmountRange}
                    className="flex-1 h-8 rounded-md bg-primary text-primary-foreground text-xs font-medium"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={clearAmountRange}
                    className="h-8 px-3 rounded-md border border-border text-xs text-muted-foreground"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  // Active filter chips
  function renderActiveChips() {
    const chips: { label: string; onRemove: () => void }[] = [];
    if (filters.search) {
      chips.push({ label: `"${filters.search}"`, onRemove: () => { onFiltersChange({ search: undefined }); setSearchInput(''); } });
    }
    if (hasDateFilter) {
      chips.push({ label: formatDateRange(filters.dateFrom, filters.dateTo), onRemove: () => { onFiltersChange({ dateFrom: undefined, dateTo: undefined }); setDateFrom(''); setDateTo(''); } });
    }
    if (hasAccountFilter) {
      const accountNames = (filters.accountIds ?? []).map((id) => accounts.find((a) => a.id === id)?.name ?? id);
      chips.push({ label: accountNames.join(', '), onRemove: () => { onFiltersChange({ accountIds: undefined }); } });
    }
    if (hasCategoryFilter) {
      const catNames = (filters.categoryIds ?? []).map((id) => categories.find((c) => c.id === id)?.name ?? id);
      chips.push({ label: catNames.join(', '), onRemove: () => { onFiltersChange({ categoryIds: undefined }); } });
    }
    if (hasTypeFilter) {
      chips.push({ label: filters.types?.join(', ') ?? '', onRemove: () => { onFiltersChange({ types: undefined }); } });
    }
    if (hasAmountFilter) {
      const label = [
        filters.amountMin !== undefined ? `Min $${filters.amountMin.toString()}` : null,
        filters.amountMax !== undefined ? `Max $${filters.amountMax.toString()}` : null,
      ].filter(Boolean).join(', ');
      chips.push({ label, onRemove: clearAmountRange });
    }
    if (chips.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5 mt-2 px-4 lg:px-0">
        {chips.map((chip) => (
          <span
            key={chip.label}
            className="flex items-center gap-1 h-6 px-2.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
          >
            {chip.label}
            <button type="button" onClick={chip.onRemove} aria-label={`Remove ${chip.label} filter`}>
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={onClearFilters}
          className="text-xs text-muted-foreground hover:text-foreground ml-1 transition-colors duration-100"
        >
          Clear all
        </button>
      </div>
    );
  }

  // Suppress unused variable warning
  void dateFormat;

  return (
    <div>
      {/* Desktop: single horizontal row */}
      <div className="hidden lg:flex items-center gap-2 flex-wrap mb-4">
        {renderFilterControls()}
      </div>

      {/* Mobile: toggle button + collapsed/expanded panel */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between px-4 pb-2">
          <button
            type="button"
            onClick={() => { setMobileExpanded((prev) => !prev); }}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg border text-sm transition-all duration-150 ${mobileExpanded || hasAnyFilter ? 'border-primary text-primary bg-primary/5' : 'border-input bg-background text-muted-foreground'}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {hasAnyFilter && (
              <span className="ml-1 bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                !
              </span>
            )}
          </button>
        </div>

        {/* Mobile expanded panel */}
        {mobileExpanded && (
          <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 mx-4 mb-3 animate-in slide-in-from-top-2 duration-200">
            {renderFilterControls()}
          </div>
        )}
      </div>

      {/* Active filter chips */}
      {renderActiveChips()}
    </div>
  );
}
