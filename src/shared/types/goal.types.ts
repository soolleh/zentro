import type { UUID, ISODateString, Currency } from './common.types';
import type { Account } from './account.types';

export type Goal = {
  readonly id: UUID;
  readonly userId: UUID;
  readonly name: string;
  readonly emoji?: string;
  readonly targetAmount: number;
  readonly currency: Currency;
  readonly targetDate?: ISODateString;
  readonly linkedAccountId?: UUID;
  readonly color: string;
  readonly createdAt: ISODateString;
  readonly completedAt?: ISODateString;
};

export type GoalContribution = {
  readonly id: UUID;
  readonly goalId: UUID;
  readonly fromAccountId: UUID;
  readonly amount: number;
  readonly date: ISODateString;
  readonly transactionId: UUID;
  readonly notes?: string;
};

export type GoalMilestone = {
  readonly percent: 25 | 50 | 75 | 100;
  readonly amount: number;
  readonly isReached: boolean;
  readonly reachedAt: ISODateString | null;
};

export type GoalProjection = {
  readonly monthlyContributionRate: number;
  readonly projectedCompletionDate: ISODateString | null;
  readonly isOnTrack: boolean;
  readonly monthsToCompletion: number | null;
  readonly requiredMonthlyAmount: number | null;
};

export type EnrichedGoal = {
  readonly goal: Goal;
  readonly contributions: GoalContribution[];
  readonly totalContributed: number;
  readonly percentComplete: number;
  readonly remainingAmount: number;
  readonly isComplete: boolean;
  readonly completedAt: ISODateString | null;
  readonly milestones: GoalMilestone[];
  readonly projection: GoalProjection;
  readonly linkedAccount: Account | null;
};

export type ContributeParams = {
  readonly goalId: UUID;
  readonly amount: number;
  readonly fromAccountId: UUID;
  readonly date: ISODateString;
  readonly notes?: string;
};
