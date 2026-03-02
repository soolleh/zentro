/**
 * InsightsCard.tsx
 *
 * Dashboard widget — AI-generated financial insights (runs in a Web Worker).
 */

import { Link } from 'react-router-dom';
import { Loader2, Info, AlertTriangle, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { DashboardCard } from './DashboardCard';
import { useInsights } from '@/app/stores/dashboard.store';
import type { InsightSeverity } from '@/shared/types/dashboard.types';

// ---------------------------------------------------------------------------
// Severity configuration
// ---------------------------------------------------------------------------

type SeverityConfig = {
  card: string;
  iconBg: string;
  Icon: React.ElementType;
  iconClass: string;
};

function getSeverityConfig(severity: InsightSeverity): SeverityConfig {
  switch (severity) {
    case 'warning':
      return {
        card: 'border-amber-200/60 dark:border-amber-900/30 bg-amber-50/60 dark:bg-amber-950/20',
        iconBg: 'bg-amber-100 dark:bg-amber-900/30',
        Icon: AlertTriangle,
        iconClass: 'text-amber-600',
      };
    case 'positive':
      return {
        card: 'border-[hsl(var(--chart-4)/0.25)] bg-[hsl(var(--chart-4)/0.05)]',
        iconBg: 'bg-[hsl(var(--chart-4)/0.12)]',
        Icon: Sparkles,
        iconClass: 'text-[hsl(var(--chart-4))]',
      };
    default:
      return {
        card: 'border-border bg-muted/30 hover:bg-muted/50',
        iconBg: 'bg-muted',
        Icon: Info,
        iconClass: 'text-muted-foreground',
      };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InsightsCard() {
  const { insights, isInsightsLoading } = useInsights();

  return (
    <DashboardCard title="Insights">
      {isInsightsLoading ? (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" aria-hidden />
          <span className="text-sm text-muted-foreground">Analyzing your finances…</span>
        </div>
      ) : insights.length === 0 ? (
        <div className="flex items-center gap-3 py-2">
          <CheckCircle2 className="w-5 h-5 text-[hsl(var(--chart-4))]" aria-hidden />
          <span className="text-sm text-muted-foreground">
            Everything looks good. Keep it up!
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {insights.map((insight) => {
            const cfg = getSeverityConfig(insight.severity);
            return (
              <div
                key={insight.id}
                className={`flex items-start gap-3 p-4 rounded-xl border transition-all duration-150 hover:shadow-sm cursor-pointer ${cfg.card}`}
                role="article"
                aria-label={insight.title}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.iconBg}`}
                  aria-hidden
                >
                  <cfg.Icon className={`w-4 h-4 ${cfg.iconClass}`} />
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                  {insight.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {insight.description}
                    </p>
                  )}
                  {insight.actionLabel && insight.actionRoute && (
                    <Link
                      to={insight.actionRoute}
                      className="text-xs font-medium text-primary hover:underline underline-offset-4 mt-1.5 flex items-center gap-1 w-fit"
                    >
                      {insight.actionLabel}
                      <ArrowRight className="w-3 h-3" aria-hidden />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}
