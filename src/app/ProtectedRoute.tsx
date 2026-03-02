import { Navigate, Outlet } from 'react-router-dom';
import { useIsAuthenticated, useIsLocked } from '@/app/stores/session.store';
import { ROUTES } from '@/app/routes.constants';
import { LockScreen } from '@/app/LockScreen';

export function ProtectedRoute() {
  const isAuthenticated = useIsAuthenticated();
  const isLocked = useIsLocked();

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  if (isLocked) {
    return <LockScreen />;
  }

  return <Outlet />;
}
