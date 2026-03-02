/**
 * CategoriesSection
 *
 * Manage expense and income categories with:
 * - Drag-and-drop reordering (@dnd-kit)
 * - Inline create/edit form for custom categories
 * - Delete (custom only)
 * - Filter tabs: All / System / Custom
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
} from 'lucide-react';
import { SettingsSection } from '../components/SettingsSection';
import { SettingsCard } from '../components/SettingsCard';
import { SegmentedControl } from '../components/SegmentedControl';
import { categoryStorage } from '@/services/storage/category.storage';
import { generateUUID } from '@/services/crypto/crypto.utils';
import { useSessionStore } from '@/app/stores/session.store';
import { useUIStore } from '@/app/ui.store';
import type { Category } from '@/shared/types/category.types';
import type { UUID, ISODateString } from '@/shared/types/common.types';

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

const COLOR_PALETTE = [
  '#0891b2', '#6366f1', '#f59e0b', '#10b981', '#ec4899',
  '#ef4444', '#8b5cf6', '#f97316', '#14b8a6', '#84cc16',
  '#06b6d4', '#3b82f6', '#a855f7', '#d97706', '#059669',
];

// ---------------------------------------------------------------------------
// Filter type
// ---------------------------------------------------------------------------

type FilterTab = 'all' | 'system' | 'custom';

const FILTER_OPTIONS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'system', label: 'System' },
  { value: 'custom', label: 'Custom' },
];

// ---------------------------------------------------------------------------
// Inline add/edit form state
// ---------------------------------------------------------------------------

type FormState = {
  name: string;
  color: string;
  icon: string;
};

const DEFAULT_FORM: FormState = { name: '', color: '#6366f1', icon: 'tag' };

// ---------------------------------------------------------------------------
// Sortable Category Row
// ---------------------------------------------------------------------------

type CategoryRowProps = {
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (id: UUID) => void;
  isDeleting: boolean;
  isDragDisabled: boolean;
};

function CategoryRow({
  category,
  onEdit,
  onDelete,
  isDeleting,
  isDragDisabled,
}: CategoryRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: category.id, disabled: isDragDisabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-4 py-3"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        disabled={isDragDisabled}
        aria-label="Drag to reorder"
        className="text-muted-foreground hover:text-foreground transition-colors touch-none disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <GripVertical size={16} aria-hidden="true" />
      </button>

      {/* Color swatch */}
      <span
        className="h-5 w-5 rounded-full shrink-0 border border-black/10"
        style={{ backgroundColor: category.color }}
        aria-hidden="true"
      />

      {/* Name + icon */}
      <span className="flex-1 text-sm text-foreground truncate">
        {category.name}
      </span>
      {category.icon && (
        <code className="text-[10px] text-muted-foreground font-mono truncate max-w-[80px]">
          {category.icon}
        </code>
      )}

      {/* System badge */}
      {category.isSystem && (
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0">
          <Lock size={9} aria-hidden="true" />
          System
        </span>
      )}

      {/* Actions (custom only) */}
      {!category.isSystem && (
        <div className="flex items-center gap-1 shrink-0">
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
            {isDeleting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} aria-hidden="true" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline Category Form
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
      {/* Name */}
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
          placeholder="Icon name e.g. tag"
          value={form.icon}
          onChange={(e) => { setForm((f) => ({ ...f, icon: e.target.value })); }}
          maxLength={30}
          className="w-32 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Icon name (Lucide icon slug)"
        />
      </div>

      {/* Color picker */}
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

      {/* Actions */}
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
          {isPending ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : (
            <Check size={14} aria-hidden="true" />
          )}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main Section Component
// ---------------------------------------------------------------------------

export function CategoriesSection() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingId, setDeletingId] = useState<UUID | null>(null);

  const currentUser = useSessionStore((s) => s.currentUser);
  const derivedKey = useSessionStore((s) => s.derivedKey);
  const addToast = useUIStore((s) => s.addToast);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------

  const loadCategories = useCallback(async () => {
    if (!currentUser || !derivedKey) return;
    setIsLoading(true);
    const result = await categoryStorage.listCategoriesByUser(
      currentUser.id,
      derivedKey
    );
    if (result.success) {
      setCategories(result.data);
    } else {
      addToast({ type: 'error', message: 'Failed to load categories.' });
    }
    setIsLoading(false);
  }, [currentUser, derivedKey, addToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCategories();
  }, [loadCategories]);

  // ---------------------------------------------------------------------------
  // Filtered view
  // ---------------------------------------------------------------------------

  const filtered = categories.filter((c) => {
    if (filter === 'system') return c.isSystem;
    if (filter === 'custom') return !c.isSystem;
    return true;
  });

  // ---------------------------------------------------------------------------
  // Drag end — reorder
  // ---------------------------------------------------------------------------

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !derivedKey) return;

    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(categories, oldIndex, newIndex).map((cat, idx) => ({
      ...cat,
      sortOrder: idx + 1,
    }));

    setCategories(reordered);

    // Persist all reordered items
    const updates = reordered.map((cat) =>
      categoryStorage.updateCategory(cat, derivedKey)
    );
    const results = await Promise.all(updates);
    const failed = results.find((r) => !r.success);
    if (failed) {
      addToast({ type: 'error', message: 'Failed to save sort order.' });
      void loadCategories(); // revert
    }
  }

  // ---------------------------------------------------------------------------
  // Add
  // ---------------------------------------------------------------------------

  async function handleAdd(form: FormState) {
    if (!currentUser || !derivedKey) return;

    const nextSortOrder = Math.max(0, ...categories.map((c) => c.sortOrder)) + 1;
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

  // ---------------------------------------------------------------------------
  // Edit
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async function handleDelete(id: UUID) {
    setDeletingId(id);
    const result = await categoryStorage.deleteCategory(id);
    if (result.success) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
      addToast({ type: 'success', message: 'Category deleted.' });
    } else {
      addToast({ type: 'error', message: result.error.message });
    }
    setDeletingId(null);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SettingsSection
      id="categories"
      title="Categories"
      description="Manage your transaction categories. System categories cannot be edited or deleted."
    >
      {/* Filter + Add controls */}
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
        {/* Add form */}
        {showAddForm && (
          <CategoryForm
            onSubmit={handleAdd}
            onCancel={() => { setShowAddForm(false); }}
            submitLabel="Add"
          />
        )}

        {/* Category list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
            <Loader2 size={16} className="animate-spin" aria-label="Loading categories" />
            <span className="text-sm">Loading categories…</span>
          </div>
        ) : filtered.length === 0 ? (
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
              items={filtered.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {filtered.map((cat) => (
                editingCategory?.id === cat.id ? (
                  <CategoryForm
                    key={cat.id}
                    initial={{ name: cat.name, color: cat.color, icon: cat.icon }}
                    onSubmit={handleEdit}
                    onCancel={() => { setEditingCategory(null); }}
                    submitLabel="Save"
                  />
                ) : (
                  <CategoryRow
                    key={cat.id}
                    category={cat}
                    onEdit={setEditingCategory}
                    onDelete={(id) => { void handleDelete(id); }}
                    isDeleting={deletingId === cat.id}
                    isDragDisabled={filter !== 'all'}
                  />
                )
              ))}
            </SortableContext>
          </DndContext>
        )}
      </SettingsCard>

      {filtered.length > 0 && filter === 'all' && (
        <p className="text-xs text-muted-foreground px-1">
          Drag rows to reorder categories. Order is reflected everywhere in the app.
        </p>
      )}
    </SettingsSection>
  );
}
