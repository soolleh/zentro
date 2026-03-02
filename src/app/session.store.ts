import { create } from 'zustand';
import type { LocalUser } from '@/shared/types/user.types';
import type { ISODateString } from '@/shared/types/common.types';

type SessionState = {
  currentUser: LocalUser | null;
  derivedKey: CryptoKey | null;
  isAuthenticated: boolean;
  isLocked: boolean;
  lockedAt: ISODateString | null;
  sessionExpiresAt: ISODateString | null;
  inactivityTimeoutMs: number;
};

type SessionActions = {
  login: (user: LocalUser, key: CryptoKey, timeoutMinutes: number) => void;
  lock: () => void;
  unlock: (key: CryptoKey) => void;
  logout: () => void;
  refreshActivity: () => void;
};

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

export const useSessionStore = create<SessionState & SessionActions>((set, get) => ({
  currentUser: null,
  derivedKey: null,
  isAuthenticated: false,
  isLocked: false,
  lockedAt: null,
  sessionExpiresAt: null,
  inactivityTimeoutMs: DEFAULT_TIMEOUT_MS,

  login(user, key, timeoutMinutes) {
    const timeoutMs = timeoutMinutes * 60 * 1000;
    const expiresAt = new Date(Date.now() + timeoutMs).toISOString() as ISODateString;
    set({
      currentUser: user,
      derivedKey: key,
      isAuthenticated: true,
      isLocked: false,
      lockedAt: null,
      sessionExpiresAt: expiresAt,
      inactivityTimeoutMs: timeoutMs,
    });
  },

  lock() {
    set({
      derivedKey: null,
      isLocked: true,
      lockedAt: new Date().toISOString() as ISODateString,
    });
  },

  unlock(key) {
    const { inactivityTimeoutMs } = get();
    const expiresAt = new Date(Date.now() + inactivityTimeoutMs).toISOString() as ISODateString;
    set({
      derivedKey: key,
      isLocked: false,
      lockedAt: null,
      sessionExpiresAt: expiresAt,
    });
  },

  logout() {
    set({
      currentUser: null,
      derivedKey: null,
      isAuthenticated: false,
      isLocked: false,
      lockedAt: null,
      sessionExpiresAt: null,
      inactivityTimeoutMs: DEFAULT_TIMEOUT_MS,
    });
  },

  refreshActivity() {
    const { inactivityTimeoutMs, isAuthenticated } = get();
    if (!isAuthenticated) return;
    const expiresAt = new Date(Date.now() + inactivityTimeoutMs).toISOString() as ISODateString;
    set({ sessionExpiresAt: expiresAt });
  },
}));

// Inactivity watcher — subscribes to session state and auto-locks on expiry
useSessionStore.subscribe((state) => {
  if (!state.isAuthenticated || state.isLocked || state.sessionExpiresAt === null) return;
  if (Date.now() > new Date(state.sessionExpiresAt).getTime()) {
    useSessionStore.getState().lock();
  }
});
