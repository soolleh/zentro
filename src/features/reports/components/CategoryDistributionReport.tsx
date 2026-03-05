/**
 * CategoryDistributionReport.tsx
 *
 * Report 3 — Category distribution donut chart with interactive list.
 */

import { useState, useCallback } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Sector,
} from 'recharts';
import type { PieSectorShapeProps } from 'recharts';
import { ReportSectionHeader } from './ReportSectionHeader';
import { useCategoryDistribution } from '@/app/stores/reports.store';
import { useBaseCurrency } from '@/app/preferences.store';
import { formatCurrency } from '@/shared/utils/currency.utils';
import type { CategoryBreakdownItem } from '@/shared/types/reports.types';

// ---------------------------------------------------------------------------
// Type toggle (Segmented control)
// ---------------------------------------------------------------------------

type TypeToggleProps = {
  value: 'expense' | 'income';
  onChange: (type: 'expense' | 'income') => void;
};

function TypeToggle({ value, onChange }: TypeToggleProps) {
  return (
    <div className="flex rounded-lg border border-border overflow-hidden">
      {(['expense', 'income'] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => { onChange(t); }}
          className={`px-3 py-1 text-xs font-medium transition-colors duration-100 ${value === t
            ? 'bg-primary text-primary-foreground'
            : 'bg-background text-muted-foreground hover:bg-muted/60'
            }`}
        >
          {t === 'expense' ? 'Expenses' : 'Income'}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Donut center label
// ---------------------------------------------------------------------------

type DonutCenterProps = {
  cx: number;
  cy: number;
  hoveredItem: CategoryBreakdownItem | null;
  total: number;
  currency: string;
};

function DonutCenter({ cx, cy, hoveredItem, total, currency }: DonutCenterProps) {
  const value = hoveredItem ? hoveredItem.amount : total;
  const label = hoveredItem ? hoveredItem.categoryName : 'Total';
  const sub = hoveredItem ? `${hoveredItem.percentage.toFixed(1)}%` : '';

  return (
    <g>
      <text
        x={cx}
        y={sub ? cy - 8 : cy - 6}
        textAnchor="middle"
        className="fill-foreground"
        style={{ fontSize: 16, fontWeight: 700 }}
      >
        {formatCurrency(value, currency)}
      </text>
      <text
        x={cx}
        y={sub ? cy + 10 : cy + 10}
        textAnchor="middle"
        className="fill-muted-foreground"
        style={{ fontSize: 11 }}
      >
        {label}
      </text>
      {sub && (
        <text
          x={cx}
          y={cy + 25}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: 11 }}
        >
          {sub}
        </text>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CategoryDistributionReport() {
  const { categoryDistribution, categoryDistributionType, setCategoryDistributionType } =
    useCategoryDistribution();
  const { baseCurrency } = useBaseCurrency();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const total = categoryDistribution.reduce((s, c) => s + c.amount, 0);
  const hoveredItem = activeIndex !== null ? (categoryDistribution[activeIndex] ?? null) : null;

  const handlePieEnter = useCallback((_: unknown, index: number) => {
    setActiveIndex(index);
  }, []);

  const handlePieLeave = useCallback(() => {
    setActiveIndex(null);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <ReportSectionHeader
        title="Spending by Category"
        right={
          <TypeToggle
            value={categoryDistributionType}
            onChange={setCategoryDistributionType}
          />
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Donut chart */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={categoryDistribution.map((cat) => ({ ...cat, fill: cat.categoryColor }))}
                dataKey="amount"
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={100}
                strokeWidth={2}
                stroke="hsl(var(--card))"
                paddingAngle={2}
                shape={(sectorProps: PieSectorShapeProps) => {
                  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, isActive } = sectorProps;
                  return (
                    <Sector
                      cx={cx}
                      cy={cy}
                      innerRadius={innerRadius}
                      outerRadius={isActive ? outerRadius + 8 : outerRadius}
                      startAngle={startAngle}
                      endAngle={endAngle}
                      fill={fill ?? 'transparent'}
                      cornerRadius={2}
                    />
                  );
                }}
                onMouseEnter={handlePieEnter}
                onMouseLeave={handlePieLeave}
              />
              {categoryDistribution.length > 0 && (
                <DonutCenter
                  cx={0}
                  cy={0}
                  hoveredItem={hoveredItem}
                  total={total}
                  currency={baseCurrency}
                />
              )}
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Category list */}
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-2">
          {categoryDistribution.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No data for selected period.
            </p>
          ) : (
            categoryDistribution.map((cat, idx) => (
              <div
                key={cat.categoryId}
                className={`rounded-lg p-2 -mx-2 transition-colors duration-100 cursor-pointer ${activeIndex === idx ? 'bg-muted/60' : 'hover:bg-muted/40'
                  }`}
                onMouseEnter={() => { setActiveIndex(idx); }}
                onMouseLeave={() => { setActiveIndex(null); }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setActiveIndex(idx === activeIndex ? null : idx);
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-muted-foreground w-4 shrink-0">
                    {idx + 1}.
                  </span>
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cat.categoryColor }}
                  />
                  <span className="text-sm font-medium text-foreground flex-1 truncate">
                    {cat.categoryName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {cat.transactionCount} txns
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-foreground w-20 text-right">
                    {formatCurrency(cat.amount, baseCurrency)}
                  </span>
                </div>
                <div className="h-1 w-full rounded-full bg-muted overflow-hidden mt-1.5 ml-7">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${String(Math.min(cat.percentage, 100))}%`,
                      backgroundColor: cat.categoryColor,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
