/**
 * GoalProgressCard.tsx
 *
 * Dashboard widget — goal progress rings.
 * Horizontal scroll on mobile, grid on desktop.
 */

import { Link } from 'react-router-dom';
import { Target } from 'lucide-react';
import { DashboardCard } from './DashboardCard';
import { GoalProgressRing } from './GoalProgressRing';
import { useGoalProgress } from '@/app/stores/dashboard.store';

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function GoalsSkeleton() {
  return (
    <div className="flex gap-3">
      <div className="h-[180px] w-full rounded-xl animate-pulse bg-muted flex-shrink-0" />
      <div className="h-[180px] w-full rounded-xl animate-pulse bg-muted flex-shrink-0" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GoalProgressCard() {
  const { goalProgress } = useGoalProgress();

  const activeCount = goalProgress.filter((g) => !g.isComplete).length;

  return (
    <DashboardCard
      title="Goals"
      subtitle={`${String(activeCount)} active`}
      action={{ label: 'View all', href: '/goals' }}
      skeleton={<GoalsSkeleton />}
    >
      {goalProgress.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-4">
          <Target className="w-8 h-8 text-muted-foreground/30" aria-hidden />
          <p className="text-xs text-muted-foreground text-center">No goals set</p>
          <Link
            to="/goals/new"
            className="text-xs text-primary cursor-pointer hover:underline underline-offset-4"
          >
            Create a goal
          </Link>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1 -mx-5 px-5 sm:overflow-visible sm:grid sm:grid-cols-2 sm:mx-0 sm:px-0 sm:pb-0">
          {goalProgress.map((g) => (
            <GoalProgressRing key={g.goal.id} summary={g} />
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
