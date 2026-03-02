import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useIsAuthenticated, useIsLocked } from '@/app/stores/session.store';
import { usePreferencesStore } from '@/app/preferences.store';
import { ROUTES } from '@/app/routes.constants';
import { LockScreen } from '@/app/LockScreen';

export function ProtectedRoute() {
  const isAuthenticated = useIsAuthenticated();
  const isLocked = useIsLocked();
  const { isLoaded, onboardingCompletedAt } = usePreferencesStore(
    useShallow((s) => ({
      isLoaded: s.isLoaded,
      onboardingCompletedAt: s.onboardingCompletedAt,
    }))
  );
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  if (isLocked) {
    return <LockScreen />;
  }

  // Redirect to onboarding if preferences are loaded and onboarding is not complete.
  // Skip this check when already on /onboarding (OnboardingGuard handles the other direction).
  if (isLoaded && onboardingCompletedAt === null && !location.pathname.startsWith(ROUTES.ONBOARDING)) {
    return <Navigate to={ROUTES.ONBOARDING} replace />;
  }

  return <Outlet />;
}
