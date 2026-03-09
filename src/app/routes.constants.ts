export const ROUTES = {
  ROOT: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  ONBOARDING: '/onboarding',
  OAUTH_CALLBACK: '/oauth/callback',
  DASHBOARD: '/dashboard',
  TRANSACTIONS: '/transactions',
  TRANSACTIONS_NEW: '/transactions/new',
  TRANSACTION_DETAIL: '/transactions/:id',
  ACCOUNTS: '/accounts',
  ACCOUNTS_NEW: '/accounts/new',
  ACCOUNT_DETAIL: '/accounts/:id',
  BUDGETS: '/budgets',
  REPORTS: '/reports',
  GOALS: '/goals',
  GOALS_NEW: '/goals/new',
  GOAL_DETAIL: '/goals/:id',
  BILLS: '/bills',
  SETTINGS: '/settings',
  NOT_FOUND: '*',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
