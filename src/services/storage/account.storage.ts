import type { Result, UUID } from '@/shared/types/common.types';
import type { Account } from '@/shared/types/account.types';

const NOT_IMPLEMENTED: Result<never> = {
  success: false,
  error: { code: 'NOT_IMPLEMENTED', message: 'Not yet implemented' },
};

export const accountStorage = {
  async createAccount(_account: Account): Promise<Result<Account>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async getAccountById(_id: UUID): Promise<Result<Account>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async listAccountsByUser(_userId: UUID): Promise<Result<Account[]>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async updateAccount(_account: Account): Promise<Result<Account>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async deleteAccount(_id: UUID): Promise<Result<void>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },
};
