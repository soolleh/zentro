/**
 * DriveRestorePrompt.tsx
 *
 * Shown on the login page when Zentro detects no local user data but
 * a google_tokens record exists in IDB (encrypted, presence-only check).
 *
 * Allows the user to initiate OAuth and then restore from a Drive backup.
 */

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { GoogleDriveIcon } from './GoogleDriveIcon';
import { initiateOAuthFlow } from '@/services/google/oauth.service';
import { isGoogleDriveConfigured } from '@/config/env';

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

const LABELS = {
  HEADING: 'Restore from Google Drive',
  DESCRIPTION: 'No local data found. You may have a backup stored on Google Drive.',
  BUTTON: 'Connect & Restore',
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DriveRestorePrompt() {
  const [error, setError] = useState<string | null>(null);

  if (!isGoogleDriveConfigured) return null;

  async function handleClick() {
    setError(null);
    try {
      const returnPath = '/login?restore=true';
      sessionStorage.setItem('zentro_drive_return_path', returnPath);
      await initiateOAuthFlow(returnPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Google sign-in.');
    }
  }

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-300 rounded-2xl border border-border bg-card p-4 mt-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <GoogleDriveIcon size={16} />
        <span className="text-sm font-semibold text-foreground">{LABELS.HEADING}</span>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground">{LABELS.DESCRIPTION}</p>

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Connect & Restore button */}
      <button
        type="button"
        onClick={() => { void handleClick(); }}
        className="w-full h-9 rounded-xl border border-border bg-background flex items-center justify-center gap-2 text-sm font-medium hover:bg-muted/60 transition-all duration-150"
      >
        <GoogleDriveIcon size={16} />
        {LABELS.BUTTON}
      </button>
    </div>
  );
}
