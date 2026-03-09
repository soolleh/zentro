/**
 * category.store.ts
 *
 * Zustand store for category tree state.
 * Calls ensureSystemSubcategories on load to lazily seed system sub-categories
 * for users who registered before the sub-category feature was introduced.
 */

import { create } from 'zustand';
import type { UUID } from '@/shared/types/common.types';
import type { Category, CategoryTree, FlatCategoryOption } from '@/shared/types/category.types';
import type { TransactionType } from '@/shared/types/transaction.types';
import {
  getCategoryTreeForUser,
  flattenCategoryTree,
  ensureSystemSubcategories,
  buildCategoryTree,
} from '@/services/categories/category.service';
import { useSessionStore } from '@/app/stores/session.store';

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

type CategoryState = {
  categories: Category[];
  tree: CategoryTree;
  isLoading: boolean;
  lastError: string | null;
};

type CategoryActions = {
  /** Load all categories for a user and build the tree. Runs ensureSystemSubcategories. */
  loadCategories: (userId: UUID) => Promise<void>;
  /** Update a single category in the local cache without re-fetching from IDB. */
  upsertCategory: (category: Category) => void;
  /** Remove a category from the local cache. */
  removeCategory: (id: UUID) => void;
  /** Return flat options for a Combobox/Select, optionally filtered by transaction type. */
  getFlatOptions: (type?: TransactionType) => FlatCategoryOption[];
  /** Return all sub-categories for a given parent id. */
  getSubcategories: (parentId: UUID) => Category[];
};

const EMPTY_TREE: CategoryTree = { expenses: [], income: [], transfer: [] };

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useCategoryStore = create<CategoryState & CategoryActions>((set, get) => ({
  categories: [],
  tree: EMPTY_TREE,
  isLoading: false,
  lastError: null,

  async loadCategories(userId) {
    const { derivedKey } = useSessionStore.getState();
    if (!derivedKey) return;

    set({ isLoading: true, lastError: null });

    // Lazily seed system sub-categories for existing users (idempotent)
    await ensureSystemSubcategories(userId, derivedKey);

    const result = await getCategoryTreeForUser(userId, derivedKey);
    set({ isLoading: false });

    if (result.success) {
      set({ categories: result.data.categories, tree: result.data.tree });
    } else {
      set({ lastError: result.error.message });
    }
  },

  upsertCategory(category) {
    const { categories } = get();
    const idx = categories.findIndex((c) => c.id === category.id);
    const updated =
      idx >= 0
        ? [...categories.slice(0, idx), category, ...categories.slice(idx + 1)]
        : [...categories, category];
    set({ categories: updated, tree: buildCategoryTree(updated) });
  },

  removeCategory(id) {
    const { categories } = get();
    const updated = categories.filter((c) => c.id !== id && c.parentId !== id);
    set({ categories: updated, tree: buildCategoryTree(updated) });
  },

  getFlatOptions(type) {
    return flattenCategoryTree(get().tree, type);
  },

  getSubcategories(parentId) {
    return get().categories.filter((c) => c.parentId === parentId);
  },
}));

// ---------------------------------------------------------------------------
// Selectors (stable references via hooks)
// ---------------------------------------------------------------------------

export function useCategoryTree(): CategoryTree {
  return useCategoryStore((s) => s.tree);
}

export function useFlatCategoryOptions(type?: TransactionType): FlatCategoryOption[] {
  const tree = useCategoryStore((s) => s.tree);
  return flattenCategoryTree(tree, type);
}

export function useSubcategories(parentId: UUID): Category[] {
  return useCategoryStore((s) => s.categories.filter((c) => c.parentId === parentId));
}
