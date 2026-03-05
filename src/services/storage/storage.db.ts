import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type { ZentroDBSchema } from './storage.schema';
import { DB_NAME, DB_VERSION } from './storage.constants';

// Store the Promise rather than the resolved instance so that concurrent calls
// before the first openDB resolves all wait on the same promise instead of each
// calling openDB() independently.
let dbPromise: Promise<IDBPDatabase<ZentroDBSchema>> | null = null;

export function getDB(): Promise<IDBPDatabase<ZentroDBSchema>> {
  if (dbPromise !== null) return dbPromise;

  dbPromise = openDB<ZentroDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // -----------------------------------------------------------------------
      // V1 → initial schema
      // -----------------------------------------------------------------------
      if (oldVersion < 1) {
        // users
        const usersStore = db.createObjectStore('users', { keyPath: 'id' });
        usersStore.createIndex('emailHash', 'emailHash', { unique: true });

        // user_settings (keyed by userId)
        db.createObjectStore('user_settings', { keyPath: 'id' });

        // accounts
        const accountsStore = db.createObjectStore('accounts', { keyPath: 'id' });
        accountsStore.createIndex('userId', 'userId', { unique: false });
        accountsStore.createIndex('type', 'type', { unique: false });

        // transactions
        const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
        txStore.createIndex('userId', 'userId', { unique: false });
        txStore.createIndex('accountId', 'accountId', { unique: false });
        txStore.createIndex('date', 'date', { unique: false });
        txStore.createIndex('categoryId', 'categoryId', { unique: false });
        txStore.createIndex('type', 'type', { unique: false });
        txStore.createIndex('recurringRuleId', 'recurringRuleId', { unique: false });

        // recurring_rules
        const rulesStore = db.createObjectStore('recurring_rules', { keyPath: 'id' });
        rulesStore.createIndex('userId', 'userId', { unique: false });

        // categories
        const categoriesStore = db.createObjectStore('categories', { keyPath: 'id' });
        categoriesStore.createIndex('userId', 'userId', { unique: false });
        categoriesStore.createIndex('isSystem', 'isSystem', { unique: false });

        // budgets
        const budgetsStore = db.createObjectStore('budgets', { keyPath: 'id' });
        budgetsStore.createIndex('userId', 'userId', { unique: false });
        budgetsStore.createIndex('categoryId', 'categoryId', { unique: false });
        budgetsStore.createIndex('cycleStart', 'cycleStart', { unique: false });

        // goals
        const goalsStore = db.createObjectStore('goals', { keyPath: 'id' });
        goalsStore.createIndex('userId', 'userId', { unique: false });

        // goal_contributions
        const contribStore = db.createObjectStore('goal_contributions', { keyPath: 'id' });
        contribStore.createIndex('goalId', 'goalId', { unique: false });
        contribStore.createIndex('fromAccountId', 'fromAccountId', { unique: false });

        // bills
        const billsStore = db.createObjectStore('bills', { keyPath: 'id' });
        billsStore.createIndex('userId', 'userId', { unique: false });

        // bill_entries
        const entriesStore = db.createObjectStore('bill_entries', { keyPath: 'id' });
        entriesStore.createIndex('billId', 'billId', { unique: false });
        entriesStore.createIndex('dueDate', 'dueDate', { unique: false });
        entriesStore.createIndex('status', 'status', { unique: false });

        // exchange_rates
        const ratesStore = db.createObjectStore('exchange_rates', { keyPath: 'id' });
        ratesStore.createIndex('fromCurrency', 'fromCurrency', { unique: false });
        ratesStore.createIndex('toCurrency', 'toCurrency', { unique: false });

        // notification_log
        const notifStore = db.createObjectStore('notification_log', { keyPath: 'id' });
        notifStore.createIndex('userId', 'userId', { unique: false });
        notifStore.createIndex('type', 'type', { unique: false });
        notifStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // -----------------------------------------------------------------------
      // V2 → biometric credentials store
      // -----------------------------------------------------------------------
      if (oldVersion < 2) {
        const bioStore = db.createObjectStore('biometric_credentials', {
          keyPath: 'credentialId',
        });
        // unique: true — one credential per user
        bioStore.createIndex('userId', 'userId', { unique: true });
      }
      // -----------------------------------------------------------------------
      // V3 → fix user_settings keyPath (was 'userId' in older dev builds; must be 'id')
      // -----------------------------------------------------------------------
      if (oldVersion < 3) {
        if (db.objectStoreNames.contains('user_settings')) {
          db.deleteObjectStore('user_settings');
        }
        db.createObjectStore('user_settings', { keyPath: 'id' });
      }
      // -----------------------------------------------------------------------
      // V4 → sw_state object store (non-sensitive SW state)
      // -----------------------------------------------------------------------
      if (oldVersion < 4) {
        db.createObjectStore('sw_state', { keyPath: 'key' });
      }
    },
  });

  // If openDB rejects (e.g. browser blocks IDB), clear the cached promise so
  // the next call will try again rather than permanently returning a rejection.
  dbPromise.catch(() => {
    dbPromise = null;
  });

  return dbPromise;
}
