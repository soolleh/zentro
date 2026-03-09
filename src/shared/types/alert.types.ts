/**
 * alert.types.ts
 *
 * Type definitions for account balance alerts.
 */
import type { UUID, ISODateString, Currency } from '@/shared/types/common.types';
import type { Account } from '@/shared/types/account.types';

export type AlertCondition = 'below' | 'above';

export type AlertStatus = 'active' | 'triggered' | 'snoozed' | 'dismissed';

export type AccountAlert = {
  readonly id: UUID;
  readonly userId: UUID;
  readonly accountId: UUID;
  readonly condition: AlertCondition;
  readonly threshold: number;
  readonly currency: Currency;
  readonly label: string;
  readonly isEnabled: boolean;
  readonly status: AlertStatus;
  readonly lastTriggeredAt: ISODateString | null;
  readonly lastTriggeredBalance: number | null;
  readonly snoozeUntil: ISODateString | null;
  readonly notifyInApp: boolean;
  readonly notifyPush: boolean;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
};

export type AlertEvaluationResult = {
  readonly alert: AccountAlert;
  readonly triggered: boolean;
  readonly currentBalance: number;
  readonly previousBalance: number | null;
  readonly crossedAt: ISODateString;
};

export type EnrichedAccountAlert = {
  readonly alert: AccountAlert;
  readonly account: Account;
  readonly isCurrentlyTriggered: boolean;
};
