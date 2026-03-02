import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type { ZentroDBSchema } from './storage.schema';
import { DB_NAME, DB_VERSION } from './storage.constants';

let dbInstance: IDBPDatabase<ZentroDBSchema> | null = null;

export async function getDB(): Promise<IDBPDatabase<ZentroDBSchema>> {
  if (dbInstance !== null) return dbInstance;

  dbInstance = await openDB<ZentroDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
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
    },
  });

  return dbInstance;
}
