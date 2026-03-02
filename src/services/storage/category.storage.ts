import type { Result, UUID } from '@/shared/types/common.types';
import type { Category } from '@/shared/types/category.types';
import { getDB } from './storage.db';
import { encryptData, decryptData } from '@/services/crypto/crypto.service';

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

  async listCategoriesByUser(userId: UUID, key: CryptoKey): Promise<Result<Category[]>> {
    try {
      const db = await getDB();
      const records = await db.getAllFromIndex('categories', 'userId', userId);
      const categories: Category[] = [];
      for (const record of records) {
        const result = await decryptData<Category>(key, { data: record.data });
        if (!result.success) return result;
        categories.push(result.data);
      }
      categories.sort((a, b) => a.sortOrder - b.sortOrder);
      return { success: true, data: categories };
    } catch (err) {
      console.error('[categoryStorage.listCategoriesByUser] Unexpected error:', err);
      const cause = err instanceof Error ? err.message : String(err);
      return makeError('CATEGORY_LIST_FAILED', `Failed to list categories. Cause: ${cause}`, err);
    }
  },

  async updateCategory(category: Category, key: CryptoKey): Promise<Result<Category>> {
    try {
      const db = await getDB();
      const existing = await db.get('categories', category.id);
      if (!existing) {
        return makeError('CATEGORY_NOT_FOUND', `No category found with id: ${category.id}`);
      }
      const encrypted = await encryptData(key, category);
      if (!encrypted.success) return encrypted;
      await db.put('categories', {
        id: category.id,
        userId: category.userId,
        isSystem: category.isSystem ? 1 : 0,
        data: encrypted.data.data,
      });
      return { success: true, data: category };
    } catch (err) {
      console.error('[categoryStorage.updateCategory] Unexpected error:', err);
      const cause = err instanceof Error ? err.message : String(err);
      return makeError('CATEGORY_UPDATE_FAILED', `Failed to update category. Cause: ${cause}`, err);
    }
  },

  async deleteCategory(id: UUID): Promise<Result<void>> {
    try {
      const db = await getDB();
      const record = await db.get('categories', id);
      if (!record) {
        return makeError('CATEGORY_NOT_FOUND', `No category found with id: ${id}`);
      }
      if (record.isSystem === 1) {
        return makeError('CATEGORY_SYSTEM_DELETE', 'System categories cannot be deleted.');
      }
      await db.delete('categories', id);
      return { success: true, data: undefined };
    } catch (err) {
      const cause = err instanceof Error ? err.message : String(err);
      return makeError('CATEGORY_DELETE_FAILED', `Failed to delete category. Cause: ${cause}`, err);
    }
  },
};
