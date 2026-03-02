/**
 * SavingsRateCard.tsx
 *
 * Dashboard widget — savings rate donut/gauge with month-over-month comparison.
 */

import { ResponsiveContainer, PieChart, Pie } from 'recharts';
import { CheckCircle2, TrendingUp, Minus, AlertCircle } from 'lucide-react';
import { DashboardCard } from './DashboardCard';
import { useDashboardSummary } from '@/app/stores/dashboard.store';

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SavingsRateSkeleton() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-32 h-32 rounded-full animate-pulse bg-muted mx-auto" />
      <div className="h-4 w-40 rounded animate-pulse bg-muted mx-auto mt-3" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SavingsRateCard() {
  const { summary, isLoading } = useDashboardSummary();

  const current = summary?.currentMonth;
  const last = summary?.lastMonth;

  const rate = current?.savingsRate ?? 0;
  const lastRate = last?.savingsRate ?? 0;
  const hasIncome = (current?.income ?? 0) > 0;

  const delta = rate - lastRate;

  const savedFill = rate < 0 ? 'hsl(var(--destructive))' : 'hsl(var(--chart-4))';

  // Donut data — two segments
  const savedVal = Math.max(0, Math.min(100, rate));
  const remainingVal = 100 - savedVal;
  const chartData = [
    { name: 'saved', value: savedVal, fill: savedFill },
    { name: 'remaining', value: remainingVal, fill: 'hsl(var(--muted))' },
  ];

  // Description
  type Desc = { Icon: React.ElementType; label: string; color: string };
  const desc: Desc =
    rate >= 20
      ? {
        Icon: CheckCircle2,
        label: 'Excellent savings rate',
        color: 'text-[hsl(var(--chart-4))]',
      }
      : rate >= 10
        ? {
          Icon: TrendingUp,
          label: 'Good savings rate',
          color: 'text-primary',
        }
        : rate >= 1
          ? {
            Icon: Minus,
            label: 'Low savings rate',
            color: 'text-muted-foreground',
          }
          : {
            Icon: AlertCircle,
            label: 'Spending exceeds income',
            color: 'text-destructive',
          };

  return (
    <DashboardCard
      title="Savings Rate"
      subtitle="This month"
      isLoading={isLoading}
      skeleton={<SavingsRateSkeleton />}
    >
      <div className="flex flex-col items-center gap-3">
        {/* Donut gauge */}
        <div className="relative" style={{ width: '100%', height: 140 }}>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={64}
                startAngle={90}
                endAngle={-270}
                strokeWidth={0}
                cornerRadius={4}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label overlay */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
            aria-hidden
          >
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {hasIncome ? `${String(Math.round(rate))}%` : '—'}
            </span>
            <span className="text-xs text-muted-foreground">saved</span>
          </div>
        </div>

        {/* Rate description */}
        <div className="flex items-center justify-center gap-1.5">
          <desc.Icon className={`w-3.5 h-3.5 ${desc.color}`} aria-hidden />
          <span className={`text-xs font-medium ${desc.color}`}>{desc.label}</span>
        </div>

        {/* Month-over-month comparison */}
        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <span
            className={
              delta > 0
                ? 'text-[hsl(var(--chart-4))]'
                : delta < 0
                  ? 'text-destructive'
                  : ''
            }
          >
            {delta > 0 ? '+' : ''}
            {delta.toFixed(1)}%
          </span>
          <span>vs last month</span>
        </div>
      </div>
    </DashboardCard>
  );
}
