/**
 * useReportData.ts
 *
 * Initialises all report data for the current session user.
 * Must be invoked once at the top level of ReportsPage.
 */

import { useEffect } from 'react';
import { useCurrentUser } from '@/app/stores/session.store';
import { useReportsStore } from '@/app/stores/reports.store';

export function useReportData(): void {
  const currentUser = useCurrentUser();
  const loadAllReports = useReportsStore((s) => s.loadAllReports);

  useEffect(() => {
    if (!currentUser) return;
    void loadAllReports(currentUser.id);
    // Run once on mount — filters changes are triggered from within the store
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);
}
