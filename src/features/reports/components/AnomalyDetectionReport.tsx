/**
 * AnomalyDetectionReport.tsx
 *
 * Anomaly detection callout section.
 * Shows unusual spending flags based on 3-month rolling average.
 */

import { useNavigate } from 'react-router-dom';
import { Loader2, TrendingUp, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ReportSectionHeader } from './ReportSectionHeader';
import { useAnomalies } from '@/app/stores/reports.store';
import { useBaseCurrency } from '@/app/preferences.store';
import { formatCurrency } from '@/shared/utils/currency.utils';
import type { AnomalyFlag } from '@/shared/types/reports.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM d, yyyy');
  } catch {
    return iso.substring(0, 10);
  }
}

// ---------------------------------------------------------------------------
// Single anomaly card
// ---------------------------------------------------------------------------

type AnomalyCardProps = {
  flag: AnomalyFlag;
  currency: string;
  onNavigate: (transactionId: string) => void;
};

function AnomalyCard({ flag, currency, onNavigate }: AnomalyCardProps) {
  const isHigh = flag.severity === 'high';

  return (
    <div
      className={`rounded-xl border p-4 flex items-start gap-4 ${isHigh
          ? 'border-destructive/30 bg-destructive/5'
          : 'border-amber-200/60 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20'
        }`}
    >
      {/* Severity icon */}
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isHigh ? 'bg-destructive/10' : 'bg-amber-100 dark:bg-amber-900/30'
          }`}
      >
        {isHigh ? (
          <AlertTriangle className="w-4 h-4 text-destructive" />
        ) : (
          <TrendingUp className="w-4 h-4 text-amber-600" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">{flag.categoryName}</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full ${isHigh
                ? 'bg-destructive/10 text-destructive'
                : 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
              }`}
          >
            {isHigh ? 'Very Unusual' : 'Unusual'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(flag.date)}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatCurrency(flag.amount, currency)} — {flag.deviationPercent.toFixed(0)}% above your
          3-month average of {formatCurrency(flag.rollingAverage, currency)}
        </p>
      </div>

      {/* Right: amount + link */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-base font-bold tabular-nums text-foreground">
          {formatCurrency(flag.amount, currency)}
        </span>
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-primary hover:underline underline-offset-2"
          onClick={() => { onNavigate(flag.transactionId); }}
          aria-label="View transaction"
        >
          <ExternalLink className="w-3 h-3" />
          View
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AnomalyDetectionReport() {
  const { anomalies, isAnomalyLoading } = useAnomalies();
  const { baseCurrency } = useBaseCurrency();
  const navigate = useNavigate();

  const handleNavigate = (transactionId: string) => {
    void navigate(`/transactions?highlight=${transactionId}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <ReportSectionHeader
        title={
          <span className="flex items-center gap-2">
            Unusual Spending
            {anomalies.length > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                {anomalies.length} detected
              </span>
            )}
          </span>
        }
        right={
          <span className="text-xs text-muted-foreground">Based on 3-month rolling average</span>
        }
      />

      {isAnomalyLoading && (
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Analyzing spending patterns…</span>
        </div>
      )}

      {!isAnomalyLoading && anomalies.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-[hsl(var(--chart-4))] shrink-0" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">
              No unusual spending detected
            </span>
            <span className="text-xs text-muted-foreground">
              Your spending patterns look consistent with the past 3 months.
            </span>
          </div>
        </div>
      )}

      {!isAnomalyLoading && anomalies.length > 0 && (
        <div className="flex flex-col gap-3">
          {anomalies.map((flag) => (
            <AnomalyCard
              key={flag.transactionId}
              flag={flag}
              currency={baseCurrency}
              onNavigate={handleNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
