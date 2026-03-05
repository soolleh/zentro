/**
 * sw.ts — Zentro Service Worker
 *
 * Built with Workbox via injectManifest strategy.
 * Handles: precaching, app-shell caching, periodic sync, notification click.
 *
 * IMPORTANT: This file MUST NOT import from @/services/, @/features/, or @/app/.
 * It runs in the SW context — use only workbox-* packages and ./workers/.
 */
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import type { NotificationPayload } from '@/shared/types/notification.types';
import { handleNotificationCheck, handleRecurringGeneration } from './workers/sw-notifications';

declare const self: ServiceWorkerGlobalScope;

// ---------------------------------------------------------------------------
// Precaching — injected by Workbox at build time
// ---------------------------------------------------------------------------
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ---------------------------------------------------------------------------
// App shell (navigation requests) — NetworkFirst with cache fallback
// ---------------------------------------------------------------------------
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'zentro-app-shell',
      networkTimeoutSeconds: 3,
      plugins: [new CacheableResponsePlugin({ statuses: [200] })],
    })
  )
);

// ---------------------------------------------------------------------------
// Static assets (scripts, styles, fonts) — CacheFirst with expiration
// ---------------------------------------------------------------------------
registerRoute(
  ({ request }) =>
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font',
  new CacheFirst({
    cacheName: 'zentro-static-assets',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

// ---------------------------------------------------------------------------
// Images — CacheFirst with expiration
// ---------------------------------------------------------------------------
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'zentro-images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 24 * 60 * 60 }),
    ],
  })
);

// ---------------------------------------------------------------------------
// Manifest and other web app manifest files — StaleWhileRevalidate
// ---------------------------------------------------------------------------
registerRoute(
  ({ url }) => url.pathname.endsWith('.webmanifest'),
  new StaleWhileRevalidate({ cacheName: 'zentro-manifest' })
);

// ---------------------------------------------------------------------------
// SW lifecycle — claim clients immediately, handle SKIP_WAITING message
// ---------------------------------------------------------------------------
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

self.addEventListener('activate', () => {
  clientsClaim();
});

// ---------------------------------------------------------------------------
// Periodic Background Sync
// ---------------------------------------------------------------------------
interface SyncEvent extends ExtendableEvent {
  tag: string;
}

self.addEventListener('periodicsync', (event: Event) => {
  const syncEvent = event as SyncEvent;
  if (syncEvent.tag === 'zentro-recurring-generation') {
    syncEvent.waitUntil(handleRecurringGeneration());
  } else if (syncEvent.tag === 'zentro-notification-check') {
    syncEvent.waitUntil(handleNotificationCheck());
  }
});

// ---------------------------------------------------------------------------
// Notification click — focus existing window or open new one, then navigate
// ---------------------------------------------------------------------------
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const payload = event.notification.data as NotificationPayload | undefined;
  const url = payload?.actionUrl ?? '/zentro/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const existingClient = clients.find((c) => c.url.startsWith(self.location.origin));
      if (existingClient) {
        await existingClient.focus();
        existingClient.postMessage({ type: 'NAVIGATE', url });
        return;
      }
      await self.clients.openWindow(url);
    })
  );
});
