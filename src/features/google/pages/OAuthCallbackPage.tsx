/**
 * OAuthCallbackPage.tsx
 *
 * Handles the redirect from Google after OAuth authorization.
 * Accessible without authentication (needed for the restore flow).
 *
 * Two modes:
 *  - Authenticated (Settings flow): saves tokens, triggers first backup,
 *    shows a success screen with "Go to Settings" / "View Backups" buttons.
 *  - Unauthenticated (Restore flow): sets restore tokens in store, shows
 *    a success screen with a "Select Backup to Restore" button.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle, HardDrive, RotateCcw } from 'lucide-react';
import { handleOAuthCallback } from '@/services/google/oauth.service';
import * as tokenStorage from '@/services/storage/google-tokens.storage';
import { useDriveBackupStore } from '@/app/stores/drive-backup.store';
import { useSessionStore } from '@/app/stores/session.store';
import { ROUTES } from '@/app/routes.constants';
import type { UUID } from '@/shared/types/common.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PageState =
  | { status: 'loading' }
  | { status: 'success_connected'; returnPath: string }
  | { status: 'success_restore' }
  | { status: 'error'; message: string; returnPath: string };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const currentUser = useSessionStore((s) => s.currentUser);
  const derivedKey = useSessionStore((s) => s.derivedKey);
  const hasRun = useRef(false);

  const [pageState, setPageState] = useState<PageState>({ status: 'loading' });

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    void processCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function processCallback() {
    // After the main.tsx shim rewrites:
    //   /zentro/oauth/callback?code=X  →  /zentro/#/oauth/callback?code=X
    // the query params live inside window.location.hash, not window.location.search.
    // e.g. hash = "#/oauth/callback?code=X&state=Y"
    const hashContent = window.location.hash; // "#/oauth/callback?code=...&state=..."
    const queryStart = hashContent.indexOf('?');
    const params = queryStart >= 0
      ? new URLSearchParams(hashContent.slice(queryStart))
      : new URLSearchParams();

    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    const returnPath =
      sessionStorage.getItem('zentro_drive_return_path') ?? ROUTES.SETTINGS;
    sessionStorage.removeItem('zentro_drive_return_path');

    // --- User cancelled ---
    if (error === 'access_denied') {
      void navigate(returnPath.startsWith('/') ? returnPath : ROUTES.SETTINGS);
      return;
    }

    // --- Other Google error ---
    if (error || !code || !state) {
      setPageState({
        status: 'error',
        message: error
          ? 'Google returned an error. Please try again.'
          : 'Missing authorization code. Please try again.',
        returnPath,
      });
      return;
    }

    // --- Exchange code for tokens ---
    const tokenResult = await handleOAuthCallback(code, state);

    if (!tokenResult.success) {
      setPageState({
        status: 'error',
        message: 'Failed to connect Google Drive. Please try again.',
        returnPath,
      });
      return;
    }

    const tokens = tokenResult.data;

    // --- Authenticated flow (Settings "Connect Drive") ---
    if (currentUser && derivedKey) {
      const userId = currentUser.id as UUID;
      const saveResult = await tokenStorage.saveTokens(userId, tokens, derivedKey);

      if (!saveResult.success) {
        setPageState({
          status: 'error',
          message: 'Could not save credentials. Please try again.',
          returnPath,
        });
        return;
      }

      useDriveBackupStore.setState({
        isConnected: true,
        connectedEmail: tokens.email,
        connectedName: tokens.displayName,
      });

      // First backup triggers in the background
      useDriveBackupStore.getState().runBackup(userId).catch(() => undefined);

      setPageState({ status: 'success_connected', returnPath });
      return;
    }

    // --- Unauthenticated restore flow ---
    useDriveBackupStore.getState().setRestoreTokens({
      accessToken: tokens.accessToken,
      email: tokens.email,
      displayName: tokens.displayName,
    });

    setPageState({ status: 'success_restore' });
  }

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  if (pageState.status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">Connecting Google Drive…</p>
        <p className="text-xs text-muted-foreground">Please wait, this only takes a moment.</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error
  // ---------------------------------------------------------------------------

  if (pageState.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 bg-background px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <XCircle className="w-16 h-16 text-destructive" aria-hidden="true" />
          <h1 className="text-lg font-semibold text-foreground">Connection Failed</h1>
          <p className="text-sm text-muted-foreground max-w-xs">{pageState.message}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            void navigate(pageState.returnPath.startsWith('/') ? pageState.returnPath : ROUTES.SETTINGS);
          }}
          className="h-10 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Go Back
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Success — connected (authenticated flow)
  // ---------------------------------------------------------------------------

  if (pageState.status === 'success_connected') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 bg-background px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="w-16 h-16 text-[hsl(var(--chart-4))]" aria-hidden="true" />
          <h1 className="text-lg font-semibold text-foreground">Google Drive Connected!</h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            Your data will be automatically backed up every day. Your first backup is running in the background.
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            type="button"
            onClick={() => { void navigate(ROUTES.SETTINGS); }}
            className="h-10 w-full rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <HardDrive className="w-4 h-4" aria-hidden="true" />
            Go to Settings
          </button>
          <button
            type="button"
            onClick={() => { void navigate(ROUTES.DASHBOARD); }}
            className="h-10 w-full rounded-xl border border-border bg-background text-sm font-medium hover:bg-muted/60 transition-all"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Success — restore flow (unauthenticated)
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 bg-background px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="w-16 h-16 text-[hsl(var(--chart-4))]" aria-hidden="true" />
        <h1 className="text-lg font-semibold text-foreground">Google Account Connected</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          Now choose a backup to restore. You'll need the password you used when the backup was created.
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          type="button"
          onClick={() => { void navigate('/login?restore=true'); }}
          className="h-10 w-full rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          Select Backup to Restore
        </button>
      </div>
    </div>
  );
}
