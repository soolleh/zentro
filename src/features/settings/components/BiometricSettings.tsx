import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, ShieldOff, Fingerprint } from 'lucide-react';
import { PasswordInput } from '@/features/auth/components/PasswordInput';
import { FormError } from '@/features/auth/components/FormError';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { useCurrentUser } from '@/app/session.store';
import { biometricStorage } from '@/services/storage/biometric.storage';
import { userStorage } from '@/services/storage/user.storage';
import {
  isPlatformAuthenticatorAvailable,
  enrollBiometric,
  encryptKeyForBiometric,
} from '@/services/auth/webauthn.service';
import {
  unlockWithPassword,
  deriveExtractableCryptoKey,
} from '@/services/auth/auth.service';
import { base64ToBuffer } from '@/services/crypto/crypto.utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LABELS = {
  TITLE: 'Biometric authentication',
  UNSUPPORTED_DESC:
    'Biometric authentication is not available on this device or browser.',
  ENROLL_DESC:
    'Use Face ID, Touch ID, or another biometric method to unlock Zentro without entering your password.',
  SETUP_BUTTON: 'Set up biometrics',
  ENROLLED_LABEL: 'Biometrics enabled',
  ENROLLED_DESC: 'You can unlock Zentro using biometric authentication.',
  REMOVE_BUTTON: 'Remove biometrics',
  CONFIRM_REMOVE_TITLE: 'Remove biometric authentication?',
  CONFIRM_REMOVE_DESC:
    'You will no longer be able to unlock Zentro with biometrics. You must use your password to unlock.',
  CONFIRM_REMOVE_LABEL: 'Remove',
  PASSWORD_LABEL: 'Confirm your password to continue',
  ENROLL_SUBMIT: 'Enable biometrics',
  ENROLLING: 'Setting up…',
  CANCEL: 'Cancel',
  ERROR_GENERIC: 'Something went wrong. Please try again.',
  ERROR_WRONG_PASSWORD: 'Incorrect password.',
} as const;

// ---------------------------------------------------------------------------
// BiometricSettings
// ---------------------------------------------------------------------------

/**
 * BiometricSettings
 *
 * Three possible render states:
 * A — Unsupported: informational callout only.
 * B — Supported, not enrolled: password re-entry + enroll flow.
 * C — Enrolled: enrolled status + remove flow.
 *
 * No props — reads from session store and queries storage directly.
 */
