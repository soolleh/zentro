import { create } from 'zustand';
import type { LocalUser } from '@/shared/types/user.types';
import type { ISODateString } from '@/shared/types/common.types';
import { bufferToBase64, base64ToBuffer } from '@/services/crypto/crypto.utils';

// ---------------------------------------------------------------------------
// Session token — persisted in sessionStorage (cleared on tab close)
// Allows silent session restore across page refreshes within the same tab.
// ---------------------------------------------------------------------------

const SESSION_TOKEN_KEY = 'zentro_session_token';

type SessionToken = {
  userId: string;
  rawKey: string; // base64-encoded exported AES-GCM key bytes
  inactivityTimeoutMinutes: number;
};

export function clearSessionToken(): void {
  try { sessionStorage.removeItem(SESSION_TOKEN_KEY); } catch { /* noop */ }
}

async function saveSessionToken(
  userId: string,
  key: CryptoKey,
  minutes: number
): Promise<void> {
  try {
    const raw = await crypto.subtle.exportKey('raw', key);
    const token: SessionToken = { userId, rawKey: bufferToBase64(raw), inactivityTimeoutMinutes: minutes };
    sessionStorage.setItem(SESSION_TOKEN_KEY, JSON.stringify(token));
  } catch { /* if export fails, session just won't survive refresh */ }
}

export async function getSessionToken(): Promise<SessionToken | null> {
  try {
    const item = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (!item) return null;
    return JSON.parse(item) as SessionToken;
  } catch { return null; }
}

export async function importKeyFromToken(rawKeyBase64: string): Promise<CryptoKey> {
  const raw = base64ToBuffer(rawKeyBase64);
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

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
  /** Silently restores a session from a sessionStorage token after a page refresh. */
  restoreSession: (user: LocalUser, key: CryptoKey, timeoutMinutes: number) => void;
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
    void saveSessionToken(user.id, key, timeoutMinutes);
  },

  restoreSession(user, key, timeoutMinutes) {
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
    // Token is already in sessionStorage — no need to re-save
  },

  lock() {
    clearInactivityTimer();
    // Clear sessionStorage so a refresh after lock requires re-authentication
    clearSessionToken();
    // derivedKey cleared FIRST — no window where it could be read after lock
    set({
      derivedKey: null,
      isLocked: true,
      lockedAt: new Date().toISOString() as ISODateString,
    });
  },

  unlock(key) {
    clearInactivityTimer();
    const { inactivityTimeoutMinutes, currentUser } = get();
    const ms = inactivityTimeoutMinutes * 60 * 1000;
    const expiresAt = new Date(Date.now() + ms).toISOString() as ISODateString;
    set({
      derivedKey: key,
      isLocked: false,
      lockedAt: null,
      sessionExpiresAt: expiresAt,
    });
    startInactivityTimer(inactivityTimeoutMinutes);
    if (currentUser) void saveSessionToken(currentUser.id, key, inactivityTimeoutMinutes);
  },

  logout() {
    clearInactivityTimer();
    clearSessionToken();
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
