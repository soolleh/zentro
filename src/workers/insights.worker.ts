/**
 * insights.worker.ts
 *
 * Web Worker that computes financial insights from pre-loaded dashboard data.
 * Runs off the main thread to avoid blocking the UI.
 *
 * Communication:
 *   postMessage(InsightWorkerInput)  →  receives Insight[]
 */

import type { Insight, InsightType, InsightWorkerInput } from '../shared/types/dashboard.types';

// ---------------------------------------------------------------------------
// Helper — generate a deterministic id for deduplication
// ---------------------------------------------------------------------------

let _idCounter = 0;
function makeId(type: InsightType, suffix: string): string {
  return `${type}:${suffix}:${String(++_idCounter)}`;
}

// ---------------------------------------------------------------------------
// Insight computation
// ---------------------------------------------------------------------------

function computeInsights(input: InsightWorkerInput): Insight[] {
  const insights: Insight[] = [];
  _idCounter = 0;

  const {
    budgetUtilization,
    upcomingBills,
    goalProgress,
    currentMonthSavingsRate,
    hasRecentTransactions,
  } = input;

  // 1. Budget exceeded
  for (const b of budgetUtilization) {
    if (b.percentUsed > 100) {
      insights.push({
        id: makeId('BudgetExceeded', b.budget.id),
        type: 'BudgetExceeded',
        title: `${b.category.name} budget exceeded`,
        description: `You've spent ${String(Math.round(b.percentUsed))}% of your ${b.category.name} budget this month.`,
        severity: 'warning',
        actionLabel: 'View budgets',
        actionRoute: '/budgets',
      });
    }
    if (insights.length >= 4) return insights;
  }

  // 2. Budget near limit
  for (const b of budgetUtilization) {
    if (b.percentUsed <= 100 && b.isAlertTriggered) {
      insights.push({
        id: makeId('BudgetNearLimit', b.budget.id),
        type: 'BudgetNearLimit',
        title: `${b.category.name} budget at ${String(Math.round(b.percentUsed))}%`,
        description: `You're approaching your ${b.category.name} budget limit for this month.`,
        severity: 'warning',
        actionLabel: 'View budgets',
        actionRoute: '/budgets',
      });
    }
    if (insights.length >= 4) return insights;
  }

  // 3. Bills due soon (within 3 days)
  for (const b of upcomingBills) {
    if (!b.isOverdue && b.daysUntilDue <= 3) {
      const daysLabel =
        b.daysUntilDue === 0
          ? 'today'
          : `in ${String(b.daysUntilDue)} day${b.daysUntilDue === 1 ? '' : 's'}`;
      insights.push({
        id: makeId('BillDueSoon', b.bill.id),
        type: 'BillDueSoon',
        title: `${b.bill.name} due ${daysLabel}`,
        description: `Your ${b.bill.name} payment is due soon.`,
        severity: 'warning',
        actionLabel: 'View bills',
        actionRoute: '/bills',
      });
    }
    if (insights.length >= 4) return insights;
  }

  // 4. Goals behind target
  for (const g of goalProgress) {
    if (!g.isOnTrack && !g.isComplete) {
      insights.push({
        id: makeId('GoalBehindTarget', g.goal.id),
        type: 'GoalBehindTarget',
        title: `${g.goal.name} is behind target`,
        description: `You've contributed ${String(Math.round(g.percentComplete))}% towards your goal. Keep it up!`,
        severity: 'info',
        actionLabel: 'View goals',
        actionRoute: '/goals',
      });
    }
    if (insights.length >= 4) return insights;
  }

  // 5. Savings rate high (≥ 20%)
  if (currentMonthSavingsRate >= 20) {
    insights.push({
      id: makeId('SavingsRateHigh', 'current'),
      type: 'SavingsRateHigh',
      title: 'Great savings rate this month',
      description: `You've saved ${String(Math.round(currentMonthSavingsRate))}% of your income — keep it up.`,
      severity: 'positive',
    });
    if (insights.length >= 4) return insights;
  }

  // 6. Spending exceeds income (savings rate < 0)
  if (currentMonthSavingsRate < 0) {
    insights.push({
      id: makeId('SavingsRateLow', 'current'),
      type: 'SavingsRateLow',
      title: 'Spending exceeds income this month',
      description: "You've spent more than you've earned this month.",
      severity: 'warning',
    });
    if (insights.length >= 4) return insights;
  }

  // 7. Goal complete
  for (const g of goalProgress) {
    if (g.isComplete) {
      insights.push({
        id: makeId('GoalComplete', g.goal.id),
        type: 'GoalComplete',
        title: `${g.goal.name} is complete!`,
        description: `Congratulations! You've reached your savings goal.`,
        severity: 'positive',
        actionLabel: 'View goals',
        actionRoute: '/goals',
      });
    }
    if (insights.length >= 4) return insights;
  }

  // 8. No recent transactions
  if (!hasRecentTransactions) {
    insights.push({
      id: makeId('NoTransactionsRecorded', 'recent'),
      type: 'NoTransactionsRecorded',
      title: 'No recent transactions',
      description: 'Add transactions to keep your records up to date.',
      severity: 'info',
      actionLabel: 'Add transaction',
      actionRoute: '/transactions/new',
    });
  }

  return insights;
}

// ---------------------------------------------------------------------------
// Worker message handler
// ---------------------------------------------------------------------------

self.onmessage = (event: MessageEvent<InsightWorkerInput>) => {
  const insights = computeInsights(event.data);
  self.postMessage(insights);
};
