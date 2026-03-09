/**
 * CategoriesSection
 *
 * Manages expense and income categories with one level of sub-category nesting:
 * - Top-level parent rows with expand/collapse for children
 * - Inline "Add sub-category" form per parent
 * - Drag-and-drop reordering of top-level categories (@dnd-kit)
 * - Inline create/edit form for custom categories
 * - Delete with children check (blocks delete if children exist)
 */

import { useEffect, useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  Lock,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
} from 'lucide-react';
import { SettingsSection } from '../components/SettingsSection';
import { SettingsCard } from '../components/SettingsCard';
import { SegmentedControl } from '../components/SegmentedControl';
import { categoryStorage } from '@/services/storage/category.storage';
import { buildCategoryTree, createSubcategory } from '@/services/categories/category.service';
import { generateUUID } from '@/services/crypto/crypto.utils';
import { useSessionStore } from '@/app/stores/session.store';
import { useUIStore } from '@/app/ui.store';
import type { Category, CategoryWithChildren } from '@/shared/types/category.types';
import type { UUID, ISODateString } from '@/shared/types/common.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLOR_PALETTE = [
  '#0891b2', '#6366f1', '#f59e0b', '#10b981', '#ec4899',
  '#ef4444', '#8b5cf6', '#f97316', '#14b8a6', '#84cc16',
  '#06b6d4', '#3b82f6', '#a855f7', '#d97706', '#059669',
];

type FilterTab = 'all' | 'system' | 'custom';

const FILTER_OPTIONS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'system', label: 'System' },
  { value: 'custom', label: 'Custom' },
];

type FormState = { name: string; color: string; icon: string };
const DEFAULT_FORM: FormState = { name: '', color: '#6366f1', icon: 'tag' };

// ---------------------------------------------------------------------------
// Inline form
// ---------------------------------------------------------------------------

type CategoryFormProps = {
  initial?: FormState;
  onSubmit: (form: FormState) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
};

