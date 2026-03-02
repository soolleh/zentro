import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useCurrentUser, useDerivedKey } from '@/app/stores/session.store';
import { settingsStorage } from '@/services/storage/settings.storage';
import { usePreferencesStore } from '@/app/preferences.store';
import { ROUTES } from '@/app/routes.constants';
import { LoadingSpinner } from '@/app/LoadingSpinner';

/**
 * OnboardingGuard — wraps the /onboarding route.
 *
 * - If the user has already completed onboarding, redirect to /dashboard.
 * - If not complete (or status unknown), render children via <Outlet />.
 * - While checking IndexedDB, render a loading spinner.
 *
 * Assumes this component is rendered inside ProtectedRoute (user is authenticated
 * and not locked).
 */
export function OnboardingGuard() {
  const currentUser = useCurrentUser();
  const derivedKey = useDerivedKey();

  const [status, setStatus] = useState<'checking' | 'complete' | 'incomplete'>('checking');

  useEffect(() => {
    if (!currentUser || !derivedKey) {
      setStatus('incomplete');
      return;
    }
    void settingsStorage.getSettingsByUser(currentUser.id, derivedKey).then((result) => {
      if (result.success) {
        // Always sync the preferences store from IndexedDB so ProtectedRoute
        // never has stale data that would cause a redirect loop.
        usePreferencesStore.getState().loadPreferences(result.data);
        if (result.data.onboardingCompletedAt !== null) {
          setStatus('complete');
        } else {
          setStatus('incomplete');
        }
      } else {
        setStatus('incomplete');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'checking') return <LoadingSpinner />;
  if (status === 'complete') return <Navigate to={ROUTES.DASHBOARD} replace />;
  return <Outlet />;
}
