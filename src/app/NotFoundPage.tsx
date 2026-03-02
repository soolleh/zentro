import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes.constants';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
        <p className="text-xl text-foreground mb-2">Page not found</p>
        <p className="text-sm text-muted-foreground mb-8">
          The page you are looking for does not exist.
        </p>
        <Link
          to={ROUTES.DASHBOARD}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
