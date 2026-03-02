import type { Result, UUID, ISODateString } from '@/shared/types/common.types';
import type { Budget } from '@/shared/types/budget.types';

const NOT_IMPLEMENTED: Result<never> = {
  success: false,
  error: { code: 'NOT_IMPLEMENTED', message: 'Not yet implemented' },
};

export const budgetStorage = {
  async createBudget(_budget: Budget): Promise<Result<Budget>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async getBudgetById(_id: UUID): Promise<Result<Budget>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async listBudgetsByUser(_userId: UUID): Promise<Result<Budget[]>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async listBudgetsByCycle(_userId: UUID, _cycleStart: ISODateString): Promise<Result<Budget[]>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async updateBudget(_budget: Budget): Promise<Result<Budget>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async deleteBudget(_id: UUID): Promise<Result<void>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },
};
