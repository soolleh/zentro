/**
 * MilestoneHistory.tsx
 *
 * SlidePanel displaying all achieved milestones grouped by tier,
 * plus the next 3 upcoming locked thresholds.
 */
import { format } from 'date-fns';
import { Trophy, Lock } from 'lucide-react';
import type { MilestoneTier, NetWorthMilestone } from '@/shared/types/milestone.types';
import { useMilestones, useMilestoneStore } from '@/app/stores/milestone.store';
import { usePreferencesStore } from '@/app/preferences.store';
import { SlidePanel } from '@/shared/components/SlidePanel';
import { formatCurrency } from '@/shared/utils/currency.utils';
import { NET_WORTH_THRESHOLDS } from '@/services/milestones/milestone-thresholds';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIER_ORDER: MilestoneTier[] = ['diamond', 'platinum', 'gold', 'silver', 'bronze'];

const TIER_LABEL: Record<MilestoneTier, string> = {
  diamond: 'Diamond',
  platinum: 'Platinum',
  gold: 'Gold',
  silver: 'Silver',
  bronze: 'Bronze',
};

const TIER_BADGE_CLASS: Record<MilestoneTier, string> = {
  bronze:
    'bg-[#cd7f32]/15 text-[#cd7f32] border border-[#cd7f32]/30',
  silver:
    'bg-[#c0c0c0]/15 text-slate-600 border border-[#c0c0c0]/40',
  gold:
    'bg-[#ffd700]/15 text-amber-700 border border-[#ffd700]/40',
  platinum:
    'bg-[#e5e4e2]/40 text-slate-600 border border-[#e5e4e2]/60',
  diamond:
    'bg-gradient-to-r from-blue-400/15 to-purple-500/15 text-blue-600 border border-blue-400/30',
};

const UPCOMING_COUNT = 3;

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

type MilestoneRowProps = {
  milestone: NetWorthMilestone;
  currency: string;
};

function MilestoneRow({ milestone, currency }: MilestoneRowProps) {
  const date = format(new Date(milestone.achievedAt), 'dd MMM yyyy');
  const amount = formatCurrency(milestone.netWorthAtAchievement, currency);

  return (
    <div className="flex items-start gap-3 py-3 px-1">
      {/* Emoji */}
      <span className="text-2xl leading-none select-none mt-0.5" aria-hidden="true">
        {milestone.emoji}
      </span>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-snug">{milestone.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Achieved {date} · {amount}
        </p>
      </div>

      {/* Tier badge */}
      <span
        className={`flex-shrink-0 self-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${TIER_BADGE_CLASS[milestone.tier]}`}
        aria-label={`${TIER_LABEL[milestone.tier]} tier`}
      >
        {TIER_LABEL[milestone.tier]}
      </span>
    </div>
  );
}

type UpcomingRowProps = {
  threshold: { value: number; label: string; emoji: string };
  currentNetWorth: number;
  currency: string;
};

function UpcomingRow({ threshold, currentNetWorth, currency }: UpcomingRowProps) {
  const remaining = threshold.value - currentNetWorth;
  return (
    <div className="flex items-start gap-3 py-3 px-1 opacity-50">
      {/* Locked emoji */}
      <span className="text-2xl leading-none select-none mt-0.5 grayscale" aria-hidden="true">
        {threshold.emoji}
      </span>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-snug">{threshold.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatCurrency(remaining, currency)} away
        </p>
      </div>

      {/* Lock icon */}
      <Lock className="w-4 h-4 text-muted-foreground self-center flex-shrink-0" aria-hidden="true" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MilestoneHistory() {
  const isOpen = useMilestoneStore((s) => s.isHistoryOpen);
  const closeHistory = useMilestoneStore((s) => s.closeHistory);
  const { milestones } = useMilestones();
  const baseCurrency = usePreferencesStore((s) => s.baseCurrency);

  // Get net worth from milestone progress (best-effort for "amount away" calc)
  const milestoneProgress = useMilestoneStore((s) => s.milestoneProgress);
  const currentNetWorth = milestoneProgress?.current ?? 0;
  const byTier = new Map<MilestoneTier, NetWorthMilestone[]>();
  for (const m of milestones) {
    const group = byTier.get(m.tier) ?? [];
    group.push(m);
    byTier.set(m.tier, group);
  }

  // Find the next N unachieved net worth thresholds
  const achievedThresholds = new Set(
    milestones.filter((m) => m.type === 'net_worth').map((m) => m.threshold)
  );
  const upcomingThresholds = NET_WORTH_THRESHOLDS.filter(
    (t) => !achievedThresholds.has(t.value) && t.value > currentNetWorth
  ).slice(0, UPCOMING_COUNT);

  const totalCount = milestones.length;

  return (
    <SlidePanel
      open={isOpen}
      onClose={closeHistory}
      title={totalCount > 0 ? `Milestones · ${totalCount}` : 'Milestones'}
      size="md"
    >
      <div className="flex flex-col gap-0">
        {/* Empty state */}
        {totalCount === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <Trophy className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No milestones yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                Keep building your net worth and your milestones will appear here.
              </p>
            </div>
          </div>
        )}

        {/* Milestones grouped by tier */}
        {TIER_ORDER.map((tier) => {
          const group = byTier.get(tier);
          if (!group || group.length === 0) return null;

          // Sort each group by achievedAt descending
          const sorted = [...group].sort(
            (a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime()
          );

          return (
            <section key={tier} aria-labelledby={`tier-heading-${tier}`}>
              <div className="flex items-center gap-2 px-1 py-2 mt-4 first:mt-0">
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TIER_BADGE_CLASS[tier]}`}
                >
                  {TIER_LABEL[tier]}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="divide-y divide-border/50">
                {sorted.map((m) => (
                  <MilestoneRow key={m.id} milestone={m} currency={baseCurrency} />
                ))}
              </div>
            </section>
          );
        })}

        {/* Coming up section */}
        {upcomingThresholds.length > 0 && (
          <section aria-labelledby="coming-up-heading">
            <div className="flex items-center gap-2 px-1 py-2 mt-6">
              <span
                id="coming-up-heading"
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
              >
                Coming up
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="divide-y divide-border/50">
              {upcomingThresholds.map((t) => (
                <UpcomingRow
                  key={t.value}
                  threshold={t}
                  currentNetWorth={currentNetWorth}
                  currency={baseCurrency}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </SlidePanel>
  );
}
