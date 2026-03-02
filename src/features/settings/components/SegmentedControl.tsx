/**
 * SegmentedControl
 *
 * An iOS-style segmented button group. The selected option is visually elevated
 * from the group background with a white card + shadow treatment.
 */

type SegmentedOption<T extends string> = {
  readonly value: T;
  readonly label: string;
  readonly icon?: React.ReactNode;
};

type SegmentedControlProps<T extends string> = {
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly options: readonly SegmentedOption<T>[];
  readonly ariaLabel?: string;
  readonly disabled?: boolean;
};

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  disabled = false,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex rounded-lg border border-border bg-muted p-0.5 gap-0.5"
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => { onChange(option.value); }}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-100',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isSelected
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            ]
              .filter(Boolean)
              .join(' ')}
            type="button"
          >
            {option.icon && (
              <span className="shrink-0" aria-hidden="true">
                {option.icon}
              </span>
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
