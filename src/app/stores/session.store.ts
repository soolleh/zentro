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
  /** Resets the inactivity countdown on user interaction. No-op when locked. */
  refreshActivity: () => void;
  /** Updates the inactivity timeout and immediately resets the countdown. */
  setInactivityTimeout: (minutes: number) => void;
};

// ---------------------------------------------------------------------------
// Module-level timer — NOT Zustand state.
// Using Zustand state for the timer handle would cause unnecessary re-renders
// and would prevent the timer from being cleared during logout/lock transitions.
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MINUTES = 5;

let inactivityTimer: ReturnType<typeof setTimeout> | null = null;

function clearInactivityTimer(): void {
  if (inactivityTimer !== null) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
}

function startInactivityTimer(minutes: number): void {
  clearInactivityTimer();
  if (minutes <= 0) return;
  inactivityTimer = setTimeout(
    () => {
      useSessionStore.getState().lock();
    },
    minutes * 60 * 1000
  );
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSessionStore = create<SessionState & SessionActions>((set, get) => ({
  currentUser: null,
  derivedKey: null,
  isAuthenticated: false,
  isLocked: false,
  lockedAt: null,
  sessionExpiresAt: null,
  inactivityTimeoutMinutes: DEFAULT_TIMEOUT_MINUTES,

  login(user, key, timeoutMinutes) {
    clearInactivityTimer();
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
    startInactivityTimer(timeoutMinutes);
  },

  lock() {
    clearInactivityTimer();
    // derivedKey cleared FIRST — no window where it could be read after lock
    set({
      derivedKey: null,
      isLocked: true,
      lockedAt: new Date().toISOString() as ISODateString,
    });
  },

  unlock(key) {
    clearInactivityTimer();
    const { inactivityTimeoutMinutes } = get();
    const ms = inactivityTimeoutMinutes * 60 * 1000;
    const expiresAt = new Date(Date.now() + ms).toISOString() as ISODateString;
    set({
      derivedKey: key,
      isLocked: false,
      lockedAt: null,
      sessionExpiresAt: expiresAt,
    });
    startInactivityTimer(inactivityTimeoutMinutes);
  },

  logout() {
    clearInactivityTimer();
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
    clearInactivityTimer();
    const ms = inactivityTimeoutMinutes * 60 * 1000;
    const expiresAt = new Date(Date.now() + ms).toISOString() as ISODateString;
    set({ sessionExpiresAt: expiresAt });
    startInactivityTimer(inactivityTimeoutMinutes);
  },

  setInactivityTimeout(minutes) {
    set({ inactivityTimeoutMinutes: minutes });
    // Reset the running countdown with the new duration
    get().refreshActivity();
  },
}));

// ---------------------------------------------------------------------------
// Selector hooks (preferred over inline selectors in components)
// ---------------------------------------------------------------------------

export const useIsAuthenticated = (): boolean => useSessionStore((s) => s.isAuthenticated);

export const useIsLocked = (): boolean => useSessionStore((s) => s.isLocked);

export const useDerivedKey = (): CryptoKey | null => useSessionStore((s) => s.derivedKey);

export const useCurrentUser = (): LocalUser | null => useSessionStore((s) => s.currentUser);

export const useInactivityTimeoutMinutes = (): number =>
  useSessionStore((s) => s.inactivityTimeoutMinutes);

export const useSession = (): SessionState & SessionActions => useSessionStore((s) => s);
