export type NotificationType =
  | 'BudgetAlert'
  | 'BudgetNearLimit'
  | 'BudgetExceeded'
  | 'BillDue'
  | 'BillDueSoon'
  | 'GoalReminder'
  | 'GoalBehindTarget'
  | 'WeeklySummary';

export type NotificationPreference = {
  readonly type: NotificationType;
  readonly enabled: boolean;
  readonly thresholdOverride?: number;
  readonly dayOfWeek?: number;
  readonly timeOfDay?: string;
};

/** Payload stored on each Notification object; used by notificationclick handler. */
export type NotificationPayload = {
  readonly type: NotificationType;
  readonly actionUrl: string;
  readonly entityId?: string;
};

/** Input for sending a local (main-thread) notification via SW. */
export type LocalNotificationPayload = {
  readonly title: string;
  readonly body: string;
  readonly icon?: string;
  readonly badge?: string;
  readonly tag?: string;
  readonly data: NotificationPayload;
  readonly silent?: boolean;
};
