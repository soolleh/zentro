import type { Result, UUID } from '@/shared/types/common.types';
import type { Goal } from '@/shared/types/goal.types';

const NOT_IMPLEMENTED: Result<never> = {
  success: false,
  error: { code: 'NOT_IMPLEMENTED', message: 'Not yet implemented' },
};

export const goalStorage = {
  async createGoal(_goal: Goal): Promise<Result<Goal>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async getGoalById(_id: UUID): Promise<Result<Goal>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async listGoalsByUser(_userId: UUID): Promise<Result<Goal[]>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async updateGoal(_goal: Goal): Promise<Result<Goal>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async deleteGoal(_id: UUID): Promise<Result<void>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },
};
