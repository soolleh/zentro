import type { Result, UUID, ISODateString } from '@/shared/types/common.types';
import type { BillEntry } from '@/shared/types/bill.types';

const NOT_IMPLEMENTED: Result<never> = {
  success: false,
  error: { code: 'NOT_IMPLEMENTED', message: 'Not yet implemented' },
};

export const billEntryStorage = {
  async createBillEntry(_entry: BillEntry): Promise<Result<BillEntry>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async listEntriesByBill(_billId: UUID): Promise<Result<BillEntry[]>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async listEntriesByDueDate(
    _from: ISODateString,
    _to: ISODateString
  ): Promise<Result<BillEntry[]>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async updateBillEntry(_entry: BillEntry): Promise<Result<BillEntry>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },
};
