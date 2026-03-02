/**
 * QuickAddFAB.tsx
 *
 * Expandable floating action button for quick transaction entry.
 * Visible on mobile and tablet (hidden on desktop ≥ 1024px).
 *
 * On expand: shows "Add income" and "Add expense" secondary buttons.
 */

import { useState } from 'react';
import { Plus, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTransactionStore } from '@/app/stores/transaction.store';

export function QuickAddFAB() {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const openPanel = useTransactionStore((s) => s.openPanel);

  function handleIncome() {
    setExpanded(false);
    // Navigate to transactions page and open add panel pre-set to Income
    void navigate('/transactions');
    // Small delay to allow navigation before panel opens
    setTimeout(() => {
      openPanel('add');
    }, 50);
  }

  function handleExpense() {
    setExpanded(false);
    void navigate('/transactions');
    setTimeout(() => {
      openPanel('add');
    }, 50);
  }

  function handleBackdropClick() {
    setExpanded(false);
  }

  return (
    <>
      {/* Backdrop */}
      {expanded && (
        <div
          className="fixed inset-0 z-20"
          onClick={handleBackdropClick}
          aria-hidden
        />
      )}

      {/* FAB container */}
      <div className="fixed bottom-6 right-4 z-30 flex flex-col items-end gap-2 lg:hidden">
        {/* Secondary actions — animate in */}
        {expanded && (
          <>
            <button
              type="button"
              onClick={handleIncome}
              className="flex items-center gap-2 h-10 px-4 rounded-full bg-card border border-border shadow-md text-sm font-medium text-foreground hover:bg-muted/60 transition-all duration-150 animate-in slide-in-from-bottom-2"
              aria-label="Add income transaction"
            >
              <ArrowDownLeft className="w-4 h-4 text-[hsl(var(--chart-4))]" aria-hidden />
              Add income
            </button>
            <button
              type="button"
              onClick={handleExpense}
              className="flex items-center gap-2 h-10 px-4 rounded-full bg-card border border-border shadow-md text-sm font-medium text-foreground hover:bg-muted/60 transition-all duration-150 animate-in slide-in-from-bottom-2"
              aria-label="Add expense transaction"
            >
              <ArrowUpRight className="w-4 h-4 text-destructive" aria-hidden />
              Add expense
            </button>
          </>
        )}

        {/* Primary FAB */}
        <button
          type="button"
          onClick={() => { setExpanded((v) => !v); }}
          className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all duration-150"
          aria-label={expanded ? 'Close quick add menu' : 'Quick add transaction'}
          aria-expanded={expanded}
        >
          <Plus
            className={`w-6 h-6 transition-transform duration-200 ${expanded ? 'rotate-45' : ''}`}
            aria-hidden
          />
        </button>
      </div>
    </>
  );
}
