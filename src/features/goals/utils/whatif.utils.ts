/**
 * whatif.utils.ts
 *
 * Pure, synchronous computation functions for the What-If Simulator.
 * No React. No async. No side effects. No storage access.
 */

import {
  addMonths,
  formatISO,
  format,
  parseISO,
  startOfMonth,
  differenceInCalendarMonths,
} from 'date-fns';
import type { ISODateString } from '@/shared/types/common.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WhatIfPoint = {
  readonly date: ISODateString;
  readonly projected: number;
  readonly target: number;
};

export type WhatIfParams = {
  readonly currentTotal: number;
  readonly targetAmount: number;
  readonly monthlyContribution: number;
  readonly startDate: ISODateString;
  readonly targetDate: ISODateString | null;
};

export type WhatIfResult = {
  readonly monthlyContribution: number;
  readonly projectedCompletionDate: ISODateString | null;
  readonly monthsToCompletion: number | null;
  readonly isBeforeTargetDate: boolean;
  readonly totalContributions: number;
  readonly points: WhatIfPoint[];
  readonly targetDateBalance: number | null;
  readonly targetDatePercent: number | null;
};

export type RequiredMonthlyParams = {
  readonly currentTotal: number;
  readonly targetAmount: number;
  readonly targetDate: ISODateString;
};

export type WhatIfSuggestion = {
  readonly label: string;
  readonly amount: number;
  readonly description: string;
};

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

export function computeWhatIfProjection(params: WhatIfParams): WhatIfResult {
  const { currentTotal, targetAmount, monthlyContribution, startDate, targetDate } = params;

  const impossibleResult: WhatIfResult = {
    monthlyContribution,
    projectedCompletionDate: null,
    monthsToCompletion: null,
    isBeforeTargetDate: false,
    totalContributions: 0,
    points: [],
    targetDateBalance: null,
    targetDatePercent: null,
  };

  if (monthlyContribution <= 0 || targetAmount <= 0) return impossibleResult;

  // If already complete
  if (currentTotal >= targetAmount) {
    return {
      ...impossibleResult,
      projectedCompletionDate: startDate,
      monthsToCompletion: 0,
      isBeforeTargetDate: true,
      totalContributions: 0,
    };
  }

  const start = startOfMonth(parseISO(startDate));
  const points: WhatIfPoint[] = [];
  let balance = currentTotal;
  let completionMonth: number | null = null;
  let projectedCompletionDate: ISODateString | null = null;

  for (let i = 0; i < 120; i++) {
    balance = Math.min(balance + monthlyContribution, targetAmount);
    const monthDate = addMonths(start, i + 1);
    points.push({
      date: formatISO(monthDate, { representation: 'date' }) as ISODateString,
      projected: balance,
      target: targetAmount,
    });

    if (balance >= targetAmount) {
      completionMonth = i + 1;
      projectedCompletionDate = formatISO(monthDate, { representation: 'date' }) as ISODateString;
      break;
    }
  }

  // Determine target-date-specific values
  let isBeforeTargetDate = false;
  let targetDateBalance: number | null = null;
  let targetDatePercent: number | null = null;

  if (targetDate) {
    const targetDateParsed = parseISO(targetDate);
    const monthsUntilTarget = differenceInCalendarMonths(targetDateParsed, start);

    if (projectedCompletionDate) {
      isBeforeTargetDate = parseISO(projectedCompletionDate) <= targetDateParsed;
    }

    if (monthsUntilTarget > 0) {
      const pointIndex = monthsUntilTarget - 1;
      if (pointIndex < points.length) {
        targetDateBalance = points[pointIndex].projected;
        targetDatePercent = Math.min(100, (targetDateBalance / targetAmount) * 100);
      } else if (points.length > 0) {
        // Goal already completed before target date
        targetDateBalance = targetAmount;
        targetDatePercent = 100;
      }
    }
  }

  const totalContributions = completionMonth !== null ? monthlyContribution * completionMonth : 0;

  return {
    monthlyContribution,
    projectedCompletionDate,
    monthsToCompletion: completionMonth,
    isBeforeTargetDate,
    totalContributions,
    points,
    targetDateBalance,
    targetDatePercent,
  };
}

// ---------------------------------------------------------------------------
// Required monthly contribution to hit target date
// ---------------------------------------------------------------------------

export function computeRequiredMonthly(params: RequiredMonthlyParams): number {
  const { currentTotal, targetAmount, targetDate } = params;
  if (currentTotal >= targetAmount) return 0;
  const now = startOfMonth(new Date());
  const target = parseISO(targetDate);
  const months = differenceInCalendarMonths(target, now);
  if (months <= 0) return Infinity;
  return Math.ceil((targetAmount - currentTotal) / months);
}

// ---------------------------------------------------------------------------
// Suggestion chips
// ---------------------------------------------------------------------------

export function getWhatIfSuggestions(
  params: WhatIfParams & {
    readonly currentRate: number;
    readonly requiredMonthlyAmount: number | null;
  }
): WhatIfSuggestion[] {
  const { currentRate, requiredMonthlyAmount, targetDate, targetAmount } = params;
  const suggestions: WhatIfSuggestion[] = [];

  if (currentRate > 0) {
    suggestions.push({
      label: 'Current pace',
      amount: currentRate,
      description: 'Based on your last 3 months',
    });
  }

  if (
    targetDate !== null &&
    requiredMonthlyAmount !== null &&
    requiredMonthlyAmount > 0 &&
    requiredMonthlyAmount !== currentRate
  ) {
    suggestions.push({
      label: 'Stay on track',
      amount: requiredMonthlyAmount,
      description: 'Required to hit your target date',
    });
  }

  if (currentRate > 0) {
    suggestions.push({
      label: 'Double up',
      amount: Math.round(currentRate * 2),
      description: 'Finish in roughly half the time',
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      label: '2-year plan',
      amount: Math.ceil(targetAmount / 24),
      description: 'Complete this goal in 24 months',
    });
  }

  return suggestions.filter((s) => s.amount > 0).slice(0, 3);
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatMonthYear(date: ISODateString): string {
  return format(parseISO(date), 'MMM yyyy');
}

export function formatMonthsToCompletion(months: number): string {
  if (months <= 0) return '0 months';
  if (months < 12) return `${months.toString()} month${months === 1 ? '' : 's'}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const yearStr = `${years.toString()} year${years === 1 ? '' : 's'}`;
  if (rem === 0) return yearStr;
  return `${yearStr} ${rem.toString()} month${rem === 1 ? '' : 's'}`;
}
