import { useEffect, useState, useMemo } from 'react';
import { Plus, LayoutTemplate } from 'lucide-react';
import type { TransactionType } from '@/shared/types/transaction.types';
import { useTemplateStore, useTemplates, useTemplatePanel } from '@/app/stores/template.store';
import { useCurrentUser } from '@/app/session.store';
import { TemplateCard } from '../components/TemplateCard';
import { QuickUsePanel } from '../components/QuickUsePanel';
import { TemplateForm } from '../components/TemplateForm';

type FilterType = TransactionType | 'All';

const CHIPS: { label: string; value: FilterType }[] = [
  { label: 'All', value: 'All' },
  { label: 'Income', value: 'Income' },
  { label: 'Expense', value: 'Expense' },
  { label: 'Transfer', value: 'Transfer' },
];

const CHIP_ACTIVE: Record<FilterType, string> = {
  All: 'bg-primary/10 text-primary border-primary/30',
  Income: 'bg-[hsl(var(--chart-4)/0.12)] text-[hsl(var(--chart-4))] border-[hsl(var(--chart-4)/0.4)]',
  Expense: 'bg-destructive/10 text-destructive border-destructive/30',
  Transfer: 'bg-primary/10 text-primary border-primary/30',
};

export function TemplatesPage() {
  const currentUser = useCurrentUser();
  const { templates, isLoading } = useTemplates();
  const { openFormPanel } = useTemplatePanel();
  const loadTemplates = useTemplateStore((s) => s.loadTemplates);
  const isQuickUsePanelOpen = useTemplateStore((s) => s.isQuickUsePanelOpen);
  const isFormPanelOpen = useTemplateStore((s) => s.isFormPanelOpen);

  const [filter, setFilter] = useState<FilterType>('All');

  useEffect(() => {
    if (currentUser) {
      void loadTemplates(currentUser.id);
    }
  }, [currentUser, loadTemplates]);

  const filtered = useMemo(
    () =>
      filter === 'All' ? templates : templates.filter((t) => t.type === filter),
    [templates, filter],
  );

  return (
    <>
      <div className="px-4 pt-6 pb-24 sm:px-6 lg:px-8 lg:py-8 lg:max-w-3xl lg:mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Templates</h1>
          <button
            type="button"
            onClick={() => { openFormPanel('add'); }}
            className="hidden sm:flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-150"
          >
            <Plus className="w-4 h-4" aria-hidden />
            New template
          </button>
        </div>

        {/* Filter strip */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {CHIPS.map(({ label, value }) => {
            const isActive = filter === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => { setFilter(value); }}
                className={`h-7 px-3 rounded-full border text-xs font-medium cursor-pointer transition-all duration-150 ${isActive
                    ? CHIP_ACTIVE[value]
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                  }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <span className="text-4xl" aria-hidden>📋</span>
            <p className="text-base font-semibold text-foreground">
              {filter === 'All' ? 'No templates yet' : `No ${filter} templates`}
            </p>
            <p className="text-sm text-muted-foreground max-w-[260px]">
              {filter === 'All'
                ? 'Save any transaction as a template to replay it quickly later.'
                : `You haven't created any ${filter.toLowerCase()} templates yet.`}
            </p>
            {filter === 'All' && (
              <button
                type="button"
                onClick={() => { openFormPanel('add'); }}
                className="mt-1 flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-150"
              >
                <LayoutTemplate className="w-4 h-4" aria-hidden />
                Create template
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filtered.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>
        )}
      </div>

      {/* Mobile FAB */}
      <button
        type="button"
        onClick={() => { openFormPanel('add'); }}
        className="sm:hidden fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all duration-150 active:scale-95"
        aria-label="New template"
      >
        <Plus className="w-6 h-6" aria-hidden />
      </button>

      {/* Panels */}
      <QuickUsePanel open={isQuickUsePanelOpen} />
      <TemplateForm open={isFormPanelOpen} />
    </>
  );
}
