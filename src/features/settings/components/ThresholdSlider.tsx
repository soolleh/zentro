/**
 * ThresholdSlider
 *
 * A styled range input for selecting a percentage threshold (50–100, step 5).
 * Uses a CSS custom property (--fill-pct) to colour the filled track portion.
 */

type ThresholdSliderProps = {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly id?: string;
  readonly disabled?: boolean;
};

const THRESHOLD_MIN = 50;
const THRESHOLD_MAX = 100;
const THRESHOLD_STEP = 5;

export function ThresholdSlider({
  value,
  onChange,
  min = THRESHOLD_MIN,
  max = THRESHOLD_MAX,
  step = THRESHOLD_STEP,
  id,
  disabled = false,
}: ThresholdSliderProps) {
  const fillPct = ((value - min) / (max - min)) * 100;

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Value badge */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Alert when budget is</span>
        <span
          className="text-sm font-semibold text-primary tabular-nums"
          aria-live="polite"
          aria-atomic="true"
        >
          {value}% used
        </span>
      </div>

      {/* Slider */}
      <div className="relative flex items-center h-5">
        {/* Track background */}
        <div className="absolute inset-y-0 flex items-center w-full pointer-events-none">
          <div className="relative w-full h-1.5 rounded-full overflow-hidden bg-muted">
            {/* Filled portion */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-100"
              style={{ width: `${fillPct.toString()}%` }}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Native range input (transparent, sits on top) */}
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => { onChange(Number(e.target.value)); }}
          className={[
            'relative w-full appearance-none bg-transparent cursor-pointer',
            'focus-visible:outline-none',
            // Thumb styling via Tailwind arbitrary variants
            '[&::-webkit-slider-thumb]:appearance-none',
            '[&::-webkit-slider-thumb]:w-4',
            '[&::-webkit-slider-thumb]:h-4',
            '[&::-webkit-slider-thumb]:rounded-full',
            '[&::-webkit-slider-thumb]:bg-primary',
            '[&::-webkit-slider-thumb]:border-2',
            '[&::-webkit-slider-thumb]:border-card',
            '[&::-webkit-slider-thumb]:shadow-sm',
            '[&::-webkit-slider-thumb]:transition-transform',
            '[&::-webkit-slider-thumb]:duration-100',
            '[&::-webkit-slider-thumb:active]:scale-110',
            '[&::-moz-range-thumb]:w-4',
            '[&::-moz-range-thumb]:h-4',
            '[&::-moz-range-thumb]:rounded-full',
            '[&::-moz-range-thumb]:bg-primary',
            '[&::-moz-range-thumb]:border-2',
            '[&::-moz-range-thumb]:border-card',
            '[&::-moz-range-thumb]:shadow-sm',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={`${value.toString()}%`}
        />
      </div>

      {/* Tick labels */}
      <div className="flex justify-between text-[10px] text-muted-foreground px-0.5 select-none">
        {Array.from({ length: (max - min) / (step * 5) + 1 }, (_, i) => {
          const tick = min + i * step * 5;
          return (
            <span key={tick} className="tabular-nums">
              {tick.toString()}%
            </span>
          );
        })}
      </div>
    </div>
  );
}
