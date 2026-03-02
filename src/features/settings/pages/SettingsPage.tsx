/**
 * SettingsPage
 *
 * Two-column desktop layout (sticky sidebar nav + scrollable content).
 * On mobile: pill nav bar + single-column sections.
 *
 * An IntersectionObserver tracks which section is visible and highlights
 * the matching nav item.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Palette,
  SlidersHorizontal,
  Shield,
  PiggyBank,
  Tag,
  Bell,
  ArrowLeftRight,
  HardDrive,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { AppearanceSection } from '../sections/AppearanceSection';
import { PreferencesSection } from '../sections/PreferencesSection';
import { SecuritySection } from '../sections/SecuritySection';
import { BudgetDefaultsSection } from '../sections/BudgetDefaultsSection';
import { CategoriesSection } from '../sections/CategoriesSection';
import { NotificationsSection } from '../sections/NotificationsSection';
import { ExchangeRatesSection } from '../sections/ExchangeRatesSection';
import { DataBackupSection } from '../sections/DataBackupSection';
import { DangerZoneSection } from '../sections/DangerZoneSection';

// ---------------------------------------------------------------------------
// Nav items
// ---------------------------------------------------------------------------

type NavItem = {
  id: string;
  label: string;
  Icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'appearance', label: 'Appearance', Icon: Palette },
  { id: 'preferences', label: 'Preferences', Icon: SlidersHorizontal },
  { id: 'security', label: 'Security', Icon: Shield },
  { id: 'budget-defaults', label: 'Budget Defaults', Icon: PiggyBank },
  { id: 'categories', label: 'Categories', Icon: Tag },
  { id: 'notifications', label: 'Notifications', Icon: Bell },
  { id: 'exchange-rates', label: 'Exchange Rates', Icon: ArrowLeftRight },
  { id: 'data-backup', label: 'Data & Backup', Icon: HardDrive },
  { id: 'danger-zone', label: 'Danger Zone', Icon: TriangleAlert },
];

// ---------------------------------------------------------------------------
// Sidebar nav item
// ---------------------------------------------------------------------------

type SidebarNavItemProps = {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
};

function SidebarNavItem({ item, isActive, onClick }: SidebarNavItemProps) {
  const { Icon, label } = item;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? 'location' : undefined}
      className={[
        'flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm transition-colors text-left',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted',
        item.id === 'danger-zone' && !isActive
          ? 'hover:text-destructive hover:bg-destructive/10'
          : '',
        item.id === 'danger-zone' && isActive
          ? 'bg-destructive/10 text-destructive font-medium'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Icon
        size={16}
        aria-hidden="true"
        className={item.id === 'danger-zone' && isActive ? 'text-destructive' : ''}
      />
      <span>{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Mobile pill nav item
// ---------------------------------------------------------------------------

function PillNavItem({ item, isActive, onClick }: SidebarNavItemProps) {
  const { Icon, label } = item;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? 'location' : undefined}
      className={[
        'flex items-center gap-1.5 shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80',
        item.id === 'danger-zone' && isActive ? 'bg-destructive text-destructive-foreground' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Icon size={13} aria-hidden="true" />
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState<string>(NAV_ITEMS[0].id);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Set up IntersectionObserver to track active section
  useEffect(() => {
    const sectionEls = NAV_ITEMS.map(({ id }) => document.getElementById(id)).filter(
      Boolean
    ) as HTMLElement[];

    if (sectionEls.length === 0) return;

    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the topmost intersecting entry
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => {
            const aTop = a.boundingClientRect.top;
            const bTop = b.boundingClientRect.top;
            return aTop - bTop;
          });

        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        }
      },
      { threshold: 0.3, rootMargin: '-80px 0px -40% 0px' }
    );

    sectionEls.forEach((el) => { observerRef.current?.observe(el); });

    return () => observerRef.current?.disconnect();
  }, []);

  function scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(id);
  }

  return (
    <div className="min-h-full bg-background">
      {/* Page header */}
      <div className="border-b border-border bg-card px-4 py-5 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your preferences, security, and data.
        </p>
      </div>

      {/* Mobile pill nav */}
      <nav
        aria-label="Settings sections"
        className="lg:hidden flex gap-2 overflow-x-auto scrollbar-none pb-1 px-4 pt-4"
      >
        {NAV_ITEMS.map((item) => (
          <PillNavItem
            key={item.id}
            item={item}
            isActive={activeSection === item.id}
            onClick={() => { scrollToSection(item.id); }}
          />
        ))}
      </nav>

      {/* Desktop: two-column grid */}
      <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-8 px-4 pt-6 pb-24 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        {/* Desktop sidebar nav */}
        <aside className="hidden lg:block">
          <nav
            aria-label="Settings sections"
            className="sticky top-6 flex flex-col gap-1"
          >
            {NAV_ITEMS.map((item) => (
              <SidebarNavItem
                key={item.id}
                item={item}
                isActive={activeSection === item.id}
                onClick={() => { scrollToSection(item.id); }}
              />
            ))}
          </nav>
        </aside>

        {/* Settings content */}
        <main className="flex flex-col gap-12 mt-6 lg:mt-0 min-w-0">
          <AppearanceSection />
          <PreferencesSection />
          <SecuritySection />
          <BudgetDefaultsSection />
          <CategoriesSection />
          <NotificationsSection />
          <ExchangeRatesSection />
          <DataBackupSection />
          <DangerZoneSection />
        </main>
      </div>
    </div>
  );
}

