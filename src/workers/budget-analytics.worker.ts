/**
 * budget-analytics.worker.ts
 *
 * Web Worker that computes the budget health score off the main thread.
 *
 * Input:
 *   { type: 'COMPUTE_HEALTH_SCORE', currentCycle, historicalCycles }
 *
 * Output:
 *   { type: 'HEALTH_SCORE_RESULT', score: BudgetHealthScore }
 */

import type {
  BudgetCycleUtilization,
  BudgetHealthScore,
  HealthScoreBreakdown,
} from '../shared/types/budget.types';

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

function computeUtilizationScore(cycle: BudgetCycleUtilization): number {
  const budgets = cycle.budgets;
  if (budgets.length === 0) return 20; // neutral
  const avgUsed = budgets.reduce((s, b) => s + b.percentUsed, 0) / budgets.length;
  if (avgUsed <= 50) return 40;
  if (avgUsed <= 70) return 35;
  if (avgUsed <= 85) return 25;
  if (avgUsed <= 95) return 15;
  if (avgUsed <= 100) return 8;
  return 0;
}

function computeConsistencyScore(historicalCycles: BudgetCycleUtilization[]): number {
  if (historicalCycles.length < 2) return 15; // neutral for insufficient history

  // Gather all category IDs that appear across cycles
  const categoryIds = new Set<string>();
  for (const cycle of historicalCycles) {
    for (const eb of cycle.budgets) {
      categoryIds.add(eb.budget.categoryId);
    }
  }

  const covValues: number[] = [];
  for (const catId of categoryIds) {
    const spends: number[] = [];
    for (const cycle of historicalCycles) {
      const eb = cycle.budgets.find((b) => b.budget.categoryId === catId);
      if (eb !== undefined) spends.push(eb.spent);
    }
    if (spends.length < 2) continue;
    const mean = spends.reduce((a, b) => a + b, 0) / spends.length;
    if (mean === 0) continue;
    const variance = spends.reduce((a, b) => a + (b - mean) ** 2, 0) / spends.length;
    const stdDev = Math.sqrt(variance);
    covValues.push(stdDev / mean);
  }

  if (covValues.length === 0) return 15;
  const avgCoV = covValues.reduce((a, b) => a + b, 0) / covValues.length;

  if (avgCoV < 0.15) return 30;
  if (avgCoV < 0.3) return 22;
  if (avgCoV < 0.5) return 14;
  if (avgCoV < 0.75) return 7;
  return 0;
}

function computeOverspendPenalty(cycle: BudgetCycleUtilization): number {
  const overCount = cycle.budgets.filter((b) => b.percentUsed > 100).length;
  if (overCount === 0) return 0;
  if (overCount === 1) return 8;
  if (overCount === 2) return 14;
  return 20;
}

function computeCarryForwardBonus(cycle: BudgetCycleUtilization): number {
  const carryCount = cycle.budgets.filter((b) => b.carryForwardAmount > 0).length;
  if (carryCount >= 2) return 10;
  if (carryCount === 1) return 5;
  return 0;
}

function gradeFromScore(score: number): { grade: BudgetHealthScore['grade']; label: string } {
  if (score >= 90) return { grade: 'A', label: 'Excellent' };
  if (score >= 75) return { grade: 'B', label: 'Good' };
  if (score >= 60) return { grade: 'C', label: 'Fair' };
  if (score >= 45) return { grade: 'D', label: 'Poor' };
  return { grade: 'F', label: 'Critical' };
}

function scoreForCycle(
  cycle: BudgetCycleUtilization,
  historicalCycles: BudgetCycleUtilization[]
): number {
  const utilizationScore = computeUtilizationScore(cycle);
  const consistencyScore = computeConsistencyScore(historicalCycles);
  const overspendPenalty = computeOverspendPenalty(cycle);
  const carryForwardBonus = computeCarryForwardBonus(cycle);
  const raw = utilizationScore + consistencyScore + (20 - overspendPenalty) + carryForwardBonus;
  return Math.max(0, Math.min(100, raw));
}

// ---------------------------------------------------------------------------
// Main computation
// ---------------------------------------------------------------------------

type WorkerInput = {
  type: 'COMPUTE_HEALTH_SCORE';
  currentCycle: BudgetCycleUtilization;
  historicalCycles: BudgetCycleUtilization[];
};

type WorkerOutput = {
  type: 'HEALTH_SCORE_RESULT';
  score: BudgetHealthScore;
};

self.onmessage = (event: MessageEvent<WorkerInput>) => {
  const { currentCycle, historicalCycles } = event.data;

  const utilizationScore = computeUtilizationScore(currentCycle);
  const consistencyScore = computeConsistencyScore(historicalCycles);
  const overspendPenalty = computeOverspendPenalty(currentCycle);
  const carryForwardBonus = computeCarryForwardBonus(currentCycle);

  const breakdown: HealthScoreBreakdown = {
    utilizationScore,
    consistencyScore,
    overspendPenalty,
    carryForwardBonus,
  };

  const rawScore =
    utilizationScore + consistencyScore + (20 - overspendPenalty) + carryForwardBonus;
  const score = Math.max(0, Math.min(100, rawScore));
  const { grade, label } = gradeFromScore(score);

  // Trend: compare to previous cycle score
  let previousScore: number | null = null;
  let trend: BudgetHealthScore['trend'] = 'stable';
  if (historicalCycles.length >= 1) {
    const prevCycle = historicalCycles[0];
    const prevHistorical = historicalCycles.slice(1);
    previousScore = scoreForCycle(prevCycle, prevHistorical);
    const delta = score - previousScore;
    if (delta > 5) trend = 'improving';
    else if (delta < -5) trend = 'declining';
  }

  const output: WorkerOutput = {
    type: 'HEALTH_SCORE_RESULT',
    score: { score, grade, label, breakdown, trend, previousScore },
  };

  self.postMessage(output);
};
