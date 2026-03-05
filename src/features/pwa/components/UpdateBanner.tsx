/**
 * UpdateBanner.tsx
 *
 * Fixed top banner that appears when a new service worker is waiting.
 * User must confirm before the page reloads to prevent disrupting active use.
 */
import { RefreshCw } from 'lucide-react';
import { usePWAStore } from '@/app/stores/pwa.store';

const BANNER_MSG = 'A new version of Zentro is available.';
const BTN_UPDATE = 'Update now';

export function UpdateBanner() {
  const { updateAvailable, setUpdateAvailable } = usePWAStore();

  if (!updateAvailable) return null;

  function handleUpdate() {
    if (window.__zentroWB) {
      window.__zentroWB.messageSkipWaiting();
    } else {
      // Fallback: hard reload
      window.location.reload();
    }
    setUpdateAvailable(false);
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed left-0 right-0 top-0 z-[100] flex items-center justify-between gap-3 bg-primary px-4 py-2.5 shadow-md"
    >
      <div className="flex items-center gap-2 min-w-0">
        <RefreshCw className="h-4 w-4 flex-shrink-0 text-primary-foreground" aria-hidden="true" />
        <span className="text-sm font-medium text-primary-foreground truncate">
          {BANNER_MSG}
        </span>
      </div>
      <button
        type="button"
        onClick={handleUpdate}
        className="flex-shrink-0 rounded-md border border-primary-foreground/30 px-3 py-1 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
      >
        {BTN_UPDATE}
      </button>
    </div>
  );
}
