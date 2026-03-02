import type { Result, UUID } from '@/shared/types/common.types';
import type { UserSettings } from '@/shared/types/settings.types';

const NOT_IMPLEMENTED: Result<never> = {
  success: false,
  error: { code: 'NOT_IMPLEMENTED', message: 'Not yet implemented' },
};

export const settingsStorage = {
  async getSettingsByUser(_userId: UUID): Promise<Result<UserSettings>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async upsertSettings(_settings: UserSettings): Promise<Result<UserSettings>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },
};
