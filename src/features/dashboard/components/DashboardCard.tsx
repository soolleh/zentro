/**
 * DashboardCard.tsx
 *
 * Base wrapper for all dashboard widget cards.
 * Provides consistent header, action link, and per-widget skeleton support.
 */

import { Link } from 'react-router-dom';

type CardAction = {
  label: string;
  href: string;
};

type DashboardCardProps = {
  title?: string;
  subtitle?: string;
  action?: CardAction;
  isLoading?: boolean;
  className?: string;
  children: React.ReactNode;
  /** Rendered in place of children while isLoading is true. */
  skeleton?: React.ReactNode;
  /** Extra content rendered after the title/subtitle row */
  titleExtra?: React.ReactNode;
};

export function DashboardCard({
  title,
  subtitle,
  action,
  isLoading,
  className,
  children,
  skeleton,
  titleExtra,
}: DashboardCardProps) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card overflow-hidden transition-shadow duration-200 hover:shadow-sm ${className ?? ''}`}
    >
      {title && (
        <div className="flex items-center justify-between px-5 pt-5 pb-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {subtitle && (
              <span className="text-xs text-muted-foreground">{subtitle}</span>
            )}
            {titleExtra}
          </div>
          {action && (
            <Link
              to={action.href}
              className="text-xs font-medium text-primary hover:underline underline-offset-4 transition-colors duration-150"
            >
              {action.label}
            </Link>
          )}
        </div>
      )}
      <div className="px-5 py-4">
        {isLoading && skeleton ? skeleton : children}
      </div>
    </div>
  );
}
