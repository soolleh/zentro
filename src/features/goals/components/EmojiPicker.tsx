// ---------------------------------------------------------------------------
// EmojiPicker
//
// Inline emoji grid — 20 suggested emojis for common goal types.
// No modal — renders as an inline expandable grid.
// ---------------------------------------------------------------------------

const SUGGESTED_EMOJIS = [
  '🎯', '🏠', '🚗', '✈️', '🎓', '💍', '👶', '🏖️', '💻', '📱',
  '🏋️', '🎸', '🐕', '🌱', '🏦', '💎', '🎮', '🛒', '🏥', '⛵',
] as const;

type EmojiPickerProps = {
  readonly value: string;
  readonly onChange: (emoji: string) => void;
};

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  return (
    <div
      className="grid gap-1 p-3 rounded-xl border border-border bg-card animate-in slide-in-from-top-2 duration-200"
      style={{ gridTemplateColumns: 'repeat(8, minmax(0, 1fr))' }}
    >
      {SUGGESTED_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => { onChange(emoji); }}
          className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center cursor-pointer transition-colors duration-100 ${value === emoji
              ? 'bg-primary/10 ring-1 ring-primary'
              : 'hover:bg-muted'
            }`}
          aria-label={`Select emoji ${emoji}`}
          aria-pressed={value === emoji}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