function CategoryForm({ initial = DEFAULT_FORM, onSubmit, onCancel, submitLabel }: CategoryFormProps) {
  const [form, setForm] = useState<FormState>(initial);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit() {
    if (!form.name.trim()) return;
    setIsPending(true);
    try {
      await onSubmit({ ...form, name: form.name.trim() });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}
      className="flex flex-col gap-3 px-4 py-3 bg-muted/40"
      aria-label="Category form"
    >
      <div className="flex gap-2 items-center">
        <input
          type="text"
          placeholder="Category name"
          value={form.name}
          onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); }}
          required
          maxLength={40}
          autoFocus
          className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <input
          type="text"
          placeholder="Icon (e.g. tag)"
          value={form.icon}
          onChange={(e) => { setForm((f) => ({ ...f, icon: e.target.value })); }}
          maxLength={30}
          className="w-32 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Lucide icon slug"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Color</span>
        <div className="flex flex-wrap gap-2">
          {COLOR_PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => { setForm((f) => ({ ...f, color })); }}
              className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{
                backgroundColor: color,
                borderColor: form.color === color ? color : 'transparent',
                outline: form.color === color ? `2px solid ${color}` : 'none',
                outlineOffset: '2px',
              }}
              aria-label={`Select color ${color}`}
              aria-pressed={form.color === color}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
        >
          <X size={14} aria-hidden="true" /> Cancel
        </button>
        <button
          type="submit"
          disabled={isPending || !form.name.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Parent row (sortable)
// ---------------------------------------------------------------------------

type ParentRowProps = {
  node: CategoryWithChildren;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: (category: Category) => void;
  onDelete: (id: UUID) => void;
  onAddSub: (parentId: UUID) => void;
  isDeleting: boolean;
  isDragDisabled: boolean;
};

function ParentRow({
  node,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddSub,
  isDeleting,
  isDragDisabled,
}: ParentRowProps) {
  const category = node.category;
  const hasChildren = node.children.length > 0;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: category.id, disabled: isDragDisabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          {...attributes}
          {...listeners}
          disabled={isDragDisabled}
          aria-label="Drag to reorder"
          className="text-muted-foreground hover:text-foreground transition-colors touch-none disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <GripVertical size={16} aria-hidden="true" />
        </button>
        <button
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse sub-categories' : 'Expand sub-categories'}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />
          ) : (
            <span className="inline-block w-[15px]" aria-hidden="true" />
          )}
        </button>
        <span
          className="h-5 w-5 rounded-full shrink-0 border border-black/10"
          style={{ backgroundColor: category.color }}
          aria-hidden="true"
        />
        <span className="flex-1 text-sm font-medium text-foreground truncate">{category.name}</span>
        {hasChildren && (
          <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0">
            {node.children.length} sub
          </span>
        )}
        {category.icon && (
          <code className="text-[10px] text-muted-foreground font-mono truncate max-w-[80px] hidden sm:block">
            {category.icon}
          </code>
        )}
        {category.isSystem && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0">
            <Lock size={9} aria-hidden="true" />
            System
          </span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => { onAddSub(category.id); }}
            aria-label={`Add sub-category under ${category.name}`}
            title="Add sub-category"
            className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <Plus size={14} aria-hidden="true" />
          </button>
          {!category.isSystem && (
            <>
              <button
                onClick={() => { onEdit(category); }}
                aria-label={`Edit ${category.name}`}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Pencil size={14} aria-hidden="true" />
              </button>
              <button
                onClick={() => { onDelete(category.id); }}
                disabled={isDeleting}
                aria-label={`Delete ${category.name}`}
                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
              >
                {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} aria-hidden="true" />}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-category row
// ---------------------------------------------------------------------------

type SubRowProps = {
  child: Category;
  parentColor: string;
  onEdit: (category: Category) => void;
  onDelete: (id: UUID) => void;
  isDeleting: boolean;
};

function SubCategoryRow({ child, parentColor, onEdit, onDelete, isDeleting }: SubRowProps) {
  return (
    <div className="flex items-center gap-3 pl-12 pr-4 py-2 border-t border-border/50">
      <CornerDownRight size={13} className="text-muted-foreground/50 shrink-0" aria-hidden="true" />
      <span
        className="h-3.5 w-3.5 rounded-full shrink-0 border border-black/10"
        style={{ backgroundColor: parentColor, opacity: 0.7 }}
        aria-hidden="true"
      />
      <span className="flex-1 text-sm text-foreground truncate">{child.name}</span>
      {child.icon && (
        <code className="text-[10px] text-muted-foreground font-mono truncate max-w-[80px] hidden sm:block">
          {child.icon}
        </code>
      )}
      {child.isSystem && (
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0">
          <Lock size={9} aria-hidden="true" />
          System
        </span>
      )}
      {!child.isSystem && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => { onEdit(child); }}
            aria-label={`Edit ${child.name}`}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Pencil size={13} aria-hidden="true" />
          </button>
          <button
            onClick={() => { onDelete(child.id); }}
            disabled={isDeleting}
            aria-label={`Delete ${child.name}`}
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
          >
            {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} aria-hidden="true" />}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Section
// ---------------------------------------------------------------------------

export function CategoriesSection() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingId, setDeletingId] = useState<UUID | null>(null);
  const [addSubFor, setAddSubFor] = useState<UUID | null>(null);
  const [expanded, setExpanded] = useState<Set<UUID>>(new Set());

  const currentUser = useSessionStore((s) => s.currentUser);
  const derivedKey = useSessionStore((s) => s.derivedKey);
  const addToast = useUIStore((s) => s.addToast);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadCategories = useCallback(async () => {
    if (!currentUser || !derivedKey) return;
    setIsLoading(true);
    const result = await categoryStorage.listCategoriesByUser(currentUser.id, derivedKey);
    if (result.success) {
      setCategories(result.data);
      const tree = buildCategoryTree(result.data);
      const allGroups = [...tree.expenses, ...tree.income, ...tree.transfer];
      const withChildren = allGroups
        .filter((n) => n.children.length > 0)
        .map((n) => n.category.id);
      setExpanded(new Set(withChildren));
    } else {
      addToast({ type: 'error', message: 'Failed to load categories.' });
    }
    setIsLoading(false);
  }, [currentUser, derivedKey, addToast]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const tree = buildCategoryTree(categories);
  const allNodes = [...tree.expenses, ...tree.income, ...tree.transfer];
  const topLevelCategories = allNodes.map((n) => n.category);

  const filteredNodes = allNodes
    .map((node) => {
      const parentMatches =
        filter === 'all' ||
        (filter === 'system' && node.category.isSystem) ||
        (filter === 'custom' && !node.category.isSystem);
      const filteredChildren = node.children.filter((child) => {
        if (filter === 'system') return child.isSystem;
        if (filter === 'custom') return !child.isSystem;
        return true;
      });
      if (!parentMatches && filteredChildren.length === 0) return null;
      return { category: node.category, children: filteredChildren };
    })
    .filter((n): n is CategoryWithChildren => n !== null);

  function toggleExpand(parentId: UUID) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !derivedKey) return;
    const oldIndex = topLevelCategories.findIndex((c) => c.id === active.id);
    const newIndex = topLevelCategories.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(topLevelCategories, oldIndex, newIndex).map((cat, idx) => ({
      ...cat,
      sortOrder: idx + 1,
    }));
    const reorderedMap = new Map(reordered.map((c) => [c.id, c]));
    setCategories(categories.map((c) => reorderedMap.get(c.id) ?? c));
    const results = await Promise.all(reordered.map((cat) => categoryStorage.updateCategory(cat, derivedKey)));
    if (results.some((r) => !r.success)) {
      addToast({ type: 'error', message: 'Failed to save sort order.' });
      void loadCategories();
    }
  }

  async function handleAdd(form: FormState) {
    if (!currentUser || !derivedKey) return;
    const nextSortOrder = Math.max(0, ...topLevelCategories.map((c) => c.sortOrder)) + 1;
    const newCategory: Category = {
      id: generateUUID(),
      userId: currentUser.id,
      name: form.name,
      icon: form.icon || 'tag',
      color: form.color,
      isSystem: false,
      sortOrder: nextSortOrder,
      createdAt: new Date().toISOString() as ISODateString,
    };
    const result = await categoryStorage.createCategory(newCategory, derivedKey);
    if (result.success) {
      setCategories((prev) => [...prev, result.data]);
      setShowAddForm(false);
      addToast({ type: 'success', message: `Category "${form.name}" created.` });
    } else {
      addToast({ type: 'error', message: result.error.message });
    }
  }

  async function handleAddSub(parentId: UUID, form: FormState) {
    if (!currentUser || !derivedKey) return;
    const result = await createSubcategory(
      currentUser.id,
      { name: form.name, icon: form.icon || 'tag', color: form.color, parentId },
      derivedKey
    );
    if (result.success) {
      setCategories((prev) => [...prev, result.data]);
      setAddSubFor(null);
      setExpanded((prev) => new Set([...prev, parentId]));
      addToast({ type: 'success', message: `Sub-category "${form.name}" created.` });
    } else {
      addToast({ type: 'error', message: result.error.message });
    }
  }

  async function handleEdit(form: FormState) {
    if (!editingCategory || !derivedKey) return;
    const updated: Category = {
      ...editingCategory,
      name: form.name,
      icon: form.icon || editingCategory.icon,
      color: form.color,
    };
    const result = await categoryStorage.updateCategory(updated, derivedKey);
    if (result.success) {
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? result.data : c)));
      setEditingCategory(null);
      addToast({ type: 'success', message: 'Category updated.' });
    } else {
      addToast({ type: 'error', message: result.error.message });
    }
  }

  async function handleDelete(id: UUID) {
    setDeletingId(id);
    const result = await categoryStorage.deleteCategory(id);
    if (result.success) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
      addToast({ type: 'success', message: 'Category deleted.' });
    } else {
      if (result.error.code === 'CATEGORY_HAS_CHILDREN') {
        addToast({
          type: 'error',
          message: 'Remove or reassign all sub-categories before deleting this category.',
        });
      } else {
        addToast({ type: 'error', message: result.error.message });
      }
    }
    setDeletingId(null);
  }

  return (
    <SettingsSection
      id="categories"
      title="Categories"
      description="Manage your transaction categories. Use the + button on any row to add sub-categories."
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          options={FILTER_OPTIONS}
          ariaLabel="Filter categories"
        />
        {!showAddForm && (
          <button
            onClick={() => { setShowAddForm(true); setEditingCategory(null); }}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus size={14} aria-hidden="true" />
            Add Category
          </button>
        )}
      </div>

      <SettingsCard>
        {showAddForm && (
          <CategoryForm
            onSubmit={handleAdd}
            onCancel={() => { setShowAddForm(false); }}
            submitLabel="Add"
          />
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
            <Loader2 size={16} className="animate-spin" aria-label="Loading categories" />
            <span className="text-sm">Loading categories…</span>
          </div>
        ) : filteredNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
            <span className="text-sm">No {filter !== 'all' ? filter : ''} categories found.</span>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => { void handleDragEnd(event); }}
          >
            <SortableContext
              items={filteredNodes.map((n) => n.category.id)}
              strategy={verticalListSortingStrategy}
            >
              {filteredNodes.map((node) => {
                const cat = node.category;
                const isNodeExpanded = expanded.has(cat.id);
                if (editingCategory?.id === cat.id) {
                  return (
                    <CategoryForm
                      key={cat.id}
                      initial={{ name: cat.name, color: cat.color, icon: cat.icon }}
                      onSubmit={handleEdit}
                      onCancel={() => { setEditingCategory(null); }}
                      submitLabel="Save"
                    />
                  );
                }
                return (
                  <div key={cat.id} className="border-b border-border last:border-none">
                    <ParentRow
                      node={node}
                      isExpanded={isNodeExpanded}
                      onToggleExpand={() => { toggleExpand(cat.id); }}
                      onEdit={setEditingCategory}
                      onDelete={(id) => { void handleDelete(id); }}
                      onAddSub={(parentId) => {
                        setAddSubFor(addSubFor === parentId ? null : parentId);
                        setShowAddForm(false);
                      }}
                      isDeleting={deletingId === cat.id}
                      isDragDisabled={filter !== 'all'}
                    />
                    {addSubFor === cat.id && (
                      <div className="pl-10 border-t border-border/50">
                        <CategoryForm
                          initial={{ name: '', color: cat.color, icon: 'tag' }}
                          onSubmit={(form) => handleAddSub(cat.id, form)}
                          onCancel={() => { setAddSubFor(null); }}
                          submitLabel="Add sub-category"
                        />
                      </div>
                    )}
                    {isNodeExpanded &&
                      node.children.map((child) =>
                        editingCategory?.id === child.id ? (
                          <div key={child.id} className="pl-10 border-t border-border/50">
                            <CategoryForm
                              initial={{ name: child.name, color: child.color, icon: child.icon }}
                              onSubmit={handleEdit}
                              onCancel={() => { setEditingCategory(null); }}
                              submitLabel="Save"
                            />
                          </div>
                        ) : (
                          <SubCategoryRow
                            key={child.id}
                            child={child}
                            parentColor={cat.color}
                            onEdit={setEditingCategory}
                            onDelete={(id) => { void handleDelete(id); }}
                            isDeleting={deletingId === child.id}
                          />
                        )
                      )}
                  </div>
                );
              })}
            </SortableContext>
          </DndContext>
        )}
      </SettingsCard>

      {filteredNodes.length > 0 && filter === 'all' && (
        <p className="text-xs text-muted-foreground px-1">
          Drag rows to reorder categories. Click + to add sub-categories.
        </p>
      )}
    </SettingsSection>
  );
}
