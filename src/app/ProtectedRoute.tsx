import { Navigate, Outlet } from 'react-router-dom';
import { useSessionStore } from '@/app/session.store';
import { ROUTES } from '@/app/routes.constants';
import { LockScreen } from '@/app/LockScreen';

export function ProtectedRoute() {
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const isLocked = useSessionStore((s) => s.isLocked);
  const refreshActivity = useSessionStore((s) => s.refreshActivity);

  refreshActivity();

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  if (isLocked) {
    return <LockScreen />;
  }

  return <Outlet />;
}
