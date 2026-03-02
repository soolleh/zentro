import type { Result, UUID } from '@/shared/types/common.types';
import type { Category } from '@/shared/types/category.types';

const NOT_IMPLEMENTED: Result<never> = {
  success: false,
  error: { code: 'NOT_IMPLEMENTED', message: 'Not yet implemented' },
};

export const categoryStorage = {
  async createCategory(_category: Category): Promise<Result<Category>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async getCategoryById(_id: UUID): Promise<Result<Category>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async listCategoriesByUser(_userId: UUID): Promise<Result<Category[]>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async updateCategory(_category: Category): Promise<Result<Category>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },

  async deleteCategory(_id: UUID): Promise<Result<void>> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },
};
