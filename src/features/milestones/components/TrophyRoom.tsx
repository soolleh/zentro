/**
 * TrophyRoom.tsx
 *
 * SlidePanel with a 4×4 grid of all 16 milestone badges.
 * Achieved: colored with hover details. Locked: dashed grey.
 * Includes stage completion banners and overall progress bar.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import {
  MILESTONE_CONFIG,
  BADGE_LEVEL_STYLES,
  formatINR,
  type BadgeLevel,
  type MilestoneStage,
} from '@/services/milestones/milestone-config';
import { SlidePanel } from '@/shared/components/SlidePanel';
import { useMilestones, useTrophyRoom } from '@/app/stores/milestone.store';
import { MilestoneBadge } from './MilestoneBadge';
import type { AchievedMilestone } from '@/shared/types/milestone.types';

// ---------------------------------------------------------------------------
// Stage constants
// ---------------------------------------------------------------------------

const STAGES: MilestoneStage[] = ['beginner', 'growth', 'advanced'];

const STAGE_COMPLETION_GRADIENT: Record<MilestoneStage, string> = {
  beginner: 'from-emerald-50 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30',
  growth: 'from-indigo-50 to-blue-100 dark:from-indigo-900/30 dark:to-blue-900/30',
  advanced: 'from-purple-50 to-violet-100 dark:from-purple-900/30 dark:to-violet-900/30',
};

const STAGE_TEXT: Record<MilestoneStage, string> = {
  beginner: 'text-emerald-700 dark:text-emerald-300',
  growth: 'text-indigo-700 dark:text-indigo-300',
  advanced: 'text-purple-700 dark:text-purple-300',
};

const STAGE_LABEL: Record<MilestoneStage, string> = {
  beginner: 'Beginner',
  growth: 'Growth',
  advanced: 'Advanced',
};

// ---------------------------------------------------------------------------
// Badge cell tints for achieved items
// ---------------------------------------------------------------------------

const LEVEL_TINT: Record<BadgeLevel, string> = {
  1: 'bg-muted/40',
  2: 'bg-indigo-50/60 dark:bg-indigo-950/30',
  3: 'bg-slate-50/60 dark:bg-slate-900/30',
  4: 'bg-amber-50/60 dark:bg-amber-950/30',
  5: 'bg-purple-50/60 dark:bg-purple-950/30',
};

// ---------------------------------------------------------------------------
// Trophy cell detail popover
// ---------------------------------------------------------------------------

type DetailPopoverProps = {
  achievement: AchievedMilestone;
  milestoneId: number;
  onClose: () => void;
};

function DetailPopover({ achievement, milestoneId, onClose }: DetailPopoverProps) {
  const config = MILESTONE_CONFIG.find((m) => m.id === milestoneId);
  if (!config) return null;

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 rounded-2xl bg-card/95 backdrop-blur-sm border border-border p-2 text-center shadow-lg"
      onClick={onClose}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter') onClose(); }}
      aria-label="Close details"
    >
      <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">
        achieved
      </p>
      <p className="text-[10px] font-bold text-foreground">
        {format(new Date(achievement.achievedAt), 'MMM d, yyyy')}
      </p>
      <p className="text-[10px] text-muted-foreground">
        {formatINR(achievement.netWorthAtAchievement)}
      </p>
      <p className="text-[9px] text-muted-foreground italic leading-tight mt-0.5 line-clamp-2">
        {config.celebrationMessage}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TrophyRoom() {
  const { isTrophyRoomOpen, closeTrophyRoom } = useTrophyRoom();
  const { achieved } = useMilestones();
  const [openDetailId, setOpenDetailId] = useState<string | null>(null);

  const achievedMap = new Map<number, AchievedMilestone>(
    achieved.map((a) => [a.milestoneId, a])
  );
  const achievedCount = achievedMap.size;
  const overallPercent = (achievedCount / 16) * 100;

  return (
    <SlidePanel
      open={isTrophyRoomOpen}
      onClose={closeTrophyRoom}
      title="Trophy Room"
      size="lg"
    >
      <div className="overflow-y-auto">
        {/* Panel header */}
        <div className="bg-gradient-to-r from-amber-50 to-yellow-100 dark:from-amber-950 dark:to-yellow-950 px-6 py-6 border-b border-amber-200/50">
          <div className="text-4xl text-center" aria-hidden="true">🏆</div>
          <h2 className="text-xl font-black text-center text-foreground mt-2">
            Trophy Room
          </h2>
          <p className="text-xs text-center text-muted-foreground mt-1">
            {achievedCount} of 16 milestones achieved
          </p>

          {/* Overall progress bar */}
          <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden mt-3">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${overallPercent.toString()}%`,
                background: 'linear-gradient(90deg, #f59e0b, #fcd34d)',
              }}
            />
          </div>
          <p className="text-xs text-center text-muted-foreground mt-1">
            {achievedCount}/16 milestones
          </p>
        </div>

        {/* Trophy grid by stage */}
        <div className="px-6 py-5">
          {STAGES.map((stage) => {
            const stageMilestones = MILESTONE_CONFIG.filter(
              (m) => m.stage === stage
            );
            const stageAchievedCount = stageMilestones.filter((m) =>
              achievedMap.has(m.id)
            ).length;
            const stageComplete =
              stageAchievedCount === stageMilestones.length;

            return (
              <div key={stage} className="mb-6">
                {/* Stage completion banner */}
                {stageComplete && (
                  <div
                    className={[
                      'flex items-center justify-center gap-2 py-2 mb-3 rounded-xl bg-gradient-to-r',
                      STAGE_COMPLETION_GRADIENT[stage],
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'text-xs font-bold',
                        STAGE_TEXT[stage],
                      ].join(' ')}
                    >
                      {STAGE_LABEL[stage]} Stage Complete! ✓
                    </span>
                  </div>
                )}

                {/* 4-column grid */}
                <div className="grid grid-cols-4 gap-3">
                  {stageMilestones.map((m) => {
                    const achievement = achievedMap.get(m.id);
                    const isAchieved = Boolean(achievement);
                    const badgeLevel = m.badgeLevel as BadgeLevel;
                    const levelStyle = BADGE_LEVEL_STYLES[badgeLevel];
                    const popoverKey = `${m.id.toString()}`;
                    const isDetailOpen = openDetailId === popoverKey;

                    return (
                      <div
                        key={m.id}
                        className={[
                          'relative flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all duration-200',
                          isAchieved
                            ? [
                              'cursor-pointer hover:shadow-md hover:scale-105',
                              LEVEL_TINT[badgeLevel],
                              levelStyle.borderClass,
                            ].join(' ')
                            : 'border-dashed border-border/50 bg-muted/20 opacity-50 hover:opacity-70 cursor-default',
                        ].join(' ')}
                        onClick={() => {
                          if (isAchieved) {
                            setOpenDetailId(
                              isDetailOpen ? null : popoverKey
                            );
                          }
                        }}
                        role={isAchieved ? 'button' : 'presentation'}
                        tabIndex={isAchieved ? 0 : -1}
                        onKeyDown={(e) => {
                          if (isAchieved && e.key === 'Enter') {
                            setOpenDetailId(
                              isDetailOpen ? null : popoverKey
                            );
                          }
                        }}
                        aria-label={
                          isAchieved
                            ? `${m.name} — achieved. Click for details.`
                            : `${m.name} — locked`
                        }
                        aria-pressed={isDetailOpen}
                      >
                        <MilestoneBadge
                          milestoneId={m.id}
                          size="md"
                          locked={!isAchieved}
                          animated={isAchieved}
                        />

                        <p className="text-[10px] font-semibold text-center leading-tight line-clamp-2 text-foreground">
                          {m.name}
                        </p>

                        {isAchieved && achievement ? (
                          <p className="text-[10px] text-muted-foreground text-center">
                            {format(
                              new Date(achievement.achievedAt),
                              'MMM yyyy'
                            )}
                          </p>
                        ) : (
                          <p className="text-[10px] text-muted-foreground text-center">
                            {m.threshold === 0
                              ? 'Starting'
                              : formatINR(m.threshold)}
                          </p>
                        )}

                        {/* Detail popover */}
                        {isDetailOpen && achievement && (
                          <DetailPopover
                            achievement={achievement}
                            milestoneId={m.id}
                            onClose={() => { setOpenDetailId(null); }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SlidePanel>
  );
}
