/**
 * InstallPrompt.tsx
 *
 * Bottom sheet that appears ~30s after first visit to prompt PWA installation.
 * Dismissible. Shows only when the beforeinstallprompt event has been captured.
 */
import { Smartphone, X } from 'lucide-react';
import { usePWAStore } from '@/app/stores/pwa.store';

const APP_NAME = 'Zentro';
const INSTALL_HEADLINE = 'Install Zentro on your device';
const INSTALL_BODY =
  'Get faster access, offline support, and a native app experience.';
const BTN_INSTALL = 'Install app';
const BTN_DISMISS = 'Not now';

export function InstallPrompt() {
  const {
    installPromptEvent,
    isInstalled,
    isInstallBannerVisible,
    hideInstallBanner,
    setInstalled,
  } = usePWAStore();

  if (!isInstallBannerVisible || isInstalled || !installPromptEvent) return null;

  async function handleInstall() {
    if (!installPromptEvent) return;
    const result = await installPromptEvent.prompt();
    if (result.outcome === 'accepted') {
      setInstalled(true);
    }
    hideInstallBanner();
  }

  function handleDismiss() {
    hideInstallBanner();
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={INSTALL_HEADLINE}
      className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-sm animate-in slide-in-from-bottom-4 duration-200"
    >
      <div className="rounded-2xl border border-border bg-card p-5 shadow-lg">
        <div className="flex items-start gap-4">
          {/* App icon */}
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary">
            <Smartphone className="h-6 w-6 text-primary-foreground" aria-hidden="true" />
          </div>

          {/* Text */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{APP_NAME}</p>
            <p className="mt-0.5 text-xs font-medium text-foreground">{INSTALL_HEADLINE}</p>
            <p className="mt-1 text-xs text-muted-foreground">{INSTALL_BODY}</p>
          </div>

          {/* Dismiss X */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label={BTN_DISMISS}
            className="flex-shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleDismiss}
            className="flex-1 rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {BTN_DISMISS}
          </button>
          <button
            type="button"
            onClick={() => { void handleInstall(); }}
            className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {BTN_INSTALL}
          </button>
        </div>
      </div>
    </div>
  );
}
