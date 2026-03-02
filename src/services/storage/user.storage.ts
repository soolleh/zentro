import type { Result, UUID } from '@/shared/types/common.types';
import type { LocalUser } from '@/shared/types/user.types';

const NOT_IMPLEMENTED: Result<never> = {
  success: false,
  error: { code: 'NOT_IMPLEMENTED', message: 'Not yet implemented' },
};

export const userStorage = {
  async createUser(_user: LocalUser): Promise<Result<LocalUser>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async getUserById(_id: UUID): Promise<Result<LocalUser>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async getUserByEmailHash(_emailHash: string): Promise<Result<LocalUser>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async listUsers(): Promise<Result<LocalUser[]>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async updateUser(_user: LocalUser): Promise<Result<LocalUser>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async deleteUser(_id: UUID): Promise<Result<void>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },
};