export function BiometricSettings() {
  const currentUser = useCurrentUser();

  // --- Availability / enrollment checks
  const [platformAvailable, setPlatformAvailable] = useState<boolean | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [checking, setChecking] = useState(true);

  // --- Enroll flow state
  const [showEnrollForm, setShowEnrollForm] = useState(false);
  const [enrollPassword, setEnrollPassword] = useState('');
  const [enrollError, setEnrollError] = useState<string | undefined>(undefined);
  const [enrolling, setEnrolling] = useState(false);

  // --- Remove flow state
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | undefined>(undefined);

  // --- On mount: detect platform availability + enrollment status
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;

    async function check() {
      if (!currentUser) return;
      const [available, credentialResult] = await Promise.all([
        isPlatformAuthenticatorAvailable(),
        biometricStorage.getBiometricCredentialByUser(currentUser.id),
      ]);
      if (cancelled) return;
      setPlatformAvailable(available);
      setEnrolled(available && credentialResult.success && credentialResult.data !== null);
      setChecking(false);
    }

    void check();
    return () => { cancelled = true; };
  }, [currentUser]);

  // --- Enroll handler
  const handleEnroll = useCallback(async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser || enrolling) return;

    setEnrolling(true);
    setEnrollError(undefined);

    // 1. Verify password
    const verifyResult = await unlockWithPassword(currentUser.id, enrollPassword);
    if (!verifyResult.success) {
      setEnrolling(false);
      setEnrollError(
        verifyResult.error.code === 'INVALID_CREDENTIALS'
          ? LABELS.ERROR_WRONG_PASSWORD
          : LABELS.ERROR_GENERIC
      );
      return;
    }

    // 2. Derive extractable copy of the key (session key is non-extractable)
    const saltBuffer = base64ToBuffer(currentUser.salt);
    const salt = new Uint8Array(saltBuffer);
    const extractableKeyResult = await deriveExtractableCryptoKey(enrollPassword, salt);
    if (!extractableKeyResult.success) {
      setEnrolling(false);
      setEnrollError(LABELS.ERROR_GENERIC);
      return;
    }

    // 3. Encrypt the raw key bytes with the app-level key
    const blobResult = await encryptKeyForBiometric(extractableKeyResult.data);
    if (!blobResult.success) {
      setEnrolling(false);
      setEnrollError(LABELS.ERROR_GENERIC);
      return;
    }

    // 4. Register the WebAuthn credential (triggers platform biometric prompt)
    const biometricResult = await enrollBiometric({
      userId: currentUser.id,
      userDisplayName: currentUser.displayName,
      emailHash: currentUser.emailHash,
      encryptedKeyBlob: blobResult.data,
    });
    if (!biometricResult.success) {
      setEnrolling(false);
      setEnrollError(LABELS.ERROR_GENERIC);
      return;
    }

    // 5. Persist the credential to IndexedDB
    const saveResult = await biometricStorage.saveBiometricCredential(biometricResult.data);
    if (!saveResult.success) {
      setEnrolling(false);
      setEnrollError(LABELS.ERROR_GENERIC);
      return;
    }

    // 6. Update user record with the credential ID
    const updateResult = await userStorage.updateUser({
      ...currentUser,
      webAuthnCredentialId: biometricResult.data.credentialId,
    });
    if (!updateResult.success) {
      setEnrolling(false);
      setEnrollError(LABELS.ERROR_GENERIC);
      return;
    }

    setEnrolling(false);
    setShowEnrollForm(false);
    setEnrollPassword('');
    setEnrolled(true);
  }, [currentUser, enrollPassword, enrolling]);

  // --- Remove handler
  const handleRemove = useCallback(async () => {
    if (!currentUser || removing) return;

    setRemoving(true);
    setRemoveError(undefined);

    const deleteResult = await biometricStorage.deleteBiometricCredential(currentUser.id);
    if (!deleteResult.success) {
      setRemoving(false);
      setRemoveError(LABELS.ERROR_GENERIC);
      return;
    }

    const updateResult = await userStorage.updateUser({
      ...currentUser,
      webAuthnCredentialId: undefined,
    });
    if (!updateResult.success) {
      setRemoving(false);
      setRemoveError(LABELS.ERROR_GENERIC);
      return;
    }

    setRemoving(false);
    setEnrolled(false);
  }, [currentUser, removing]);

  // --- Loading state
  if (checking) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">Checking biometric support…</p>
      </div>
    );
  }

  // --- State A: Unsupported
  if (!platformAvailable) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <ShieldOff className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
          <h3 className="text-sm font-semibold text-foreground">{LABELS.TITLE}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{LABELS.UNSUPPORTED_DESC}</p>
      </div>
    );
  }

  // --- State C: Enrolled
  if (enrolled) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[hsl(155,65%,42%)] shrink-0" aria-hidden />
          <h3 className="text-sm font-semibold text-foreground">{LABELS.TITLE}</h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[hsl(155,65%,42%)]">
            {LABELS.ENROLLED_LABEL}
          </span>
        </div>
        <p className="text-sm text-muted-foreground -mt-2">{LABELS.ENROLLED_DESC}</p>

        {removeError && <FormError message={removeError} />}

        <button
          type="button"
          onClick={() => { setRemoveDialogOpen(true); }}
          disabled={removing}
          className="self-start rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {LABELS.REMOVE_BUTTON}
        </button>

        <ConfirmDialog
          open={removeDialogOpen}
          onOpenChange={setRemoveDialogOpen}
          title={LABELS.CONFIRM_REMOVE_TITLE}
          description={LABELS.CONFIRM_REMOVE_DESC}
          confirmLabel={LABELS.CONFIRM_REMOVE_LABEL}
          cancelLabel={LABELS.CANCEL}
          onConfirm={() => { void handleRemove(); }}
          destructive
        />
      </div>
    );
  }

  // --- State B: Supported, not enrolled
  return (
    <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Fingerprint className="h-4 w-4 text-primary shrink-0" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">{LABELS.TITLE}</h3>
      </div>

      <p className="text-sm text-muted-foreground">{LABELS.ENROLL_DESC}</p>

      {!showEnrollForm ? (
        <button
          type="button"
          onClick={() => { setShowEnrollForm(true); }}
          className="self-start rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {LABELS.SETUP_BUTTON}
        </button>
      ) : (
        <form onSubmit={(e) => { void handleEnroll(e); }} className="flex flex-col gap-4" noValidate>
          <FormError message={enrollError} />

          <PasswordInput
            label={LABELS.PASSWORD_LABEL}
            value={enrollPassword}
            onChange={(e) => { setEnrollPassword(e.target.value); setEnrollError(undefined); }}
            autoComplete="current-password"
            disabled={enrolling}
            autoFocus
          />

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={enrolling || enrollPassword.length === 0}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {enrolling ? LABELS.ENROLLING : LABELS.ENROLL_SUBMIT}
            </button>
            <button
              type="button"
              onClick={() => { setShowEnrollForm(false); setEnrollPassword(''); setEnrollError(undefined); }}
              disabled={enrolling}
              className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {LABELS.CANCEL}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
