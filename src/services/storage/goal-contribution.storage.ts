import type { Result, UUID } from '@/shared/types/common.types';
import type { GoalContribution } from '@/shared/types/goal.types';

const NOT_IMPLEMENTED: Result<never> = {
  success: false,
  error: { code: 'NOT_IMPLEMENTED', message: 'Not yet implemented' },
};

export const goalContributionStorage = {
  async createContribution(_contribution: GoalContribution): Promise<Result<GoalContribution>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async listContributionsByGoal(_goalId: UUID): Promise<Result<GoalContribution[]>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },
};
