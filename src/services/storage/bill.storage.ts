import type { Result, UUID } from '@/shared/types/common.types';
import type { Bill } from '@/shared/types/bill.types';

const NOT_IMPLEMENTED: Result<never> = {
  success: false,
  error: { code: 'NOT_IMPLEMENTED', message: 'Not yet implemented' },
};

export const billStorage = {
  async createBill(_bill: Bill): Promise<Result<Bill>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async getBillById(_id: UUID): Promise<Result<Bill>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async listBillsByUser(_userId: UUID): Promise<Result<Bill[]>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async updateBill(_bill: Bill): Promise<Result<Bill>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async deleteBill(_id: UUID): Promise<Result<void>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },
};
