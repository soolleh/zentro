import type { Result, UUID, ISODateString } from '@/shared/types/common.types';
import type { Transaction } from '@/shared/types/transaction.types';

const NOT_IMPLEMENTED: Result<never> = {
  success: false,
  error: { code: 'NOT_IMPLEMENTED', message: 'Not yet implemented' },
};

export const transactionStorage = {
  async createTransaction(_transaction: Transaction): Promise<Result<Transaction>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async getTransactionById(_id: UUID): Promise<Result<Transaction>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async listTransactionsByAccount(_accountId: UUID): Promise<Result<Transaction[]>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async listTransactionsByUser(_userId: UUID): Promise<Result<Transaction[]>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async updateTransaction(_transaction: Transaction): Promise<Result<Transaction>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async deleteTransaction(_id: UUID): Promise<Result<void>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async listTransactionsByDateRange(
    _userId: UUID,
    _from: ISODateString,
    _to: ISODateString
  ): Promise<Result<Transaction[]>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },
};
