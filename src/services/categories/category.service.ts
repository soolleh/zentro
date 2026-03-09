/**
 * category.service.ts
 *
 * Business logic for building category trees, flattening to select options,
 * creating sub-categories, and lazily seeding system sub-categories for
 * users who registered before the sub-category feature was introduced.
 *
 * All methods return Result<T>. No throws.
 * No React, no Zustand.
 */

import type { Result, UUID } from '@/shared/types/common.types';
import type {
  Category,
  CategoryTree,
  CategoryWithChildren,
  FlatCategoryOption,
} from '@/shared/types/category.types';
import type { TransactionType } from '@/shared/types/transaction.types';
import { categoryStorage } from '@/services/storage/category.storage';
import { generateUUID } from '@/services/crypto/crypto.utils';
import { SYSTEM_SUBCATEGORIES } from '@/shared/constants/categories.constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeError(code: string, message: string, cause?: unknown): Result<never> {
  return {
    success: false,
    error: {
      code,
      message,
      context: cause instanceof Error ? { cause: cause.message } : undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// Pure tree utilities
// ---------------------------------------------------------------------------

/**
 * Builds a CategoryTree from a flat list of categories.
 * Parents are identified by parentId == null/undefined.
 * Children are sorted by sortOrder then name.
 * Enforces max one level of nesting.
 */
export function buildCategoryTree(categories: Category[]): CategoryTree {
  const parentMap = new Map<UUID, CategoryWithChildren>();
  const expenseParents: CategoryWithChildren[] = [];
  const incomeParents: CategoryWithChildren[] = [];
  const transferParents: CategoryWithChildren[] = [];

  // First pass: collect all top-level categories
  for (const cat of categories) {
    if ((cat.parentId ?? null) !== null) continue;
    const node: CategoryWithChildren = { category: cat, children: [] };
    parentMap.set(cat.id, node);
    if (cat.transactionType === 'Income') {
      incomeParents.push(node);
    } else if (cat.transactionType === 'Transfer') {
      transferParents.push(node);
    } else {
      // Expense or unset (default to expense bucket)
      expenseParents.push(node);
    }
  }

  // Second pass: attach children to their parents
  for (const cat of categories) {
    if ((cat.parentId ?? null) === null) continue;
    const parentNode = parentMap.get(cat.parentId as UUID);
    if (parentNode) {
      parentNode.children.push(cat);
    }
  }

  // Sort children within each parent
  for (const node of parentMap.values()) {
    node.children.sort((a, b) => {
      const diff = a.sortOrder - b.sortOrder;
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });
  }

  // Sort parent arrays
  const sortNodes = (a: CategoryWithChildren, b: CategoryWithChildren) => {
    const diff = a.category.sortOrder - b.category.sortOrder;
    return diff !== 0 ? diff : a.category.name.localeCompare(b.category.name);
  };

  return {
    expenses: expenseParents.sort(sortNodes),
    income: incomeParents.sort(sortNodes),
    transfer: transferParents.sort(sortNodes),
  };
}

/**
 * Flattens a CategoryTree into an ordered list of FlatCategoryOption.
 * Group headers (parents with children) get depth=0 and are not selectable.
 * Sub-categories get depth=1.
 * Optionally filter by transactionType.
 */
export function flattenCategoryTree(
  tree: CategoryTree,
  type?: TransactionType
): FlatCategoryOption[] {
  const groups: CategoryWithChildren[][] = [];
  if (!type || type === 'Expense') groups.push(tree.expenses);
  if (!type || type === 'Income') groups.push(tree.income);
  if (!type || type === 'Transfer') groups.push(tree.transfer);

  const result: FlatCategoryOption[] = [];

  for (const group of groups) {
    for (const node of group) {
      const parent = node.category;
      result.push({
        category: parent,
        parent: null,
        depth: 0,
        label: parent.name,
        indentLabel: parent.name,
      });
      for (const child of node.children) {
        result.push({
          category: child,
          parent,
          depth: 1,
          label: `${parent.name} › ${child.name}`,
          indentLabel: `  ${child.name}`,
        });
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Async data access
// ---------------------------------------------------------------------------

/**
 * Fetches all categories for a user and builds the tree.
 */
export async function getCategoryTreeForUser(
  userId: UUID,
  key: CryptoKey
): Promise<Result<{ categories: Category[]; tree: CategoryTree }>> {
  const result = await categoryStorage.listCategoriesByUser(userId, key);
  if (!result.success) return result;
  const tree = buildCategoryTree(result.data);
  return { success: true, data: { categories: result.data, tree } };
}

// ---------------------------------------------------------------------------
// Sub-category CRUD
// ---------------------------------------------------------------------------

export type CreateSubcategoryParams = {
  name: string;
  icon: string;
  color: string;
  parentId: UUID;
  sortOrder?: number;
};

/**
 * Creates a user-defined sub-category under an existing parent.
 * Enforces max one level of nesting (parent must itself be top-level).
 */
export async function createSubcategory(
  userId: UUID,
  params: CreateSubcategoryParams,
  key: CryptoKey
): Promise<Result<Category>> {
  const { name, icon, color, parentId, sortOrder = 999 } = params;

  // Validate the parent exists and is itself top-level
  const allResult = await categoryStorage.listCategoriesByUser(userId, key);
  if (!allResult.success) return allResult;

  const parent = allResult.data.find((c) => c.id === parentId);
  if (!parent) {
    return makeError('PARENT_CATEGORY_NOT_FOUND', `Parent category ${parentId} not found.`);
  }
  if ((parent.parentId ?? null) !== null) {
    return makeError(
      'SUBCATEGORY_NESTING_EXCEEDED',
      'Sub-categories cannot be nested more than one level deep.'
    );
  }

  const now = new Date().toISOString();
  const subcat: Category = {
    id: generateUUID() as UUID,
    userId,
    name: name.trim(),
    icon,
    color,
    parentId,
    isSystem: false,
    sortOrder,
    createdAt: now as import('@/shared/types/common.types').ISODateString,
  };

  return categoryStorage.createCategory(subcat, key);
}

/**
 * Moves a sub-category to a new parent, or promotes it to top-level (newParentId = null).
 * Enforces max one level of nesting.
 */
export async function moveSubcategory(
  categoryId: UUID,
  newParentId: UUID | null,
  userId: UUID,
  key: CryptoKey
): Promise<Result<Category>> {
  const allResult = await categoryStorage.listCategoriesByUser(userId, key);
  if (!allResult.success) return allResult;

  const target = allResult.data.find((c) => c.id === categoryId);
  if (!target) {
    return makeError('CATEGORY_NOT_FOUND', `Category ${categoryId} not found.`);
  }

  if (newParentId !== null) {
    const newParent = allResult.data.find((c) => c.id === newParentId);
    if (!newParent) {
      return makeError('PARENT_CATEGORY_NOT_FOUND', `Parent category ${newParentId} not found.`);
    }
    if ((newParent.parentId ?? null) !== null) {
      return makeError(
        'SUBCATEGORY_NESTING_EXCEEDED',
        'Sub-categories cannot be nested more than one level deep.'
      );
    }
  }

  const updated: Category = {
    ...target,
    parentId: newParentId ?? undefined,
  };

  return categoryStorage.updateCategory(updated, key);
}

// ---------------------------------------------------------------------------
// Lazy system sub-category seeder
// ---------------------------------------------------------------------------

/**
 * Ensures all system sub-categories exist for a user.
 * Should be called once per session after authentication (e.g., from category store).
 * Idempotent — only creates categories that are missing.
 * Uses the user's derivedKey as required by encrypted storage.
 */
export async function ensureSystemSubcategories(
  userId: UUID,
  key: CryptoKey
): Promise<Result<void>> {
  const allResult = await categoryStorage.listCategoriesByUser(userId, key);
  if (!allResult.success) return allResult;

  const existingIds = new Set(allResult.data.map((c) => c.id));

  for (const systemSub of SYSTEM_SUBCATEGORIES) {
    if (existingIds.has(systemSub.id)) continue;
    // Assign real userId (sentinel is replaced here)
    const toCreate: Category = { ...systemSub, userId };
    const result = await categoryStorage.createCategory(toCreate, key);
    if (!result.success) {
      console.error(
        `[ensureSystemSubcategories] Failed to seed sub-category "${systemSub.name}":`,
        result.error.message
      );
      // Non-fatal — continue to next sub-category
    }
  }

  return { success: true, data: undefined };
}
