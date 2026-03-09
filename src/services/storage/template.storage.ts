/**
 * template.storage.ts
 *
 * IndexedDB persistence for TransactionTemplate records.
 * All records are AES-GCM encrypted. Index fields (userId, lastUsedAt, useCount)
 * are stored in plaintext for query capability.
 */

import type { Result, UUID, ISODateString } from '@/shared/types/common.types';
import type { TransactionTemplate } from '@/shared/types/template.types';
import { getDB } from './storage.db';
import { encryptData, decryptData } from '@/services/crypto/crypto.service';
import { generateUUID } from '@/services/crypto/crypto.utils';

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

export const templateStorage = {
  async createTemplate(
    template: Omit<
      TransactionTemplate,
      'id' | 'createdAt' | 'updatedAt' | 'useCount' | 'lastUsedAt'
    >,
    key: CryptoKey
  ): Promise<Result<TransactionTemplate>> {
    try {
      const now = new Date().toISOString() as ISODateString;
      const full: TransactionTemplate = {
        ...template,
        id: generateUUID() as UUID,
        useCount: 0,
        lastUsedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      const encrypted = await encryptData(key, full);
      if (!encrypted.success) return encrypted;
      const db = await getDB();
      await db.put('templates', {
        id: full.id,
        userId: full.userId,
        lastUsedAt: full.lastUsedAt ?? '',
        useCount: full.useCount,
        data: encrypted.data.data,
      });
      return { success: true, data: full };
    } catch (err) {
      return makeError('TEMPLATE_CREATE_FAILED', 'Failed to create template.', err);
    }
  },

  async getTemplateById(id: UUID, key: CryptoKey): Promise<Result<TransactionTemplate | null>> {
    try {
      const db = await getDB();
      const record = await db.get('templates', id);
      if (!record) return { success: true, data: null };
      return await decryptData<TransactionTemplate>(key, { data: record.data });
    } catch (err) {
      return makeError('TEMPLATE_READ_FAILED', 'Failed to read template.', err);
    }
  },

  async listTemplatesByUser(userId: UUID, key: CryptoKey): Promise<Result<TransactionTemplate[]>> {
    try {
      const db = await getDB();
      const records = await db.getAllFromIndex('templates', 'userId', userId);
      const templates: TransactionTemplate[] = [];
      for (const record of records) {
        const result = await decryptData<TransactionTemplate>(key, { data: record.data });
        if (!result.success) return result;
        templates.push(result.data);
      }
      // Sort: most recently used first (nulls last), then by createdAt desc
      templates.sort((a, b) => {
        if (a.lastUsedAt !== null && b.lastUsedAt !== null) {
          return b.lastUsedAt.localeCompare(a.lastUsedAt);
        }
        if (a.lastUsedAt !== null) return -1;
        if (b.lastUsedAt !== null) return 1;
        // Both null — sort by createdAt desc
        return b.createdAt.localeCompare(a.createdAt);
      });
      return { success: true, data: templates };
    } catch (err) {
      return makeError('TEMPLATE_LIST_FAILED', 'Failed to list templates.', err);
    }
  },

  async updateTemplate(
    id: UUID,
    updates: Partial<Omit<TransactionTemplate, 'id' | 'createdAt'>>,
    key: CryptoKey
  ): Promise<Result<TransactionTemplate>> {
    try {
      const db = await getDB();
      const record = await db.get('templates', id);
      if (!record) return makeError('TEMPLATE_NOT_FOUND', `No template found with id: ${id}`);
      const decrypted = await decryptData<TransactionTemplate>(key, { data: record.data });
      if (!decrypted.success) return decrypted;
      const updated: TransactionTemplate = {
        ...decrypted.data,
        ...updates,
        id: decrypted.data.id,
        userId: decrypted.data.userId,
        createdAt: decrypted.data.createdAt,
        updatedAt: new Date().toISOString() as ISODateString,
      };
      const encrypted = await encryptData(key, updated);
      if (!encrypted.success) return encrypted;
      await db.put('templates', {
        id: updated.id,
        userId: updated.userId,
        lastUsedAt: updated.lastUsedAt ?? '',
        useCount: updated.useCount,
        data: encrypted.data.data,
      });
      return { success: true, data: updated };
    } catch (err) {
      return makeError('TEMPLATE_UPDATE_FAILED', 'Failed to update template.', err);
    }
  },

  async incrementUseCount(id: UUID, key: CryptoKey): Promise<Result<TransactionTemplate>> {
    try {
      const db = await getDB();
      const record = await db.get('templates', id);
      if (!record) return makeError('TEMPLATE_NOT_FOUND', `No template found with id: ${id}`);
      const decrypted = await decryptData<TransactionTemplate>(key, { data: record.data });
      if (!decrypted.success) return decrypted;
      const now = new Date().toISOString() as ISODateString;
      const updated: TransactionTemplate = {
        ...decrypted.data,
        useCount: decrypted.data.useCount + 1,
        lastUsedAt: now,
        updatedAt: now,
      };
      const encrypted = await encryptData(key, updated);
      if (!encrypted.success) return encrypted;
      await db.put('templates', {
        id: updated.id,
        userId: updated.userId,
        lastUsedAt: updated.lastUsedAt ?? '',
        useCount: updated.useCount,
        data: encrypted.data.data,
      });
      return { success: true, data: updated };
    } catch (err) {
      return makeError('TEMPLATE_INCREMENT_FAILED', 'Failed to increment template use count.', err);
    }
  },

  async deleteTemplate(id: UUID): Promise<Result<void>> {
    try {
      const db = await getDB();
      await db.delete('templates', id);
      return { success: true, data: undefined };
    } catch (err) {
      return makeError('TEMPLATE_DELETE_FAILED', 'Failed to delete template.', err);
    }
  },
};
