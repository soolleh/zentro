import { TrendingUp, AlertTriangle, AlertCircle } from 'lucide-react';
import type { EnrichedBudget } from '@/shared/types/budget.types';
import { formatCurrency } from '@/shared/utils/currency.utils';

type VelocityIndicatorProps = {
  readonly enrichedBudget: EnrichedBudget;
  readonly baseCurrency: string;
};

export function VelocityIndicator({ enrichedBudget, baseCurrency }: VelocityIndicatorProps) {
  const { velocity, remaining, spent, effectiveAmount, isOverBudget } = enrichedBudget;
  const { projectedPercentUsed, projectedTotal, daysRemaining } = velocity;

  if (isOverBudget) {
    const overAmount = spent - effectiveAmount;
    return (
      <span className="flex items-center gap-1 text-xs text-destructive font-medium">
        <AlertCircle className="w-3 h-3" />
        {formatCurrency(overAmount, baseCurrency)} over · {String(daysRemaining)}d left
      </span>
    );
  }

  if (projectedPercentUsed > 110) {
    return (
      <span className="flex items-center gap-1 text-xs text-destructive">
        <AlertTriangle className="w-3 h-3" />
        Projected: {formatCurrency(projectedTotal, baseCurrency)} ({String(Math.round(projectedPercentUsed))}%)
      </span>
    );
  }

  if (projectedPercentUsed > 90) {
    return (
      <span className="flex items-center gap-1 text-xs text-[hsl(var(--chart-3))]">
        <TrendingUp className="w-3 h-3" />
        Projected: {formatCurrency(projectedTotal, baseCurrency)} ({String(Math.round(projectedPercentUsed))}%)
      </span>
    );
  }

  return (
    <span className="text-xs text-muted-foreground">
      {formatCurrency(remaining, baseCurrency)} left · on track
    </span>
  );
}
