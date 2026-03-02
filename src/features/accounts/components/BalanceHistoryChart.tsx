/**
 * BalanceHistoryChart.tsx
 *
 * Recharts area chart showing account balance over time.
 * Handles loading, empty, and error states.
 */

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { BalanceHistoryPoint } from '@/shared/types/account.types';
import { formatCurrency } from '@/shared/utils/currency.utils';

const PERIOD_OPTIONS = [
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: '12M', months: 12 },
] as const;

type TooltipPayloadEntry = {
  value: number;
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  currency: string;
};

function CustomTooltip({ active, payload, label, currency }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const value = payload[0]?.value ?? 0;
  return (
    <div className="bg-card border border-border rounded-lg shadow-md px-3 py-2">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-foreground">{formatCurrency(value, currency)}</p>
    </div>
  );
}

function formatMonthLabel(isoDate: string): string {
  try {
    const date = new Date(`${isoDate}T00:00:00`);
    return date.toLocaleString(undefined, { month: 'short' });
  } catch {
    return isoDate;
  }
}

type BalanceHistoryChartProps = {
  readonly history: BalanceHistoryPoint[];
  readonly isLoading?: boolean;
  readonly isLiability?: boolean;
  readonly currency?: string;
  readonly selectedMonths: number;
  readonly onPeriodChange: (months: number) => void;
};

export function BalanceHistoryChart({
  history,
  isLoading = false,
  isLiability = false,
  currency = 'USD',
  selectedMonths,
  onPeriodChange,
}: BalanceHistoryChartProps) {
  const strokeColor = isLiability
    ? 'hsl(var(--destructive))'
    : 'hsl(var(--chart-4))';

  const gradientStartOpacity = isLiability ? '0.2' : '0.3';
  const gradientId = isLiability ? 'balanceGradientLiability' : 'balanceGradientAsset';

  const chartData = history.map((p) => ({
    date: formatMonthLabel(p.date),
    balance: p.balance,
  }));

  return (
    <div className="px-6 py-5 border-b border-border">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-foreground">Balance history</span>

        {/* Period selector */}
        <div className="flex items-center h-7 rounded-lg bg-muted overflow-hidden">
          {PERIOD_OPTIONS.map(({ label, months }) => (
            <button
              key={label}
              type="button"
              onClick={() => { onPeriodChange(months); }}
              className={`h-full px-2.5 text-xs font-medium transition-colors duration-150 ${selectedMonths === months
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="animate-pulse bg-muted rounded-xl h-[180px]" />
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity={gradientStartOpacity} />
                <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
              </linearGradient>
            </defs>
            <CartesianGrid
              horizontal
              vertical={false}
              stroke="hsl(var(--border))"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={<CustomTooltip currency={currency} />}
              cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke={strokeColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
