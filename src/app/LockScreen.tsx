import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Fingerprint, Lock, User, Info, Loader2 } from 'lucide-react';
import { AuthWordmark } from '@/features/auth/components/AuthWordmark';
import { PasswordInput } from '@/features/auth/components/PasswordInput';
import { FormError } from '@/features/auth/components/FormError';
import { useSessionStore, useCurrentUser } from '@/app/session.store';
import { biometricStorage } from '@/services/storage/biometric.storage';
import {
  isPlatformAuthenticatorAvailable,
  verifyBiometric,
  decryptKeyFromBiometric,
} from '@/services/auth/webauthn.service';
import { unlockWithPassword } from '@/services/auth/auth.service';
import { ROUTES } from '@/app/routes.constants';
import type { BiometricCredential } from '@/shared/types/user.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LABELS = {
  SESSION_LOCKED: 'Session locked',
  LOCKED_AS: 'Locked as',
  USE_BIOMETRIC: 'Use biometrics',
  BIOMETRIC_WAITING: 'Waiting for biometric…',
  BIOMETRIC_UNAVAILABLE: 'Biometric unavailable. Use your password.',
  PASSWORD_LABEL: 'Password',
  UNLOCK: 'Unlock',
  UNLOCKING: 'Unlocking…',
  SIGN_OUT: 'Not you? Sign out',
  WRONG_PASSWORD: 'Incorrect password.',
  UNLOCK_FAILED: 'Failed to unlock. Please try again.',
  OR_DIVIDER: 'or',
} as const;

// ---------------------------------------------------------------------------
// LockScreen
// ---------------------------------------------------------------------------

export function LockScreen() {
  const navigate = useNavigate();
  const unlock = useSessionStore((s) => s.unlock);
  const logout = useSessionStore((s) => s.logout);
  const currentUser = useCurrentUser();

  // --- Biometric state
  const [enrolledCredential, setEnrolledCredential] = useState<BiometricCredential | null>(null);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricNotice, setBiometricNotice] = useState<string | null>(null);
  const autoTriggered = useRef(false);

  // --- Password form state
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  // --- Check biometric availability on mount
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;

    async function check() {
      if (!currentUser) return;
      const [platformAvailable, credentialResult] = await Promise.all([
        isPlatformAuthenticatorAvailable(),
        biometricStorage.getBiometricCredentialByUser(currentUser.id),
      ]);

      if (cancelled) return;

      if (platformAvailable && credentialResult.success && credentialResult.data) {
        setEnrolledCredential(credentialResult.data);
      } else {
        // No biometric — focus password immediately
        passwordRef.current?.focus();
      }
    }

    void check();
    return () => { cancelled = true; };
  }, [currentUser]);

  // --- Auto-trigger biometric after 300ms once credential is known
  useEffect(() => {
    if (!enrolledCredential || autoTriggered.current) return;
    autoTriggered.current = true;
    const timer = setTimeout(() => { void handleBiometricUnlock(); }, 300);
    return () => { clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrolledCredential]);

  // --- Biometric unlock handler
  const handleBiometricUnlock = useCallback(async () => {
    if (!enrolledCredential || biometricLoading) return;
    setBiometricLoading(true);
    setBiometricNotice(null);

    const verifyResult = await verifyBiometric({ credentialId: enrolledCredential.credentialId });

    if (!verifyResult.success) {
      setBiometricLoading(false);
      if (verifyResult.error.code === 'WEBAUTHN_USER_CANCELLED') {
        // Silent — user chose to cancel; focus password instead
        passwordRef.current?.focus();
      } else {
        setBiometricNotice(LABELS.BIOMETRIC_UNAVAILABLE);
        passwordRef.current?.focus();
      }
      return;
    }

    const keyResult = await decryptKeyFromBiometric(verifyResult.data.encryptedKeyBlob);
    setBiometricLoading(false);

    if (!keyResult.success) {
      setBiometricNotice(LABELS.BIOMETRIC_UNAVAILABLE);
      passwordRef.current?.focus();
      return;
    }

    unlock(keyResult.data);
  }, [enrolledCredential, biometricLoading, unlock]);

  // --- Password unlock handler
  async function handlePasswordUnlock(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!currentUser || submitting) return;

    setSubmitting(true);
    setPasswordError(undefined);

    const result = await unlockWithPassword(currentUser.id, password);
    setSubmitting(false);

    if (!result.success) {
      setPasswordError(
        result.error.code === 'INVALID_CREDENTIALS' ? LABELS.WRONG_PASSWORD : LABELS.UNLOCK_FAILED
      );
      return;
    }

    unlock(result.data);
  }

  // --- Sign out handler
  function handleSignOut() {
    logout();
    void navigate(ROUTES.LOGIN, { replace: true });
  }

  const displayName = currentUser?.displayName ?? '';
  const isBusy = submitting || biometricLoading;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center min-h-screen animate-in fade-in-0 duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={LABELS.SESSION_LOCKED}
    >
      {/* Card */}
      <div className="w-full max-w-[400px] mx-4 sm:mx-0 bg-card border border-border rounded-xl shadow-lg p-6 sm:p-8 flex flex-col items-center gap-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-300">

        {/* Header */}
        <div className="flex flex-col items-center gap-3">
          <AuthWordmark />
          {/* Lock icon badge */}
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Lock className="w-7 h-7 text-muted-foreground" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">{LABELS.SESSION_LOCKED}</h2>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <User className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {LABELS.LOCKED_AS} {displayName}
          </p>
        </div>

        {/* Biometric section */}
        {enrolledCredential && (
          <div className="flex flex-col items-center gap-2 w-full">
            <button
              type="button"
              onClick={() => { void handleBiometricUnlock(); }}
              disabled={isBusy}
              className="h-11 w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-card hover:bg-muted/50 text-sm font-medium text-foreground transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Authenticate with biometrics"
            >
              {biometricLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" aria-hidden="true" />
              ) : (
                <Fingerprint
                  className={`w-5 h-5 text-primary${!autoTriggered.current ? ' animate-pulse' : ''}`}
                  aria-hidden="true"
                />
              )}
              {biometricLoading ? LABELS.BIOMETRIC_WAITING : LABELS.USE_BIOMETRIC}
            </button>

            {biometricNotice && (
              <p
                className="flex items-center justify-center gap-1 text-xs text-muted-foreground animate-in fade-in-0 duration-150"
                role="status"
              >
                <Info className="w-3 h-3 shrink-0" aria-hidden="true" />
                {biometricNotice}
              </p>
            )}
          </div>
        )}

        {/* Divider */}
        {enrolledCredential && (
          <div className="flex items-center gap-3 w-full" aria-hidden="true">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">{LABELS.OR_DIVIDER}</span>
            <div className="flex-1 h-px bg-border" />
          </div>
        )}

        {/* Password form */}
        <form
          onSubmit={(e) => { void handlePasswordUnlock(e); }}
          className="w-full flex flex-col gap-3"
          noValidate
        >
          <FormError message={passwordError} />

          <PasswordInput
            ref={passwordRef}
            label={LABELS.PASSWORD_LABEL}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setPasswordError(undefined); }}
            autoComplete="current-password"
            disabled={isBusy}
            autoFocus={!enrolledCredential}
          />

          <button
            type="submit"
            disabled={isBusy || password.length === 0}
            className="h-10 w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                {LABELS.UNLOCKING}
              </>
            ) : (
              LABELS.UNLOCK
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="w-full pt-4 border-t border-border flex justify-center">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isBusy}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:underline disabled:opacity-50"
          >
            {LABELS.SIGN_OUT}
          </button>
        </div>
      </div>
    </div>
  );
}
