/**
 * ReportsPage.tsx
 *
 * Main Reports & Analytics page.
 * Composes the global filter bar and all six report section components.
 * Provides a CSV export action that downloads a report file.
 */

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Download, Loader2 } from 'lucide-react';

import { useReportData } from '../hooks/useReportData';
import { useReportFilters } from '@/app/stores/reports.store';
import { useDerivedKey, useCurrentUser } from '@/app/stores/session.store';
import { exportReportCSV } from '@/services/reports/reports.service';

import { GlobalFilterBar } from '../components/GlobalFilterBar';
import { MonthlyBreakdownReport } from '../components/MonthlyBreakdownReport';
import { YearlyOverviewReport } from '../components/YearlyOverviewReport';
import { CategoryDistributionReport } from '../components/CategoryDistributionReport';
import { IncomeTrendReport } from '../components/IncomeTrendReport';
import { NetWorthGrowthReport } from '../components/NetWorthGrowthReport';
import { SavingsRateTrendReport } from '../components/SavingsRateTrendReport';
import { AnomalyDetectionReport } from '../components/AnomalyDetectionReport';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SECTION_DIVIDER = <div className="h-px bg-border/50" aria-hidden="true" />;

function formatDateRange(from: string, to: string): string {
  try {
    return `${format(parseISO(from), 'MMM d, yyyy')} – ${format(parseISO(to), 'MMM d, yyyy')}`;
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// ReportsPage
// ---------------------------------------------------------------------------

export function ReportsPage() {
  useReportData();

  const { filters, setFilters } = useReportFilters();
  const derivedKey = useDerivedKey();
  const currentUser = useCurrentUser();

  const [isExporting, setIsExporting] = useState(false);

  const handleExportCSV = async () => {
    if (!currentUser || !derivedKey) return;
    setIsExporting(true);
    try {
      const result = await exportReportCSV(currentUser.id, derivedKey, filters);
      if (result.success) {
        const blob = new Blob([result.data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const fileName = `zentro-report-${filters.dateFrom.substring(0, 10)}-to-${filters.dateTo.substring(0, 10)}.csv`;
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const dateRangeLabel = formatDateRange(filters.dateFrom, filters.dateTo);

  return (
    <div className="flex flex-col min-h-0">
      {/* Sticky filter bar */}
      <GlobalFilterBar filters={filters} onFiltersChange={setFilters} />

      {/* Page content */}
      <div className="px-4 pt-6 pb-24 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <div className="max-w-5xl mx-auto flex flex-col gap-8">
          {/* Page header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-bold text-foreground">Reports</h1>
              {dateRangeLabel && (
                <p className="text-sm text-muted-foreground">{dateRangeLabel}</p>
              )}
            </div>
            <button
              type="button"
              disabled={isExporting || !currentUser || !derivedKey}
              onClick={() => { void handleExportCSV(); }}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Export report as CSV"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isExporting ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>

          {/* Section: Monthly Breakdown */}
          <div className="flex flex-col gap-4 scroll-mt-20">
            <MonthlyBreakdownReport />
          </div>

          {SECTION_DIVIDER}

          {/* Section: Yearly Overview */}
          <div className="flex flex-col gap-4 scroll-mt-20">
            <YearlyOverviewReport />
          </div>

          {SECTION_DIVIDER}

          {/* Section: Category Distribution */}
          <div className="flex flex-col gap-4 scroll-mt-20">
            <CategoryDistributionReport />
          </div>

          {SECTION_DIVIDER}

          {/* Section: Income vs Expense Trend */}
          <div className="flex flex-col gap-4 scroll-mt-20">
            <IncomeTrendReport />
          </div>

          {SECTION_DIVIDER}

          {/* Section: Net Worth Growth */}
          <div className="flex flex-col gap-4 scroll-mt-20">
            <NetWorthGrowthReport />
          </div>

          {SECTION_DIVIDER}

          {/* Section: Savings Rate Trend */}
          <div className="flex flex-col gap-4 scroll-mt-20">
            <SavingsRateTrendReport />
          </div>

          {SECTION_DIVIDER}

          {/* Section: Anomaly Detection */}
          <div className="flex flex-col gap-4 scroll-mt-20">
            <AnomalyDetectionReport />
          </div>
        </div>
      </div>
    </div>
  );
}
