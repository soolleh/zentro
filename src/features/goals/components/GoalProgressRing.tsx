import { PieChart, Pie } from 'recharts';
import type { GoalMilestone } from '@/shared/types/goal.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RingSize = 'sm' | 'md' | 'lg';

type GoalProgressRingProps = {
  readonly percentComplete: number;
  readonly goalColor: string;
  readonly milestones: GoalMilestone[];
  readonly size: RingSize;
};

// ---------------------------------------------------------------------------
// Ring configuration per size
// ---------------------------------------------------------------------------

type RingConfig = {
  containerSize: number;
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  midRadius: number;
  dotRadius: number;
  tickStyle: 'dots' | 'ticksAndDots'; // sm = dots only, md/lg = line ticks + circle for reached
  textSizeClass: string;
};

const RING_CONFIG: Record<RingSize, RingConfig> = {
  sm: {
    containerSize: 44,
    cx: 22,
    cy: 22,
    innerRadius: 17,
    outerRadius: 20,
    midRadius: 18.5,
    dotRadius: 2,
    tickStyle: 'dots',
    textSizeClass: 'text-[10px]',
  },
  md: {
    containerSize: 120,
    cx: 60,
    cy: 60,
    innerRadius: 45,
    outerRadius: 54,
    midRadius: 49.5,
    dotRadius: 4,
    tickStyle: 'ticksAndDots',
    textSizeClass: 'text-lg',
  },
  lg: {
    containerSize: 160,
    cx: 80,
    cy: 80,
    innerRadius: 60,
    outerRadius: 72,
    midRadius: 66,
    dotRadius: 4,
    tickStyle: 'ticksAndDots',
    textSizeClass: 'text-3xl',
  },
};

const MILESTONE_PERCENTS: ReadonlyArray<25 | 50 | 75> = [25, 50, 75];

// ---------------------------------------------------------------------------
// SVG coordinate helper
// In Recharts: startAngle=90 (top, 12 o'clock), going clockwise.
// angle = 90 - (percent/100 * 360) gives Recharts math angle.
// SVG coords: x = cx + r*cos(rad), y = cy - r*sin(rad)
// ---------------------------------------------------------------------------

function toSVGCoords(
  cx: number,
  cy: number,
  r: number,
  percent: number
): { x: number; y: number } {
  const angleDeg = 90 - (percent / 100) * 360;
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy - r * Math.sin(rad),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GoalProgressRing({
  percentComplete,
  goalColor,
  milestones,
  size,
}: GoalProgressRingProps) {
  const config = RING_CONFIG[size];
  const pct = Math.min(100, Math.max(0, percentComplete));

  const progressData = [
    { value: pct, fill: goalColor },
    { value: Math.max(0, 100 - pct), fill: 'transparent' },
  ];

  const milestoneMap = new Map(milestones.map((m) => [m.percent, m]));

  return (
    <div
      className="relative shrink-0"
      style={{ width: config.containerSize, height: config.containerSize }}
    >
      {/* Recharts ring */}
      <PieChart width={config.containerSize} height={config.containerSize}>
        {/* Background track */}
        <Pie
          data={[{ value: 100 }]}
          dataKey="value"
          cx={config.cx}
          cy={config.cy}
          innerRadius={config.innerRadius}
          outerRadius={config.outerRadius}
          startAngle={90}
          endAngle={-270}
          fill="hsl(var(--muted))"
          strokeWidth={0}
          isAnimationActive={false}
        />
        {/* Progress fill */}
        <Pie
          data={progressData}
          dataKey="value"
          cx={config.cx}
          cy={config.cy}
          innerRadius={config.innerRadius}
          outerRadius={config.outerRadius}
          startAngle={90}
          endAngle={-270}
          strokeWidth={0}
          cornerRadius={4}
          isAnimationActive={false}
        />
      </PieChart>

      {/* Milestone SVG overlay */}
      <svg
        className="absolute top-0 left-0 pointer-events-none"
        width={config.containerSize}
        height={config.containerSize}
      >
        {MILESTONE_PERCENTS.map((percent) => {
          const milestone = milestoneMap.get(percent);
          const pos = toSVGCoords(config.cx, config.cy, config.midRadius, percent);
          const isReached = milestone?.isReached ?? false;

          if (config.tickStyle === 'dots') {
            // Small/sm size: always dots
            return (
              <circle
                key={percent}
                cx={pos.x}
                cy={pos.y}
                r={config.dotRadius}
                fill={isReached ? goalColor : 'hsl(var(--background))'}
              />
            );
          }

          // md/lg: line tick (unreached) or circle (reached)
          if (isReached) {
            return (
              <circle
                key={percent}
                cx={pos.x}
                cy={pos.y}
                r={config.dotRadius}
                fill={goalColor}
              />
            );
          }

          // Radial line from inner edge to outer edge
          const inner = toSVGCoords(config.cx, config.cy, config.innerRadius, percent);
          const outer = toSVGCoords(config.cx, config.cy, config.outerRadius, percent);
          return (
            <line
              key={percent}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="hsl(var(--background))"
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {/* Center text overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-0">
        <span className={`font-bold text-foreground leading-none ${config.textSizeClass}`}>
          {pct}%
        </span>
        {size !== 'sm' && (
          <span className="text-[10px] text-muted-foreground leading-none mt-0.5">complete</span>
        )}
      </div>
    </div>
  );
}
