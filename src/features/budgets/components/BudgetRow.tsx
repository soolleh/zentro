import { useState } from 'react';
import { Pencil, Trash2, Bell, AlertCircle, ArrowRight, Plus } from 'lucide-react';
import type { EnrichedBudget } from '@/shared/types/budget.types';
import { formatCurrency } from '@/shared/utils/currency.utils';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { useShallow } from 'zustand/react/shallow';
import { useBudgetPanel, useInlineEdit, useBudgetStore } from '@/app/stores/budget.store';
import { useDerivedKey } from '@/app/stores/session.store';
import { useUIStore } from '@/app/ui.store';
import { budgetStorage } from '@/services/storage/budget.storage';
import { updateBudgetAmount } from '@/services/budgets/budget.service';
import { VelocityIndicator } from './VelocityIndicator';
import { BudgetRowExpanded } from './BudgetRowExpanded';
import { InlineAmountEdit } from './InlineAmountEdit';

// ---------------------------------------------------------------------------
// Progress bar colour helper
// ---------------------------------------------------------------------------
function getBarColor(percent: number): string {
  if (percent >= 100) return 'bg-destructive';
  if (percent >= 90) return 'bg-amber-500';
  if (percent >= 70) return 'bg-[hsl(var(--chart-3))]';
  return 'bg-primary';
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type BudgetRowProps = {
  readonly enrichedBudget: EnrichedBudget;
  readonly baseCurrency: string;
  readonly isCurrentCycle: boolean;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function BudgetRow({ enrichedBudget, baseCurrency, isCurrentCycle }: BudgetRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { openPanel } = useBudgetPanel();
  const { editingBudgetId, setEditingBudget } = useInlineEdit();
  const { updateBudgetInList, removeBudgetFromList } = useBudgetStore(
    useShallow((s) => ({
      updateBudgetInList: s.updateBudgetInList,
      removeBudgetFromList: s.removeBudgetFromList,
    }))
  );
  const derivedKey = useDerivedKey();
  const addToast = useUIStore((s) => s.addToast);

  const { budget, category, spent, effectiveAmount, percentUsed, isOverBudget,
    isAlertTriggered, carryForwardAmount, velocity } = enrichedBudget;
  const isEditing = editingBudgetId === budget.id;
  const barColor = getBarColor(percentUsed);
  const barWidth = `${String(Math.min(percentUsed, 100))}%`;
  const projectedOverage = velocity.projectedPercentUsed > 100
    ? Math.min(velocity.projectedPercentUsed - percentUsed, 100 - Math.min(percentUsed, 100))
    : 0;

  const handleEditAmount = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingBudget(budget.id);
  };

  const handleEditPanel = (e: React.MouseEvent) => {
    e.stopPropagation();
    openPanel('edit', budget);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    const result = await budgetStorage.deleteBudget(budget.id);
    if (result.success) {
      removeBudgetFromList(budget.id);
      addToast({ type: 'success', message: 'Budget deleted.' });
    } else {
      addToast({ type: 'error', message: 'Failed to delete budget.' });
    }
    setDeleteDialogOpen(false);
  };

  const handleInlineSave = async (newAmount: number) => {
    if (!derivedKey) return;
    const result = await updateBudgetAmount(budget.id, newAmount, derivedKey);
    if (result.success) {
      updateBudgetInList(result.data);
      addToast({ type: 'success', message: 'Budget updated.' });
    } else {
      addToast({ type: 'error', message: result.error.message });
    }
    setEditingBudget(null);
  };

  const amountColor = isOverBudget
    ? 'text-destructive'
    : percentUsed >= (budget.alertThreshold)
      ? 'text-[hsl(var(--chart-3))]'
      : 'text-foreground';

  return (
    <>
      <div className="rounded-2xl border border-border bg-card overflow-hidden transition-all duration-150 hover:border-border/80 hover:shadow-sm">
        {/* Main row */}
        <div
          className="flex items-center gap-4 px-4 py-4 cursor-pointer"
          onClick={() => { setIsExpanded((v) => !v); }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsExpanded((v) => !v); } }}
          aria-expanded={isExpanded}
        >
          {/* Category indicator */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${category.color}1f` }}
          >
            <span className="text-sm" style={{ color: category.color }}>
              {category.icon}
            </span>
          </div>

          {/* Budget info */}
          <div className="flex-1 min-w-0">
            {/* Top row: name + amount */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground truncate">{category.name}</span>
              {isEditing ? (
                <InlineAmountEdit
                  budget={budget}
                  onSave={handleInlineSave}
                  onCancel={() => { setEditingBudget(null); }}
                />
              ) : (
                <span className="text-sm font-semibold tabular-nums">
                  <span className={amountColor}>{formatCurrency(spent, baseCurrency)}</span>
                  <span className="text-muted-foreground"> / </span>
                  <span className="text-foreground">{formatCurrency(effectiveAmount, baseCurrency)}</span>
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden mt-2 relative">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
                style={{ width: barWidth }}
              />
              {projectedOverage > 0 && (
                <div
                  className={`absolute top-0 h-full rounded-r-full opacity-40 ${barColor}`}
                  style={{
                    left: barWidth,
                    width: `${String(projectedOverage)}%`,
                  }}
                />
              )}
            </div>

            {/* Badges row */}
            {(isAlertTriggered || isOverBudget || carryForwardAmount > 0) && (
              <div className="flex items-center gap-1.5 mt-1">
                {isAlertTriggered && !isOverBudget && (
                  <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                    <Bell className="w-2.5 h-2.5" />
                    Alert triggered
                  </span>
                )}
                {isOverBudget && (
                  <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
                    <AlertCircle className="w-2.5 h-2.5" />
                    Over budget
                  </span>
                )}
                {carryForwardAmount > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[hsl(var(--chart-4)/0.1)] text-[hsl(var(--chart-4))]">
                    <ArrowRight className="w-2.5 h-2.5" />
                    Carry-forward on
                  </span>
                )}
              </div>
            )}

            {/* Bottom row: percent + velocity + carry-forward */}
            <div className="flex items-center justify-between mt-1.5">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${isOverBudget ? 'text-destructive font-semibold' : amountColor}`}>
                  {isOverBudget
                    ? `${String(Math.round(percentUsed - 100))}% over budget`
                    : `${String(Math.round(percentUsed))}% used`}
                </span>
                {carryForwardAmount > 0 && (
                  <span
                    className="flex items-center gap-1 text-xs text-[hsl(var(--chart-4))]"
                    title="This amount was unspent from the previous cycle and added to this cycle's budget."
                  >
                    <Plus className="w-3 h-3" />
                    {formatCurrency(carryForwardAmount, baseCurrency)} carried forward
                  </span>
                )}
              </div>
              <VelocityIndicator enrichedBudget={enrichedBudget} baseCurrency={baseCurrency} />
            </div>
          </div>

          {/* Action buttons */}
          {isCurrentCycle && (
            <div className="flex items-center gap-1 ml-2 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={handleEditAmount}
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150"
                aria-label={`Edit ${category.name} budget amount`}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleEditPanel}
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150"
                aria-label={`Edit ${category.name} budget settings`}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleDeleteClick}
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-muted/60 transition-all duration-150"
                aria-label={`Delete ${category.name} budget`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Expanded detail */}
        {isExpanded && (
          <BudgetRowExpanded
            enrichedBudget={enrichedBudget}
            baseCurrency={baseCurrency}
            maxTransactions={3}
          />
        )}
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={`Delete ${category.name} budget?`}
        description="This will remove the budget for this cycle only."
        confirmLabel="Delete"
        destructive
        onConfirm={() => { void handleConfirmDelete(); }}
      />
    </>
  );
}
