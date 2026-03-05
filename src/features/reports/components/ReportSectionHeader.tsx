/**
 * ReportSectionHeader.tsx
 *
 * Consistent section header for all report sections.
 */

import type { ReactNode } from 'react';

type ReportSectionHeaderProps = {
  title: ReactNode;
  right?: ReactNode;
};

export function ReportSectionHeader({ title, right }: ReportSectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}
