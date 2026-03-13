/**
 * JourneyTimeline.tsx
 *
 * SlidePanel showing the full 16-milestone journey timeline.
 * Groups milestones by stage. Shows achieved, current, and locked states.
 */
import { formatDistanceToNow } from 'date-fns';
import {
  MILESTONE_CONFIG,
  getMilestoneProgress,
  formatINR,
  BADGE_LEVEL_STYLES,
  type BadgeLevel,
  type MilestoneStage,
} from '@/services/milestones/milestone-config';
import { SlidePanel } from '@/shared/components/SlidePanel';
import {
  useMilestones,
  useJourney,
} from '@/app/stores/milestone.store';
import type { AchievedMilestone } from '@/shared/types/milestone.types';

// ---------------------------------------------------------------------------
// Stage labels
// ---------------------------------------------------------------------------

const STAGE_LABEL: Record<MilestoneStage, string> = {
  beginner: 'Beginner',
  growth: 'Growth',
  advanced: 'Advanced',
};

const STAGE_COLOR: Record<MilestoneStage, string> = {
  beginner: 'text-emerald-600 dark:text-emerald-400',
  growth: 'text-indigo-600 dark:text-indigo-400',
  advanced: 'text-purple-600 dark:text-purple-400',
};

const STAGE_BG: Record<MilestoneStage, string> = {
  beginner: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  growth: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  advanced: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

// ---------------------------------------------------------------------------
// Level arc colors
// ---------------------------------------------------------------------------

const LEVEL_COLOR: Record<BadgeLevel, string> = {
  1: '#6366f1',
  2: '#8b5cf6',
  3: '#94a3b8',
  4: '#f59e0b',
  5: '#a855f7',
};

// ---------------------------------------------------------------------------
// Stage groups for rendering
// ---------------------------------------------------------------------------

const STAGES: MilestoneStage[] = ['beginner', 'growth', 'advanced'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type JourneyTimelineProps = {
  // Current net worth for live progress calculation
  currentNetWorth?: number;
};

export function JourneyTimeline({ currentNetWorth = 0 }: JourneyTimelineProps) {
  const { isJourneyOpen, closeJourney } = useJourney();
  const { achieved } = useMilestones();

  const progress = getMilestoneProgress(currentNetWorth);
  const currentMilestoneId = progress.current.id;

  // Build lookup map: milestoneId → AchievedMilestone
  const achievedMap = new Map<number, AchievedMilestone>(
    achieved.map((a) => [a.milestoneId, a])
  );

  return (
    <SlidePanel
      open={isJourneyOpen}
      onClose={closeJourney}
      title={`Your Journey ${progress.current.emoji}`}
      size="md"
    >
      <div className="relative flex flex-col px-8 py-6 overflow-y-auto">
        {/* Vertical timeline line */}
        <div className="absolute left-[3.25rem] top-0 bottom-0 w-0.5 bg-border" aria-hidden="true" />

        {STAGES.map((stage) => {
          const stageMilestones = MILESTONE_CONFIG.filter((m) => m.stage === stage);

          return (
            <div key={stage}>
              {/* Stage group header */}
              <div className="flex items-center gap-3 mb-4 mt-6 first:mt-0 relative z-10">
                <div
                  className={[
                    'h-5 w-5 rounded-full flex items-center justify-center shrink-0',
                    STAGE_BG[stage],
                  ].join(' ')}
                  aria-hidden="true"
                />
                <span
                  className={[
                    'text-xs font-bold uppercase tracking-widest',
                    STAGE_COLOR[stage],
                  ].join(' ')}
                >
                  {STAGE_LABEL[stage]} Stage
                </span>
                <span
                  className={[
                    'ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full',
                    STAGE_BG[stage],
                  ].join(' ')}
                >
                  {stageMilestones.filter((m) => achievedMap.has(m.id)).length}/
                  {stageMilestones.length}
                </span>
              </div>

              {/* Milestone rows */}
              {stageMilestones.map((m) => {
                const achievement = achievedMap.get(m.id);
                const isAchieved = Boolean(achievement);
                const isCurrent = m.id === currentMilestoneId;
                const isLocked = !isAchieved && !isCurrent;

                const badgeLevel = m.badgeLevel as BadgeLevel;
                const levelStyle = BADGE_LEVEL_STYLES[badgeLevel];
                const levelColor = LEVEL_COLOR[badgeLevel];

                // Parse background style
                const badgeInlineStyle: React.CSSProperties = {};
                if (isAchieved || isCurrent) {
                  if (levelStyle.backgroundStyle) {
                    const colonIdx = levelStyle.backgroundStyle.indexOf(':');
                    if (colonIdx !== -1) {
                      badgeInlineStyle.background = levelStyle.backgroundStyle
                        .slice(colonIdx + 1)
                        .trim();
                    }
                  }
                  if (levelStyle.glowClass && levelStyle.glowClass !== 'none') {
                    badgeInlineStyle.boxShadow = levelStyle.glowClass;
                  }
                }

                // Progress for current milestone
                const progressPct = isCurrent
                  ? Math.round(progress.progressPercent)
                  : 0;

                return (
                  <div
                    key={m.id}
                    className="flex items-start gap-4 mb-5 relative"
                  >
                    {/* Badge circle on the timeline */}
                    <div
                      className={[
                        'w-10 h-10 rounded-full flex items-center justify-center border-2 shrink-0 relative z-10 bg-card transition-all duration-300',
                        isLocked
                          ? 'border-border opacity-40 grayscale'
                          : levelStyle.borderClass,
                        isCurrent
                          ? 'after:absolute after:inset-0 after:rounded-full after:animate-ping'
                          : '',
                      ].join(' ')}
                      style={badgeInlineStyle}
                      aria-label={`${m.name}${isAchieved ? ' — achieved' : isCurrent ? ' — current' : ' — locked'}`}
                    >
                      {isCurrent && (
                        <span
                          className="absolute inset-0 rounded-full animate-ping"
                          style={{ backgroundColor: `${levelColor}40` }}
                          aria-hidden="true"
                        />
                      )}
                      <span className="relative z-10 text-xl" aria-hidden="true">
                        {m.emoji}
                      </span>
                    </div>

                    {/* Milestone content */}
                    <div className="flex flex-col gap-0.5 pt-1 min-w-0 flex-1">
                      <span
                        className={[
                          'text-sm font-semibold truncate',
                          isLocked
                            ? 'text-muted-foreground'
                            : 'text-foreground',
                        ].join(' ')}
                      >
                        {m.name}
                      </span>

                      <span className="text-xs text-muted-foreground">
                        {m.threshold === 0 ? 'Starting point' : formatINR(m.threshold)}
                      </span>

                      {/* Achieved: date + net worth */}
                      {isAchieved && achievement && (
                        <span className="text-xs text-muted-foreground">
                          Achieved{' '}
                          {formatDistanceToNow(new Date(achievement.achievedAt), {
                            addSuffix: true,
                          })}{' '}
                          · {formatINR(achievement.netWorthAtAchievement)}
                        </span>
                      )}

                      {/* Current: inline progress bar */}
                      {isCurrent && (
                        <div className="mt-1">
                          <div className="h-1 w-24 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${progressPct.toString()}%`,
                                backgroundColor: levelColor,
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {progressPct.toString()}% there
                          </span>
                        </div>
                      )}

                      {/* Locked: amount away */}
                      {isLocked && (
                        <span className="text-[10px] text-muted-foreground">
                          {formatINR(m.threshold - currentNetWorth)} away
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </SlidePanel>
  );
}
