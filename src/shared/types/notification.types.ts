export type NotificationType = 'BudgetAlert' | 'BillDue' | 'GoalReminder' | 'WeeklySummary';

export type NotificationPreference = {
  readonly type: NotificationType;
  readonly enabled: boolean;
  readonly thresholdOverride?: number;
  readonly dayOfWeek?: number;
  readonly timeOfDay?: string;
};
