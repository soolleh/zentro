import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { ROUTES } from '@/app/routes.constants';
import { ProtectedRoute } from '@/app/ProtectedRoute';
import { AppLayout } from '@/app/AppLayout';
import { NotFoundPage } from '@/app/NotFoundPage';
import { LoadingSpinner } from '@/app/LoadingSpinner';
import { RootRedirect } from '@/app/RootRedirect';
import { OnboardingGuard } from '@/features/onboarding/components/OnboardingGuard';

// --- Lazy page imports ---
const LoginPage = lazy(() =>
  import('@/features/auth/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazy(() =>
  import('@/features/auth/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })),
);
const OnboardingPage = lazy(() =>
  import('@/features/onboarding/pages/OnboardingPage').then((m) => ({
    default: m.OnboardingPage,
  })),
);
const DashboardPage = lazy(() =>
  import('@/features/dashboard/pages/DashboardPage').then((m) => ({
    default: m.DashboardPage,
  })),
);
const TransactionsPage = lazy(() =>
  import('@/features/transactions/pages/TransactionsPage').then((m) => ({
    default: m.TransactionsPage,
  })),
);
const NewTransactionPage = lazy(() =>
  import('@/features/transactions/pages/NewTransactionPage').then((m) => ({
    default: m.NewTransactionPage,
  })),
);
const TransactionDetailPage = lazy(() =>
  import('@/features/transactions/pages/TransactionDetailPage').then((m) => ({
    default: m.TransactionDetailPage,
  })),
);
const AccountsPage = lazy(() =>
  import('@/features/accounts/pages/AccountsPage').then((m) => ({ default: m.AccountsPage })),
);
const NewAccountPage = lazy(() =>
  import('@/features/accounts/pages/NewAccountPage').then((m) => ({
    default: m.NewAccountPage,
  })),
);
const AccountDetailPage = lazy(() =>
  import('@/features/accounts/pages/AccountDetailPage').then((m) => ({
    default: m.AccountDetailPage,
  })),
);
const BudgetsPage = lazy(() =>
  import('@/features/budgets/pages/BudgetsPage').then((m) => ({ default: m.BudgetsPage })),
);
const ReportsPage = lazy(() =>
  import('@/features/reports/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);
const GoalsPage = lazy(() =>
  import('@/features/goals/pages/GoalsPage').then((m) => ({ default: m.GoalsPage })),
);
const NewGoalPage = lazy(() =>
  import('@/features/goals/pages/NewGoalPage').then((m) => ({ default: m.NewGoalPage })),
);
const GoalDetailPage = lazy(() =>
  import('@/features/goals/pages/GoalDetailPage').then((m) => ({ default: m.GoalDetailPage })),
);
const BillsPage = lazy(() =>
  import('@/features/bills/pages/BillsPage').then((m) => ({ default: m.BillsPage })),
);
const SettingsPage = lazy(() =>
  import('@/features/settings/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);

function withSuspense(Component: React.ComponentType) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Component />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  // Root — smart redirect based on auth state
  {
    path: ROUTES.ROOT,
    element: <RootRedirect />,
  },

  // Public routes
  {
    path: ROUTES.LOGIN,
    element: withSuspense(LoginPage),
  },
  {
    path: ROUTES.REGISTER,
    element: withSuspense(RegisterPage),
  },

  // Protected routes — all require authentication
  {
    element: <ProtectedRoute />,
    children: [
      // Onboarding — guarded by OnboardingGuard (redirects to /dashboard if already done)
      {
        element: <OnboardingGuard />,
        children: [
          {
            path: ROUTES.ONBOARDING,
            element: withSuspense(OnboardingPage),
          },
        ],
      },
      // Main app — inside AppLayout
      {
        element: <AppLayout />,
        children: [
          {
            path: ROUTES.DASHBOARD,
            element: withSuspense(DashboardPage),
          },
          {
            path: ROUTES.TRANSACTIONS,
            element: withSuspense(TransactionsPage),
          },
          {
            path: ROUTES.TRANSACTIONS_NEW,
            element: withSuspense(NewTransactionPage),
          },
          {
            path: ROUTES.TRANSACTION_DETAIL,
            element: withSuspense(TransactionDetailPage),
          },
          {
            path: ROUTES.ACCOUNTS,
            element: withSuspense(AccountsPage),
          },
          {
            path: ROUTES.ACCOUNTS_NEW,
            element: withSuspense(NewAccountPage),
          },
          {
            path: ROUTES.ACCOUNT_DETAIL,
            element: withSuspense(AccountDetailPage),
          },
          {
            path: ROUTES.BUDGETS,
            element: withSuspense(BudgetsPage),
          },
          {
            path: ROUTES.REPORTS,
            element: withSuspense(ReportsPage),
          },
          {
            path: ROUTES.GOALS,
            element: withSuspense(GoalsPage),
          },
          {
            path: ROUTES.GOALS_NEW,
            element: withSuspense(NewGoalPage),
          },
          {
            path: ROUTES.GOAL_DETAIL,
            element: withSuspense(GoalDetailPage),
          },
          {
            path: ROUTES.BILLS,
            element: withSuspense(BillsPage),
          },
          {
            path: ROUTES.SETTINGS,
            element: withSuspense(SettingsPage),
          },
        ],
      },
    ],
  },

  // 404
  {
    path: ROUTES.NOT_FOUND,
    element: <NotFoundPage />,
  },
]);
