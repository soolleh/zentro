import type { Result, UUID } from '@/shared/types/common.types';
import type { Category } from '@/shared/types/category.types';
import { getDB } from './storage.db';
import { encryptData, decryptData } from '@/services/crypto/crypto.service';

const NOT_IMPLEMENTED: Result<never> = {
  success: false,
  error: { code: 'NOT_IMPLEMENTED', message: 'Not yet implemented' },
};

function makeError(code: string, message: string, cause?: unknown): Result<never> {
  return {
    success: false,
    error: {
      code,
      message,
      context: cause instanceof Error ? { cause: cause.message } : undefined,
    },
  };
}

export const categoryStorage = {
  /**
   * Persist a category. Requires the user's derived CryptoKey.
   * isSystem is stored as a number (1/0) in the index field for IDB compatibility.
   */
  async createCategory(category: Category, key: CryptoKey): Promise<Result<Category>> {
    try {
      const encrypted = await encryptData(key, category);
      if (!encrypted.success) return encrypted;
      const db = await getDB();
      await db.put('categories', {
        id: category.id,
        userId: category.userId,
        isSystem: category.isSystem ? 1 : 0,
        data: encrypted.data.data,
      });
      return { success: true, data: category };
    } catch (err) {
      console.error('[categoryStorage.createCategory] Unexpected error:', err);
      const cause = err instanceof Error ? err.message : String(err);
      return makeError('CATEGORY_CREATE_FAILED', `Failed to create category. Cause: ${cause}`, err);
    }
  },

  async getCategoryById(id: UUID, key: CryptoKey): Promise<Result<Category>> {
    try {
      const db = await getDB();
      const record = await db.get('categories', id);
      if (!record) {
        return makeError('CATEGORY_NOT_FOUND', `No category found with id: ${id}`);
      }
      return await decryptData<Category>(key, { data: record.data });
    } catch (err) {
      return makeError('CATEGORY_READ_FAILED', 'Failed to read category.', err);
    }
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
