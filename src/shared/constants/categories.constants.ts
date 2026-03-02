import type { Category } from '@/shared/types/category.types';
import type { UUID, ISODateString } from '@/shared/types/common.types';

/**
 * Sentinel userId used for system-owned categories.
 * These records are written per-user during registration; this ID is replaced
 * with the actual user ID at write time.
 */
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000' as UUID;
const SYSTEM_CREATED_AT = '2026-01-01T00:00:00.000Z' as ISODateString;

function systemCategory(
  id: UUID,
  name: string,
  icon: string,
  color: string,
  sortOrder: number
): Category {
  return {
    id,
    userId: SYSTEM_USER_ID,
    name,
    icon,
    color,
    isSystem: true,
    sortOrder,
    createdAt: SYSTEM_CREATED_AT,
  };
}

// --- Income ---
export const CATEGORY_SALARY = systemCategory(
  '10000000-0000-0000-0000-000000000001' as UUID,
  'Salary',
  'briefcase',
  '#0891b2',
  1
);

export const CATEGORY_FREELANCE = systemCategory(
  '10000000-0000-0000-0000-000000000002' as UUID,
  'Freelance',
  'laptop',
  '#0891b2',
  2
);

export const CATEGORY_INVESTMENT_RETURNS = systemCategory(
  '10000000-0000-0000-0000-000000000003' as UUID,
  'Investment Returns',
  'trending-up',
  '#0891b2',
  3
);

export const CATEGORY_RENTAL_INCOME = systemCategory(
  '10000000-0000-0000-0000-000000000004' as UUID,
  'Rental Income',
  'home',
  '#0891b2',
  4
);

export const CATEGORY_OTHER_INCOME = systemCategory(
  '10000000-0000-0000-0000-000000000005' as UUID,
  'Other Income',
  'plus-circle',
  '#0891b2',
  5
);

// --- Expense ---
export const CATEGORY_FOOD_DINING = systemCategory(
  '20000000-0000-0000-0000-000000000001' as UUID,
  'Food & Dining',
  'utensils',
  '#f59e0b',
  10
);

export const CATEGORY_TRANSPORT = systemCategory(
  '20000000-0000-0000-0000-000000000002' as UUID,
  'Transport',
  'car',
  '#f59e0b',
  11
);

export const CATEGORY_HOUSING = systemCategory(
  '20000000-0000-0000-0000-000000000003' as UUID,
  'Housing',
  'home',
  '#f59e0b',
  12
);

export const CATEGORY_UTILITIES = systemCategory(
  '20000000-0000-0000-0000-000000000004' as UUID,
  'Utilities',
  'zap',
  '#f59e0b',
  13
);

export const CATEGORY_HEALTHCARE = systemCategory(
  '20000000-0000-0000-0000-000000000005' as UUID,
  'Healthcare',
  'heart-pulse',
  '#f59e0b',
  14
);

export const CATEGORY_ENTERTAINMENT = systemCategory(
  '20000000-0000-0000-0000-000000000006' as UUID,
  'Entertainment',
  'tv',
  '#f59e0b',
  15
);

export const CATEGORY_SHOPPING = systemCategory(
  '20000000-0000-0000-0000-000000000007' as UUID,
  'Shopping',
  'shopping-bag',
  '#f59e0b',
  16
);

export const CATEGORY_EDUCATION = systemCategory(
  '20000000-0000-0000-0000-000000000008' as UUID,
  'Education',
  'book-open',
  '#f59e0b',
  17
);

export const CATEGORY_TRAVEL = systemCategory(
  '20000000-0000-0000-0000-000000000009' as UUID,
  'Travel',
  'plane',
  '#f59e0b',
  18
);

export const CATEGORY_PERSONAL_CARE = systemCategory(
  '20000000-0000-0000-0000-000000000010' as UUID,
  'Personal Care',
  'smile',
  '#f59e0b',
  19
);

export const CATEGORY_INSURANCE = systemCategory(
  '20000000-0000-0000-0000-000000000011' as UUID,
  'Insurance',
  'shield',
  '#f59e0b',
  20
);

export const CATEGORY_SUBSCRIPTIONS = systemCategory(
  '20000000-0000-0000-0000-000000000012' as UUID,
  'Subscriptions',
  'refresh-cw',
  '#f59e0b',
  21
);

export const CATEGORY_OTHER_EXPENSE = systemCategory(
  '20000000-0000-0000-0000-000000000013' as UUID,
  'Other Expense',
  'more-horizontal',
  '#f59e0b',
  22
);

// --- Transfer ---
export const CATEGORY_TRANSFER = systemCategory(
  '30000000-0000-0000-0000-000000000001' as UUID,
  'Transfer',
  'arrow-left-right',
  '#6366f1',
  30
);

// --- Grouped exports ---
export const INCOME_CATEGORIES: readonly Category[] = [
  CATEGORY_SALARY,
  CATEGORY_FREELANCE,
  CATEGORY_INVESTMENT_RETURNS,
  CATEGORY_RENTAL_INCOME,
  CATEGORY_OTHER_INCOME,
];

export const EXPENSE_CATEGORIES: readonly Category[] = [
  CATEGORY_FOOD_DINING,
  CATEGORY_TRANSPORT,
  CATEGORY_HOUSING,
  CATEGORY_UTILITIES,
  CATEGORY_HEALTHCARE,
  CATEGORY_ENTERTAINMENT,
  CATEGORY_SHOPPING,
  CATEGORY_EDUCATION,
  CATEGORY_TRAVEL,
  CATEGORY_PERSONAL_CARE,
  CATEGORY_INSURANCE,
  CATEGORY_SUBSCRIPTIONS,
  CATEGORY_OTHER_EXPENSE,
];

export const TRANSFER_CATEGORIES: readonly Category[] = [CATEGORY_TRANSFER];

export const ALL_SYSTEM_CATEGORIES: readonly Category[] = [
  ...INCOME_CATEGORIES,
  ...EXPENSE_CATEGORIES,
  ...TRANSFER_CATEGORIES,
];
