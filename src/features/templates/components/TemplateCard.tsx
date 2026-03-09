import { useState } from 'react';
import { Wallet, Tag, FileText, Play, MoreHorizontal, Edit2, Copy, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { TransactionTemplate } from '@/shared/types/template.types';
import type { UUID } from '@/shared/types/common.types';
import { useTemplateStore } from '@/app/stores/template.store';
import { useAccountStore } from '@/app/stores/account.store';
import { useCategoryStore } from '@/app/stores/category.store';
import { useSessionStore } from '@/app/stores/session.store';
import { useUIStore } from '@/app/ui.store';
import { templateStorage } from '@/services/storage/template.storage';
import { duplicateTemplate } from '@/services/templates/template.service';
import { useShallow } from 'zustand/react/shallow';

type TemplateCardProps = {
  template: TransactionTemplate;
};

const TYPE_BADGE: Record<TransactionTemplate['type'], string> = {
  Income: 'bg-[hsl(var(--chart-4)/0.1)] text-[hsl(var(--chart-4))]',
  Expense: 'bg-destructive/10 text-destructive',
  Transfer: 'bg-primary/10 text-primary',
};

function useCountLabel(n: number): string {
  if (n === 0) return 'Never used';
  if (n === 1) return 'Used once';
  return `Used ${n.toFixed(0)} times`;
}

export function TemplateCard({ template }: TemplateCardProps) {
  const openQuickUsePanel = useTemplateStore((s) => s.openQuickUsePanel);
  const openFormPanel = useTemplateStore((s) => s.openFormPanel);
  const removeTemplateFromList = useTemplateStore((s) => s.removeTemplateFromList);
  const addTemplateToList = useTemplateStore((s) => s.addTemplateToList);
  const addToast = useUIStore((s) => s.addToast);

  const accounts = useAccountStore((s) => s.accounts);
  const categories = useCategoryStore((s) => s.categories);
  const { derivedKey } = useSessionStore(useShallow((s) => ({ derivedKey: s.derivedKey })));

  const [menuOpen, setMenuOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const account = template.accountId
    ? accounts.find((a) => a.account.id === (template.accountId as UUID))
    : null;

  const category = template.categoryId
    ? categories.find((c) => c.id === (template.categoryId as UUID))
    : null;

  const firstTag = template.tagIds[0];
  const extraTagCount = template.tagIds.length - 1;

  function formatAmount(): string {
    if (template.amount === null) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: template.currency,
      minimumFractionDigits: 2,
    }).format(template.amount);
  }

  async function handleDelete() {
    if (!derivedKey) return;
    setIsDeleting(true);
    try {
      const result = await templateStorage.deleteTemplate(template.id);
      if (result.success) {
        removeTemplateFromList(template.id);
        addToast({ message: 'Template deleted.', type: 'success' });
      } else {
        addToast({ message: result.error.message, type: 'error' });
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleDuplicate() {
    const userId = useSessionStore.getState().currentUser?.id;
    if (!derivedKey || !userId) return;
    setIsDuplicating(true);
    try {
      const result = await duplicateTemplate(userId as UUID, template.id, derivedKey);
      if (result.success) {
        addTemplateToList(result.data);
        addToast({ message: `"${result.data.name}" created.`, type: 'success' });
      } else {
        addToast({ message: result.error.message, type: 'error' });
      }
    } finally {
      setIsDuplicating(false);
      setMenuOpen(false);
    }
  }

  const amountColor =
    template.type === 'Income'
      ? 'text-[hsl(var(--chart-4))]'
      : template.type === 'Expense'
        ? 'text-destructive'
        : 'text-foreground';

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => { openQuickUsePanel(template); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openQuickUsePanel(template); }}
        className="rounded-2xl border border-border bg-card overflow-hidden cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all duration-150 active:scale-[0.99] relative"
        aria-label={`Use template: ${template.name}`}
      >
        {/* Color strip */}
        <div className="h-1.5 w-full" style={{ backgroundColor: template.color }} />

        {/* Body */}
        <div className="px-4 py-4 flex flex-col gap-3">
          {/* Header row */}
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xl shrink-0" aria-hidden>{template.emoji}</span>
                <span className="text-sm font-semibold text-foreground truncate">
                  {template.name}
                </span>
              </div>
              {template.description && (
                <p className="text-xs text-muted-foreground line-clamp-1 pl-7">
                  {template.description}
                </p>
              )}
            </div>

            {/* Action menu */}
            <div className="relative shrink-0 ml-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((o) => !o);
                }}
                className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-150"
                aria-label="Template actions"
              >
                <MoreHorizontal className="w-4 h-4" aria-hidden />
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}
                  />
                  <div className="absolute right-0 top-full mt-1 z-20 min-w-[148px] rounded-xl border border-border bg-card shadow-lg py-1">
                    {[
                      { icon: Play, label: 'Use template', action: () => { setMenuOpen(false); openQuickUsePanel(template); } },
                      { icon: Edit2, label: 'Edit', action: () => { setMenuOpen(false); openFormPanel('edit', template); } },
                      { icon: Copy, label: 'Duplicate', action: () => { void handleDuplicate(); } },
                      { icon: Trash2, label: 'Delete', action: () => { setMenuOpen(false); setShowDeleteConfirm(true); }, destructive: true },
                    ].map(({ icon: Icon, label, action, destructive }) => (
                      <button
                        key={label}
                        type="button"
                        disabled={isDuplicating}
                        onClick={(e) => { e.stopPropagation(); action(); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors ${destructive
                          ? 'text-destructive hover:bg-destructive/10'
                          : 'text-foreground hover:bg-muted'
                          }`}
                      >
                        <Icon className="w-3.5 h-3.5" aria-hidden />
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Type + amount row */}
          <div className="flex items-center justify-between">
            <span className={`flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-medium ${TYPE_BADGE[template.type]}`}>
              {template.type}
            </span>
            {template.amount !== null ? (
              <span className={`text-base font-bold tabular-nums ${amountColor}`}>
                {formatAmount()}
              </span>
            ) : (
              <span className="text-muted-foreground italic text-sm">Variable amount</span>
            )}
          </div>

          {/* Details row */}
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {/* Account */}
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Wallet className="w-3 h-3 shrink-0" aria-hidden />
              {account ? (
                <span className="truncate max-w-[100px]">{account.account.name}</span>
              ) : (
                <span className="italic">Any account</span>
              )}
            </span>

            {/* Category */}
            {category && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: category.color }}
                  aria-hidden
                />
                <span className="truncate max-w-[100px]">{category.name}</span>
              </span>
            )}

            {/* Tags */}
            {firstTag && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Tag className="w-3 h-3 shrink-0" aria-hidden />
                <span>
                  tag
                  {extraTagCount > 0 && (
                    <span className="ml-0.5">+{extraTagCount}</span>
                  )}
                </span>
              </span>
            )}

            {/* Notes */}
            {template.notes && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <FileText className="w-3 h-3 shrink-0" aria-hidden />
                <span className="truncate max-w-[120px]">
                  {template.notes.slice(0, 20)}{template.notes.length > 20 ? '…' : ''}
                </span>
              </span>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <span className="text-xs text-muted-foreground">
              {useCountLabel(template.useCount)}
            </span>
            {template.lastUsedAt && (
              <span className="text-xs text-muted-foreground">
                Last used{' '}
                {formatDistanceToNow(new Date(template.lastUsedAt), { addSuffix: true })}
              </span>
            )}
          </div>

          {/* Use CTA */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openQuickUsePanel(template);
            }}
            className="w-full h-8 rounded-lg bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center gap-1.5 mt-2 hover:bg-primary/20 transition-all duration-150"
          >
            <Play className="w-3.5 h-3.5" aria-hidden />
            Use template
          </button>
        </div>
      </div>

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => { setShowDeleteConfirm(false); }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-card rounded-2xl p-6 max-w-sm w-full flex flex-col gap-4 shadow-xl"
            onClick={(e) => { e.stopPropagation(); }}
          >
            <h3 className="text-base font-semibold text-foreground">Delete template?</h3>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{template.name}</strong> will be permanently
              deleted. Transactions created from this template are not affected.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(false); }}
                className="flex-1 h-10 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => { void handleDelete(); }}
                className="flex-1 h-10 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-60"
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
