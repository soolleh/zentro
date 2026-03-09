import type { UUID, ISODateString } from './common.types';
import type { TransactionType } from './transaction.types';

export type Category = {
  readonly id: UUID;
  readonly userId: UUID;
  readonly name: string;
  readonly icon: string;
  readonly color: string;
  readonly transactionType?: TransactionType;
  readonly isSystem: boolean;
  /** null = top-level category; UUID = sub-category of that parent */
  readonly parentId?: UUID | null;
  readonly sortOrder: number;
  readonly createdAt: ISODateString;
};

// ---------------------------------------------------------------------------
// Nested / tree structures
// ---------------------------------------------------------------------------

export type CategoryWithChildren = {
  category: Category;
  children: Category[];
};

export type CategoryTree = {
  expenses: CategoryWithChildren[];
  income: CategoryWithChildren[];
  transfer: CategoryWithChildren[];
};

export type FlatCategoryOption = {
  category: Category;
  parent: Category | null;
  depth: number; // 0 = parent, 1 = sub-category
  label: string; // "Food & Dining" or "Food & Dining › Groceries"
  indentLabel: string; // "  Groceries" (indented for flat lists)
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function isSystemCategory(category: Category): boolean {
  return category.isSystem === true;
}
