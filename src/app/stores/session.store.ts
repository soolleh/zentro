import { create } from 'zustand';
import type { LocalUser } from '@/shared/types/user.types';
import type { ISODateString } from '@/shared/types/common.types';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

type SessionState = {
  readonly currentUser: LocalUser | null;
  /** In-memory only — never serialised, never persisted. */
  readonly derivedKey: CryptoKey | null;
  readonly isAuthenticated: boolean;
  readonly isLocked: boolean;
  readonly lockedAt: ISODateString | null;
  readonly sessionExpiresAt: ISODateString | null;
  readonly inactivityTimeoutMinutes: number;
};

type SessionActions = {
  login: (user: LocalUser, key: CryptoKey, timeoutMinutes: number) => void;
  lock: () => void;
  unlock: (key: CryptoKey) => void;
  logout: () => void;
  /**
   * Extends the session expiry on user activity.
   * Timer management (setInterval / clearInterval) is handled in providers.tsx
   * to keep the store free of side-effects.
   */
  refreshActivity: () => void;
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MINUTES = 5;

export const useSessionStore = create<SessionState & SessionActions>((set, get) => ({
  currentUser: null,
  derivedKey: null,
  isAuthenticated: false,
  isLocked: false,
  lockedAt: null,
  sessionExpiresAt: null,
  inactivityTimeoutMinutes: DEFAULT_TIMEOUT_MINUTES,

  login(user, key, timeoutMinutes) {
    const ms = timeoutMinutes * 60 * 1000;
    const expiresAt = new Date(Date.now() + ms).toISOString() as ISODateString;
    set({
      currentUser: user,
      derivedKey: key,
      isAuthenticated: true,
      isLocked: false,
      lockedAt: null,
      sessionExpiresAt: expiresAt,
      inactivityTimeoutMinutes: timeoutMinutes,
    });
  },

  lock() {
    // derivedKey cleared FIRST — no window where it could be read after lock
    set({
      derivedKey: null,
      isLocked: true,
      lockedAt: new Date().toISOString() as ISODateString,
    });
  },

  unlock(key) {
    const { inactivityTimeoutMinutes } = get();
    const ms = inactivityTimeoutMinutes * 60 * 1000;
    const expiresAt = new Date(Date.now() + ms).toISOString() as ISODateString;
    set({
      derivedKey: key,
      isLocked: false,
      lockedAt: null,
      sessionExpiresAt: expiresAt,
    });
  },

  logout() {
    // derivedKey cleared FIRST
    set({
      derivedKey: null,
      currentUser: null,
      isAuthenticated: false,
      isLocked: false,
      lockedAt: null,
      sessionExpiresAt: null,
      inactivityTimeoutMinutes: DEFAULT_TIMEOUT_MINUTES,
    });
  },

  refreshActivity() {
    const { inactivityTimeoutMinutes, isAuthenticated, isLocked } = get();
    if (!isAuthenticated || isLocked) return;
    const ms = inactivityTimeoutMinutes * 60 * 1000;
    const expiresAt = new Date(Date.now() + ms).toISOString() as ISODateString;
    set({ sessionExpiresAt: expiresAt });
  },
}));

// ---------------------------------------------------------------------------
// Auto-lock subscription
// Purges the derived key when sessionExpiresAt is crossed.
// ---------------------------------------------------------------------------
useSessionStore.subscribe((state) => {
  if (!state.isAuthenticated || state.isLocked || !state.sessionExpiresAt) return;
  const msUntilExpiry = new Date(state.sessionExpiresAt).getTime() - Date.now();
  if (msUntilExpiry <= 0) {
    useSessionStore.getState().lock();
  }
});

// ---------------------------------------------------------------------------
// Selector hooks (preferred over inline selectors in components)
// ---------------------------------------------------------------------------

export const useIsAuthenticated = (): boolean => useSessionStore((s) => s.isAuthenticated);

export const useIsLocked = (): boolean => useSessionStore((s) => s.isLocked);

export const useDerivedKey = (): CryptoKey | null => useSessionStore((s) => s.derivedKey);

export const useCurrentUser = (): LocalUser | null => useSessionStore((s) => s.currentUser);

export const useSession = (): SessionState & SessionActions => useSessionStore((s) => s);
