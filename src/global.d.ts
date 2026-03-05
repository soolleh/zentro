/**
 * global.d.ts
 *
 * Global type augmentations for the Zentro PWA.
 */
import type { Workbox } from 'workbox-window';

declare global {
  interface Window {
    /**
     * Workbox instance stored by PWAInitializer so the UpdateBanner
     * can call `messageSkipWaiting()` without prop drilling.
     */
    __zentroWB: Workbox | undefined;
  }
}

export {};
