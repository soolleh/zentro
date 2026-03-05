import { Target } from 'lucide-react';
import { useFeaturedGoal } from '@/app/stores/goal.store';
import type { EnrichedGoal } from '@/shared/types/goal.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GoalSelectorStripProps = {
  readonly incompleteGoals: EnrichedGoal[];
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GoalSelectorStrip({ incompleteGoals }: GoalSelectorStripProps) {
  const { featuredGoal, setFeaturedGoal } = useFeaturedGoal();

  if (incompleteGoals.length < 2) return null;

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 mb-5">
      {incompleteGoals.map((enriched) => {
        const { goal, percentComplete } = enriched;
        const isActive = featuredGoal?.goal.id === goal.id;
        return (
          <button
            key={goal.id}
            type="button"
            onClick={() => { setFeaturedGoal(goal.id); }}
            className={`flex items-center gap-2 shrink-0 h-8 px-3 rounded-full border text-xs font-medium cursor-pointer transition-all duration-150 ${isActive
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
            aria-pressed={isActive}
          >
            {goal.emoji ? (
              <span style={{ fontSize: 12 }}>{goal.emoji}</span>
            ) : (
              <Target className="w-3 h-3" />
            )}
            <span className="max-w-[120px] truncate">
              {goal.name.length > 16 ? `${goal.name.slice(0, 16)}…` : goal.name}
            </span>
            <span className="ml-1 text-[10px]">{percentComplete}%</span>
          </button>
        );
      })}
    </div>
  );
}
