/**
 * MilestoneBadge.tsx
 *
 * Reusable badge component used throughout the milestone gamification system.
 * Adapts visually based on milestone config (badge level, emoji, stage).
 */

import {
  getMilestoneById,
  BADGE_LEVEL_STYLES,
  type BadgeLevel,
} from '@/services/milestones/milestone-config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BadgeSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

type MilestoneBadgeProps = {
  milestoneId: number;
  size?: BadgeSize;
  locked?: boolean;
  showName?: boolean;
  animated?: boolean;
};

// ---------------------------------------------------------------------------
// Size maps
// ---------------------------------------------------------------------------

const SIZE_OUTER: Record<BadgeSize, string> = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-12 h-12 text-xl',
  lg: 'w-16 h-16 text-3xl',
  xl: 'w-24 h-24 text-5xl',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MilestoneBadge({
  milestoneId,
  size = 'md',
  locked = false,
  showName = false,
  animated = false,
}: MilestoneBadgeProps) {
  const config = getMilestoneById(milestoneId);
  const badgeLevel = config.badgeLevel as BadgeLevel;
  const style = BADGE_LEVEL_STYLES[badgeLevel];

  // Build inline style
  const inlineStyle: React.CSSProperties = {};

  if (!locked) {
    // Parse backgroundStyle string into an object property
    if (style.backgroundStyle) {
      // Style string is in the form "background: gradient(...)"
      // Extract the value after the colon
      const colonIdx = style.backgroundStyle.indexOf(':');
      if (colonIdx !== -1) {
        inlineStyle.background = style.backgroundStyle
          .slice(colonIdx + 1)
          .trim();
      }
    }
    if (style.glowClass && style.glowClass !== 'none') {
      inlineStyle.boxShadow = animated
        ? undefined // animation handles glow
        : style.glowClass;
    }
  }

  const sizeClass = SIZE_OUTER[size];

  return (
    <div className="flex flex-col items-center">
      <div
        className={[
          sizeClass,
          'rounded-full flex items-center justify-center transition-all duration-300',
          locked ? 'grayscale opacity-40' : style.containerClass,
          locked ? '' : style.borderClass,
          animated && !locked ? 'milestone-badge-breathe' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={inlineStyle}
        aria-label={`${config.name} badge${locked ? ' (locked)' : ''}`}
        role="img"
      >
        <span aria-hidden="true">{config.emoji}</span>
      </div>

      {showName && (
        <span
          className={[
            'text-[10px] font-semibold text-center mt-1 leading-tight',
            locked ? 'text-muted-foreground' : style.textClass,
          ].join(' ')}
        >
          {config.name}
        </span>
      )}
    </div>
  );
}
