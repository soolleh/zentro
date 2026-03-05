import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { format, parseISO, differenceInMonths } from 'date-fns';
import type { UUID, ISODateString } from '@/shared/types/common.types';
import { useBudgetNavigation, useBudgetStore } from '@/app/stores/budget.store';

const MAX_HISTORY_MONTHS = 12;

type MonthNavigatorProps = {
  readonly userId: UUID;
  readonly currentCycleStart: ISODateString;
  readonly isCurrentCycle: boolean;
};

export function MonthNavigator({ userId, currentCycleStart, isCurrentCycle }: MonthNavigatorProps) {
  const { viewingCycleStart, navigateToCycle, navigateToCurrentCycle } = useBudgetNavigation();
  const isLoading = useBudgetStore((s) => s.isLoading);

  const cycleDate = parseISO(viewingCycleStart);
  const cycleLabel = format(cycleDate, 'MMMM yyyy');

  // Compute cycle end for subline (we add ~1 month and subtract 1 day)
  const nextMonthDate = new Date(
    cycleDate.getFullYear(),
    cycleDate.getMonth() + 1,
    cycleDate.getDate()
  );
  const cycleEndDate = new Date(nextMonthDate.getTime() - 86400000);
  const cycleDateRange = `${format(cycleDate, 'MMM d')} – ${format(cycleEndDate, 'MMM d')}`;

  const isPrevDisabled = isLoading ||
    differenceInMonths(parseISO(currentCycleStart), cycleDate) >= MAX_HISTORY_MONTHS;
  const isNextDisabled = isLoading || isCurrentCycle;

  const handlePrev = () => {
    void navigateToCycle(userId, 'prev');
  };

  const handleNext = () => {
    void navigateToCycle(userId, 'next');
  };

  const handleBackToCurrent = () => {
    void navigateToCurrentCycle(userId);
  };

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between">
        {/* Prev button */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={isPrevDisabled}
          className="w-9 h-9 rounded-lg border border-border bg-background flex items-center justify-center cursor-pointer hover:bg-muted/60 transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4 text-foreground" />
        </button>

        {/* Cycle label */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-foreground">{cycleLabel}</span>
            {isCurrentCycle && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                Current
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{cycleDateRange}</span>
        </div>

        {/* Next button */}
        <button
          type="button"
          onClick={handleNext}
          disabled={isNextDisabled}
          className="w-9 h-9 rounded-lg border border-border bg-background flex items-center justify-center cursor-pointer hover:bg-muted/60 transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4 text-foreground" />
        </button>
      </div>

      {/* Back to current strip */}
      {!isCurrentCycle && (
        <div className="flex items-center justify-center mt-3">
          <button
            type="button"
            onClick={handleBackToCurrent}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline underline-offset-4 cursor-pointer transition-colors duration-150"
          >
            <RotateCcw className="w-3 h-3" />
            Back to current month
          </button>
        </div>
      )}
    </div>
  );
}
