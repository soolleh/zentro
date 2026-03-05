import { useState, useRef, useEffect } from 'react';
import {
  Plus,
  MoreHorizontal,
  Calendar,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Target,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { GoalProgressRing } from './GoalProgressRing';
import { useGoalPanel } from '@/app/stores/goal.store';
import { useDateFormat } from '@/app/preferences.store';
import { formatCurrency } from '@/shared/utils/currency.utils';
import type { EnrichedGoal } from '@/shared/types/goal.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FeaturedGoalCardProps = {
  readonly enriched: EnrichedGoal;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string, dateFormat: string): string {
  try {
    const d = parseISO(dateStr);
    switch (dateFormat) {
      case 'MM/DD/YYYY': return format(d, 'MMM d, yyyy');
      case 'YYYY-MM-DD': return format(d, 'yyyy-MM-dd');
      default: return format(d, 'd MMM yyyy');
    }
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// More menu
// ---------------------------------------------------------------------------

type MoreMenuProps = {
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function MoreMenu({ onView, onEdit, onDelete }: MoreMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => { document.removeEventListener('mousedown', handleOutside); };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); }}
        className="p-1 rounded-md hover:bg-muted/60 transition-colors duration-150"
        aria-label="More options"
        aria-expanded={open}
      >
        <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 rounded-xl border border-border bg-card shadow-lg z-20 overflow-hidden animate-in fade-in-0 slide-in-from-top-2 duration-150">
          <button
            type="button"
            onClick={() => { setOpen(false); onView(); }}
            className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted/60 transition-colors duration-100"
          >
            View detail
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onEdit(); }}
            className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted/60 transition-colors duration-100"
          >
            Edit goal
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onDelete(); }}
            className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors duration-100"
          >
            Delete goal
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FeaturedGoalCard({ enriched }: FeaturedGoalCardProps) {
  const { openPanel } = useGoalPanel();
  const { dateFormat } = useDateFormat();

  const {
    goal,
    totalContributed,
    percentComplete,
    remainingAmount,
    isComplete,
    milestones,
    projection,
    linkedAccount,
  } = enriched;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden transition-shadow duration-200 hover:shadow-md mb-2 animate-in fade-in-0 duration-200">
      {/* Top section — gradient header */}
      <div
        className="relative px-6 pt-6 pb-8"
        style={{
          background: `radial-gradient(ellipse at top right, ${goal.color}26 0%, transparent 60%)`,
        }}
      >
        <div className="flex items-start justify-between">
          {/* Left: icon + name + date */}
          <div className="flex flex-col gap-1">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
              style={{ backgroundColor: `${goal.color}26` }}
            >
              {goal.emoji ? (
                <span>{goal.emoji}</span>
              ) : (
                <Target className="w-6 h-6" style={{ color: goal.color }} />
              )}
            </div>
            <h2 className="text-xl font-bold text-foreground mt-3">{goal.name}</h2>
            {goal.targetDate && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                <Calendar className="w-3 h-3" />
                {formatDate(goal.targetDate, dateFormat)}
              </p>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1 mt-1">
            {!isComplete && (
              <button
                type="button"
                onClick={() => { openPanel('contribute', enriched); }}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 active:scale-[0.98] transition-all duration-150"
              >
                <Plus className="w-3.5 h-3.5" />
                Contribute
              </button>
            )}
            <MoreMenu
              onView={() => { openPanel('detail', enriched); }}
              onEdit={() => { openPanel('edit', enriched); }}
              onDelete={() => { openPanel('edit', enriched); }}
            />
          </div>
        </div>
      </div>

      {/* Center section — ring + stats */}
      <div className="flex items-center gap-6 px-6 pb-6 -mt-2 flex-col sm:flex-row">
        {/* Large progress ring */}
        <div className="shrink-0">
          <GoalProgressRing
            percentComplete={percentComplete}
            goalColor={goal.color}
            milestones={milestones}
            size="lg"
          />
        </div>

        {/* Stats */}
        <div className="flex flex-col gap-3 flex-1 w-full">
          {/* Saved */}
          <div>
            <p className="text-xs text-muted-foreground">Saved</p>
            <p className="text-lg font-bold tabular-nums text-foreground">
              {formatCurrency(totalContributed, goal.currency)}
            </p>
            <p className="text-xs text-muted-foreground">
              of {formatCurrency(goal.targetAmount, goal.currency)}
            </p>
          </div>

          {/* Remaining */}
          <div>
            <p className="text-xs text-muted-foreground">Remaining</p>
            {isComplete ? (
              <p className="text-lg font-bold tabular-nums text-[hsl(var(--chart-4))]">
                Goal reached! 🎉
              </p>
            ) : (
              <p className="text-lg font-bold tabular-nums text-foreground">
                {formatCurrency(remainingAmount, goal.currency)}
              </p>
            )}
          </div>

          {/* Projection */}
          <div>
            <p className="text-xs text-muted-foreground">Projected completion</p>
            {projection.projectedCompletionDate ? (
              <>
                <p
                  className="text-sm font-semibold"
                  style={{
                    color: projection.isOnTrack
                      ? 'hsl(var(--chart-4))'
                      : 'hsl(var(--chart-3))',
                  }}
                >
                  {formatDate(projection.projectedCompletionDate, dateFormat)}
                </p>
                <div className="flex items-center gap-1 text-xs mt-0.5">
                  {projection.isOnTrack ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-[hsl(var(--chart-4))]" />
                      <span className="text-[hsl(var(--chart-4))]">On track</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3 text-[hsl(var(--chart-3))]" />
                      <span className="text-[hsl(var(--chart-3))]">Behind target</span>
                    </>
                  )}
                </div>
                {!projection.isOnTrack && projection.requiredMonthlyAmount !== null && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Need {formatCurrency(projection.requiredMonthlyAmount, goal.currency)}/mo to
                    stay on track
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm font-semibold text-muted-foreground">
                Add contributions to project
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom — linked account strip */}
      {linkedAccount && (
        <div className="flex items-center gap-2 px-6 py-3 border-t border-border/50 bg-muted/20">
          <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Linked to</span>
          <span className="text-xs font-medium text-foreground">{linkedAccount.name}</span>
        </div>
      )}
    </div>
  );
}
