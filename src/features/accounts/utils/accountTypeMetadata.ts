/**
 * accountTypeMetadata.ts
 *
 * Shared mapping from AccountType to icon, color, and display label.
 * Kept here so all account components use the same visual identity.
 */

import { Banknote, Building2, CreditCard, PiggyBank, Landmark, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AccountType } from '@/shared/types/account.types';

type AccountTypeMeta = {
  readonly label: string;
  readonly Icon: LucideIcon;
  readonly color: string; // hsl CSS variable reference
  readonly bgColor: string; // color at ~12% opacity
};

export const ACCOUNT_TYPE_META: Record<AccountType, AccountTypeMeta> = {
  Cash: {
    label: 'Cash',
    Icon: Banknote,
    color: 'hsl(var(--chart-4))',
    bgColor: 'hsl(var(--chart-4) / 0.12)',
  },
  Bank: {
    label: 'Bank',
    Icon: Building2,
    color: 'hsl(var(--chart-1))',
    bgColor: 'hsl(var(--chart-1) / 0.12)',
  },
  Checking: {
    label: 'Checking',
    Icon: CreditCard,
    color: 'hsl(var(--chart-2))',
    bgColor: 'hsl(var(--chart-2) / 0.12)',
  },
  Savings: {
    label: 'Savings',
    Icon: PiggyBank,
    color: 'hsl(var(--chart-4))',
    bgColor: 'hsl(var(--chart-4) / 0.12)',
  },
  CreditCard: {
    label: 'Credit Card',
    Icon: CreditCard,
    color: 'hsl(var(--chart-3))',
    bgColor: 'hsl(var(--chart-3) / 0.12)',
  },
  Loan: {
    label: 'Loan',
    Icon: Landmark,
    color: 'hsl(var(--destructive))',
    bgColor: 'hsl(var(--destructive) / 0.08)',
  },
  Investment: {
    label: 'Investment',
    Icon: TrendingUp,
    color: 'hsl(var(--chart-2))',
    bgColor: 'hsl(var(--chart-2) / 0.12)',
  },
};
