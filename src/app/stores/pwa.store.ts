/**
 * pwa.store.ts
 *
 * Manages PWA-specific UI state: install prompt, update detection,
 * and notification permission.
 */
import { create } from 'zustand';

// BeforeInstallPromptEvent is not in the standard TypeScript DOM lib
export type BeforeInstallPromptEvent = Event & {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type PWAState = {
  readonly installPromptEvent: BeforeInstallPromptEvent | null;
  readonly isInstalled: boolean;
  readonly isInstallBannerVisible: boolean;
  readonly updateAvailable: boolean;
  readonly notificationPermission: NotificationPermission;
  readonly notificationPromptDismissed: boolean;
};

type PWAActions = {
  setInstallPromptEvent: (event: BeforeInstallPromptEvent) => void;
  setInstalled: (value: boolean) => void;
  showInstallBanner: () => void;
  hideInstallBanner: () => void;
  setUpdateAvailable: (value: boolean) => void;
  setNotificationPermission: (perm: NotificationPermission) => void;
  setNotificationPromptDismissed: (value: boolean) => void;
};

function getInitialNotificationPermission(): NotificationPermission {
  if (typeof Notification === 'undefined') return 'default';
  return Notification.permission;
}

function getInitialPromptDismissed(): boolean {
  try {
    return localStorage.getItem('zentro_notif_prompt_dismissed') === 'true';
  } catch {
    return false;
  }
}

export const usePWAStore = create<PWAState & PWAActions>((set) => ({
  installPromptEvent: null,
  isInstalled: false,
  isInstallBannerVisible: false,
  updateAvailable: false,
  notificationPermission: getInitialNotificationPermission(),
  notificationPromptDismissed: getInitialPromptDismissed(),

  setInstallPromptEvent(event) {
    set({ installPromptEvent: event });
  },

  setInstalled(value) {
    set({ isInstalled: value });
  },

  showInstallBanner() {
    set({ isInstallBannerVisible: true });
  },

  hideInstallBanner() {
    set({ isInstallBannerVisible: false });
  },

  setUpdateAvailable(value) {
    set({ updateAvailable: value });
  },

  setNotificationPermission(perm) {
    set({ notificationPermission: perm });
  },

  setNotificationPromptDismissed(value) {
    set({ notificationPromptDismissed: value });
    try {
      if (value) {
        localStorage.setItem('zentro_notif_prompt_dismissed', 'true');
      } else {
        localStorage.removeItem('zentro_notif_prompt_dismissed');
      }
    } catch {
      // localStorage unavailable — continue without persisting
    }
  },
}));
