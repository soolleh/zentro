/**
 * useDashboardData.ts
 *
 * Triggers initial dashboard data load on mount and exposes re-trigger function.
 */

import { useEffect } from 'react';
import { useCurrentUser } from '@/app/session.store';
import { useDashboardStore } from '@/app/stores/dashboard.store';

export function useDashboardData(): void {
  const currentUser = useCurrentUser();
  const loadDashboard = useDashboardStore((s) => s.loadDashboard);
  const loadInsights = useDashboardStore((s) => s.loadInsights);

  useEffect(() => {
    if (!currentUser) return;

    void loadDashboard(currentUser.id).then(() => {
      void loadInsights(currentUser.id);
    });
  }, [currentUser, loadDashboard, loadInsights]);
}
