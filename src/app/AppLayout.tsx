import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Target,
  PiggyBank,
  BarChart3,
  CalendarClock,
  Settings,
  Lock,
  Plus,
} from 'lucide-react';
import { ROUTES } from '@/app/routes.constants';
import { useSessionStore } from '@/app/session.store';
import { useUIStore } from '@/app/ui.store';
import { UpdateBanner } from '@/features/pwa/components/UpdateBanner';
import { InstallPrompt } from '@/features/pwa/components/InstallPrompt';
import { NotificationPermissionPrompt } from '@/features/pwa/components/NotificationPermissionPrompt';
import { OfflineIndicator } from '@/features/pwa/components/OfflineIndicator';

const NAV_ITEMS = [
  { label: 'Dashboard', to: ROUTES.DASHBOARD, icon: LayoutDashboard },
  { label: 'Transactions', to: ROUTES.TRANSACTIONS, icon: ArrowLeftRight },
  { label: 'Accounts', to: ROUTES.ACCOUNTS, icon: Wallet },
  { label: 'Budgets', to: ROUTES.BUDGETS, icon: Target },
  { label: 'Reports', to: ROUTES.REPORTS, icon: BarChart3 },
  { label: 'Goals', to: ROUTES.GOALS, icon: PiggyBank },
  { label: 'Bills', to: ROUTES.BILLS, icon: CalendarClock },
  { label: 'Settings', to: ROUTES.SETTINGS, icon: Settings },
] as const;

// Auth/onboarding routes where the + button should NOT appear
const HIDDEN_ROUTES = ['/login', '/register', '/onboarding'];

export function AppLayout() {
  const lock = useSessionStore((s) => s.lock);
  const currentUser = useSessionStore((s) => s.currentUser);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const navigate = useNavigate();
  const location = useLocation();

  const displayInitial = currentUser?.displayName.charAt(0).toUpperCase() ?? 'Z';
  const showPlusButton = !HIDDEN_ROUTES.some((r) => location.pathname.startsWith(r));

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* PWA: fixed banners — rendered outside the layout flow */}
      <UpdateBanner />
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col w-60 shrink-0 border-r border-border bg-card transition-all duration-200 ${sidebarOpen ? 'w-60' : 'w-0 overflow-hidden'
          }`}
        aria-label="Primary navigation"
      >
        <div className="flex items-center h-14 px-4 border-b border-border shrink-0">
          <span className="text-base font-semibold text-foreground tracking-tight">Zentro</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          <ul className="space-y-1">
            {NAV_ITEMS.map(({ label, to, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground hover:bg-muted'
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between h-14 px-4 border-b border-border bg-card shrink-0">
          <span className="text-base font-semibold text-foreground lg:hidden">Zentro</span>
          <div className="flex items-center gap-2 ml-auto">
            <OfflineIndicator />
            {/* Desktop quick-add button — only on lg+ and non-auth routes */}
            {showPlusButton && (
              <button
                type="button"
                onClick={() => { void navigate('/transactions/new'); }}
                className="hidden lg:flex w-8 h-8 rounded-lg border border-border bg-background items-center justify-center hover:bg-muted/60 transition-all duration-150"
                aria-label="Add transaction"
                title="Add transaction"
              >
                <Plus className="h-4 w-4 text-muted-foreground" aria-hidden />
              </button>
            )}
            <div
              className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold"
              aria-label={`User: ${currentUser?.displayName ?? 'Unknown'}`}
            >
              {displayInitial}
            </div>
            <button
              type="button"
              onClick={lock}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Lock session"
              title="Lock session"
            >
              <Lock className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation */}
        <nav
          className="lg:hidden flex items-center justify-around h-14 border-t border-border bg-card shrink-0"
          aria-label="Mobile navigation"
        >
          {NAV_ITEMS.slice(0, 5).map(({ label, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 py-1 text-xs font-medium transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'
                }`
              }
              aria-label={label}
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span className="text-[10px]">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
      <InstallPrompt />
      <NotificationPermissionPrompt />
    </div>
  );
}
