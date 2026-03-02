/**
 * onboarding.service.ts
 *
 * Business logic for the 4-step onboarding flow.
 * All methods are pure async functions returning Result<T>. No throws.
 */

import type { Result, UUID, ISODateString, Currency } from '@/shared/types/common.types';
import type { Account, AccountType } from '@/shared/types/account.types';
import type { Transaction } from '@/shared/types/transaction.types';
import type { Budget } from '@/shared/types/budget.types';
import { accountStorage } from '@/services/storage/account.storage';
import { transactionStorage } from '@/services/storage/transaction.storage';
import { budgetStorage } from '@/services/storage/budget.storage';
import { settingsStorage } from '@/services/storage/settings.storage';
import { usePreferencesStore } from '@/app/preferences.store';

// ---------------------------------------------------------------------------
// Param types
// ---------------------------------------------------------------------------

export type FirstAccountParams = {
  readonly name: string;
  readonly type: AccountType;
  readonly currency: Currency;
  readonly openingBalance: number;
  readonly openingDate: ISODateString;
  readonly updatedAt: ISODateString;
  // optional type-specific fields
  readonly creditLimit?: number;
  readonly minimumPaymentDue?: number;
  readonly paymentDueDate?: ISODateString;
  readonly outstandingPrincipal?: number;
  readonly interestRate?: number;
};

export type FirstIncomeParams = {
  readonly accountId: UUID;
  readonly amount: number;
  readonly currency: Currency;
  readonly categoryId: UUID;
  readonly date: ISODateString;
  readonly notes?: string;
};

export type FirstBudgetParams = {
  readonly categoryId: UUID;
  readonly amount: number;
  readonly currency: Currency;
  readonly alertThreshold?: number;
};

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

function getCycleDates(cycleStartDay: number): {
  cycleStart: ISODateString;
  cycleEnd: ISODateString;
} {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  const startDay = Math.max(1, Math.min(28, cycleStartDay));

  // If today is before the start day, the cycle started last month
  const cycleStartDate =
    now.getDate() >= startDay
      ? new Date(year, month, startDay)
      : new Date(year, month - 1, startDay);

  // Cycle end is the day before the next cycle start
  const nextCycleStart = new Date(
    cycleStartDate.getFullYear(),
    cycleStartDate.getMonth() + 1,
    startDay
  );
  const cycleEndDate = new Date(nextCycleStart.getTime() - 86400000); // minus 1 day

  return {
    cycleStart: cycleStartDate.toISOString().slice(0, 10) as ISODateString,
    cycleEnd: cycleEndDate.toISOString().slice(0, 10) as ISODateString,
  };
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

export async function isOnboardingComplete(userId: UUID, key: CryptoKey): Promise<Result<boolean>> {
  const result = await settingsStorage.getSettingsByUser(userId, key);
  if (!result.success) return result;
  return { success: true, data: result.data.onboardingCompletedAt !== null };
}

export async function markOnboardingComplete(userId: UUID, key: CryptoKey): Promise<Result<void>> {
  const settingsResult = await settingsStorage.getSettingsByUser(userId, key);
  if (!settingsResult.success) return settingsResult;

  const now = new Date().toISOString() as ISODateString;
  const updatedSettings = {
    ...settingsResult.data,
    onboardingCompletedAt: now,
    updatedAt: now,
  };

  const writeResult = await settingsStorage.upsertSettings(updatedSettings, key);
  if (!writeResult.success) return writeResult;

  // Update the preferences store so ProtectedRoute reflects the change immediately
  usePreferencesStore.getState().loadPreferences(updatedSettings);

  return { success: true, data: undefined };
}

export async function createFirstAccount(
  userId: UUID,
  params: FirstAccountParams,
  key: CryptoKey
): Promise<Result<Account>> {
  const account: Omit<Account, 'id' | 'createdAt'> = {
    userId,
    name: params.name,
    type: params.type,
    currency: params.currency,
    openingBalance: params.openingBalance,
    openingDate: params.openingDate,
    updatedAt: params.updatedAt,
    ...(params.creditLimit !== undefined && { creditLimit: params.creditLimit }),
    ...(params.minimumPaymentDue !== undefined && {
      minimumPaymentDue: params.minimumPaymentDue,
    }),
    ...(params.paymentDueDate !== undefined && { paymentDueDate: params.paymentDueDate }),
    ...(params.outstandingPrincipal !== undefined && {
      outstandingPrincipal: params.outstandingPrincipal,
    }),
    ...(params.interestRate !== undefined && { interestRate: params.interestRate }),
  };

  return accountStorage.createAccount(account, key);
}

export async function createFirstIncome(
  userId: UUID,
  params: FirstIncomeParams,
  key: CryptoKey
): Promise<Result<Transaction>> {
  return transactionStorage.createTransaction(
    {
      userId,
      accountId: params.accountId,
      type: 'Income',
      amount: params.amount,
      currency: params.currency,
      categoryId: params.categoryId,
      date: params.date,
      notes: params.notes,
      isReconciled: false,
    },
    key
  );
}

export async function createFirstBudget(
  userId: UUID,
  params: FirstBudgetParams,
  key: CryptoKey
): Promise<Result<Budget>> {
  // Read current settings for cycleStartDay and defaultAlertThreshold
  const settingsResult = await settingsStorage.getSettingsByUser(userId, key);
  if (!settingsResult.success) {
    return makeError('BUDGET_SETTINGS_READ_FAILED', 'Failed to read user settings for budget.');
  }
  const settings = settingsResult.data;
  const { cycleStart, cycleEnd } = getCycleDates(settings.budgetCycleStartDay);

  return budgetStorage.createBudget(
    {
      userId,
      categoryId: params.categoryId,
      amount: params.amount,
      currency: params.currency,
      cycleStart,
      cycleEnd,
      carryForward: false,
      alertThreshold: params.alertThreshold ?? settings.defaultAlertThreshold,
    },
    key
  );
}
