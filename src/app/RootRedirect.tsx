import { Navigate } from 'react-router-dom';
import { useIsAuthenticated } from '@/app/stores/session.store';
import { ROUTES } from '@/app/routes.constants';

/**
 * Redirects the root path to dashboard if authenticated, otherwise to login.
 */
export function RootRedirect() {
  const isAuthenticated = useIsAuthenticated();
  return <Navigate to={isAuthenticated ? ROUTES.DASHBOARD : ROUTES.LOGIN} replace />;
}
