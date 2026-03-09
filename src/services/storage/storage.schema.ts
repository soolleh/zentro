import type { SerializedEncryptedPayload } from '@/services/crypto/crypto.types';
import type { DBSchema } from 'idb';

/**
 * All records in stores that contain financial data are stored as encrypted payloads.
 * The `id` field is always plaintext (used as the IndexedDB key).
 * The `data` field is the SerializedEncryptedPayload blob.
 * Index fields (e.g. userId, date) are stored in plaintext for query capability.
 */

export type EncryptedRecord = {
  id: string;
} & SerializedEncryptedPayload;

export type UserRecord = {
  id: string;
  emailHash: string;
} & SerializedEncryptedPayload;

export type AccountRecord = {
  id: string;
  userId: string;
  type: string;
} & SerializedEncryptedPayload;

export type TransactionRecord = {
  id: string;
  userId: string;
  accountId: string;
  date: string;
  categoryId: string;
  type: string;
  recurringRuleId?: string;
} & SerializedEncryptedPayload;

export type CategoryRecord = {
  id: string;
  userId: string;
  isSystem: number; // 1 = true, 0 = false (IDB index limitation)
  parentId?: string; // plaintext for index; undefined = top-level
} & SerializedEncryptedPayload;

export type BudgetRecord = {
  id: string;
  userId: string;
  categoryId: string;
  cycleStart: string;
} & SerializedEncryptedPayload;

export type GoalRecord = {
  id: string;
  userId: string;
} & SerializedEncryptedPayload;

export type GoalContributionRecord = {
  id: string;
  goalId: string;
  fromAccountId: string;
} & SerializedEncryptedPayload;

export type BillRecord = {
  id: string;
  userId: string;
} & SerializedEncryptedPayload;

export type BillEntryRecord = {
  id: string;
  billId: string;
  dueDate: string;
  status: string;
} & SerializedEncryptedPayload;

export type ExchangeRateRecord = {
  id: string;
  fromCurrency: string;
  toCurrency: string;
} & SerializedEncryptedPayload;

export type NotificationLogRecord = {
  id: string;
  userId: string;
  type: string;
  createdAt: string;
} & SerializedEncryptedPayload;

/**
 * Biometric credential record. The credentialId is the key path.
 * userId is stored plaintext for indexed lookup.
 * The full BiometricCredential is encrypted inside `data`.
 */
export type BiometricCredentialRecord = {
  credentialId: string;
  userId: string;
} & SerializedEncryptedPayload;

/**
 * sw_state — non-sensitive state for the service worker.
 * NO encrypted data. NO financial data. Only userId + preference flags.
 */
export type SWStateRecord = {
  key: string;
  value: unknown;
};

/**
 * google_tokens — encrypted Google OAuth2 tokens per user.
 * keyPath: userId (plaintext). `data` is the base64 combined iv+ciphertext
 * produced by encryptData from crypto.service (same format as all other stores).
 */
export type GoogleTokenRecord = {
  userId: string;
  data: string; // base64 combined iv+ciphertext
};

export type TemplateRecord = {
  id: string;
  userId: string;
  /** plaintext ISO date — null stored as empty string for index query */
  lastUsedAt: string;
  useCount: number;
} & SerializedEncryptedPayload;

export type AlertRecord = {
  id: string;
  userId: string;
  accountId: string;
  status: string;
} & SerializedEncryptedPayload;

export interface ZentroDBSchema extends DBSchema {
  users: {
    key: string;
    value: UserRecord;
    indexes: { emailHash: string };
  };
  user_settings: {
    key: string;
    value: EncryptedRecord;
    indexes: Record<never, never>;
  };
  accounts: {
    key: string;
    value: AccountRecord;
    indexes: { userId: string; type: string };
  };
  transactions: {
    key: string;
    value: TransactionRecord;
    indexes: {
      userId: string;
      accountId: string;
      date: string;
      categoryId: string;
      type: string;
      recurringRuleId: string;
    };
  };
  recurring_rules: {
    key: string;
    value: EncryptedRecord & { userId: string };
    indexes: { userId: string };
  };
  categories: {
    key: string;
    value: CategoryRecord;
    indexes: { userId: string; isSystem: number; parentId: string };
  };
  budgets: {
    key: string;
    value: BudgetRecord;
    indexes: { userId: string; categoryId: string; cycleStart: string };
  };
  goals: {
    key: string;
    value: GoalRecord;
    indexes: { userId: string };
  };
  goal_contributions: {
    key: string;
    value: GoalContributionRecord;
    indexes: { goalId: string; fromAccountId: string };
  };
  bills: {
    key: string;
    value: BillRecord;
    indexes: { userId: string };
  };
  bill_entries: {
    key: string;
    value: BillEntryRecord;
    indexes: { billId: string; dueDate: string; status: string };
  };
  exchange_rates: {
    key: string;
    value: ExchangeRateRecord;
    indexes: { fromCurrency: string; toCurrency: string };
  };
  notification_log: {
    key: string;
    value: NotificationLogRecord;
    indexes: { userId: string; type: string; createdAt: string };
  };
  biometric_credentials: {
    key: string;
    value: BiometricCredentialRecord;
    indexes: { userId: string };
  };
  sw_state: {
    key: string;
    value: SWStateRecord;
    indexes: Record<never, never>;
  };
  google_tokens: {
    key: string;
    value: GoogleTokenRecord;
    indexes: Record<never, never>;
  };
  templates: {
    key: string;
    value: TemplateRecord;
    indexes: { userId: string; lastUsedAt: string; useCount: number };
  };
  account_alerts: {
    key: string;
    value: AlertRecord;
    indexes: { userId: string; accountId: string; status: string };
  };
}
