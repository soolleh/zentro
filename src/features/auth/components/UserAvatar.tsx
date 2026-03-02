/**
 * UserAvatar
 *
 * Displays the first letter of the user's display name inside a tinted circle.
 * Colour is determined by charCodeAt(0) % 5 for consistent per-user colour.
 * Supports optional selected state (ring) and onClick for the user switcher.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AVATAR_SIZES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-12 w-12 text-base',
  lg: 'h-16 w-16 text-2xl',
} as const;

/**
 * Tinted colour pairs — bg at 15% opacity + full-strength text.
 * Index is derived from displayName.charCodeAt(0) % 5.
 */
const PALETTE_CLASSES = [
  { bg: 'bg-[hsl(var(--chart-1)/0.15)]', text: 'text-[hsl(var(--chart-1))]' },
  { bg: 'bg-[hsl(var(--chart-2)/0.15)]', text: 'text-[hsl(var(--chart-2))]' },
  { bg: 'bg-[hsl(var(--chart-3)/0.15)]', text: 'text-[hsl(var(--chart-3))]' },
  { bg: 'bg-[hsl(var(--chart-4)/0.15)]', text: 'text-[hsl(var(--chart-4))]' },
  { bg: 'bg-[hsl(var(--chart-5)/0.15)]', text: 'text-[hsl(var(--chart-5))]' },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pickPaletteIndex(displayName: string): number {
  if (displayName.length === 0) return 0;
  return displayName.charCodeAt(0) % PALETTE_CLASSES.length;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type UserAvatarProps = {
  readonly displayName: string;
  readonly size?: keyof typeof AVATAR_SIZES;
  readonly selected?: boolean;
  readonly onClick?: () => void;
};

export function UserAvatar({ displayName, size = 'md', selected, onClick }: UserAvatarProps) {
  const initial = displayName.charAt(0).toUpperCase() || '?';
  const { bg, text } = PALETTE_CLASSES[pickPaletteIndex(displayName)];

  return (
    <div
      className={[
        AVATAR_SIZES[size],
        bg,
        text,
        'rounded-full flex items-center justify-center font-semibold select-none shrink-0',
        'transition-all duration-150',
        selected
          ? 'ring-2 ring-primary ring-offset-2'
          : onClick
            ? 'hover:ring-2 hover:ring-border hover:ring-offset-2'
            : '',
        onClick ? 'cursor-pointer' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role={onClick ? 'button' : 'img'}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`Avatar for ${displayName}`}
      aria-pressed={onClick ? selected : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }
          : undefined
      }
    >
      {initial}
    </div>
  );
}
