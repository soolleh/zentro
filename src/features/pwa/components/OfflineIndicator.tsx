/**
 * OfflineIndicator.tsx
 *
 * Listens to browser online/offline events and renders a subtle pill
 * in the header when the device has no network.
 *
 * This is informational only — Zentro is fully functional offline.
 */
import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

const LABEL_OFFLINE = 'Offline';
const LABEL_OFFLINE_DESCRIPTION = 'No internet connection — your data is safe locally.';

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false);
    }

    function handleOffline() {
      setIsOffline(true);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-label={LABEL_OFFLINE_DESCRIPTION}
      title={LABEL_OFFLINE_DESCRIPTION}
      className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1"
    >
      <WifiOff className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      <span className="text-xs font-medium text-muted-foreground">{LABEL_OFFLINE}</span>
    </div>
  );
}
