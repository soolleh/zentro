import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Fingerprint, Info, Loader2 } from 'lucide-react';
import { DriveRestorePrompt } from '@/features/google/components/DriveRestorePrompt';
import { BackupListPanel } from '@/features/google/components/BackupListPanel';
import { useDriveRestoreFlow } from '@/app/stores/drive-backup.store';
import { AuthBackground } from '../components/AuthBackground';
import { AuthWordmark } from '../components/AuthWordmark';
import { AuthCard } from '../components/AuthCard';
import { UserAvatar } from '../components/UserAvatar';
import { PasswordInput } from '../components/PasswordInput';
import { FormError } from '../components/FormError';
import { loginUser } from '@/services/auth/auth.service';
import { buildDefaultSettings } from '@/services/auth/auth.constants';
import { userStorage } from '@/services/storage/user.storage';
import { settingsStorage } from '@/services/storage/settings.storage';
import { biometricStorage } from '@/services/storage/biometric.storage';
import {
  isPlatformAuthenticatorAvailable,
  verifyBiometric,
  decryptKeyFromBiometric,
} from '@/services/auth/webauthn.service';
import { useSessionStore } from '@/app/stores/session.store';
import { usePreferencesStore } from '@/app/preferences.store';
import { ROUTES } from '@/app/routes.constants';
import type { LocalUser, BiometricCredential } from '@/shared/types/user.types';

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------
const LABELS = {
  HEADING: 'Welcome back',
  HEADING_NO_USERS: 'Welcome to Zentro',
  SUBTEXT_NO_USERS: 'No accounts found on this device.',
  EMAIL: 'Email address',
  PASSWORD: 'Password',
  SUBMIT: 'Sign in',
  SUBMIT_LOADING: 'Signing in…',
  REGISTER_PROMPT: 'New to Zentro?',
  REGISTER_LINK: 'Create a local account',
  ACCOUNTS_SECTION: 'Accounts on this device',
  DIVIDER: 'or sign in with password',
  USE_BIOMETRIC: 'Use Face ID / Touch ID',
  BIOMETRIC_WAITING: 'Waiting for biometric…',
  BIOMETRIC_UNAVAILABLE: 'Biometric unavailable. Use your password.',
  OR_DIVIDER: 'or',
} as const;

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------
const loginSchema = z.object({
  email: z.email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// LoginPage
// ---------------------------------------------------------------------------
export function LoginPage() {
  const navigate = useNavigate();
  const storeLogin = useSessionStore((s) => s.login);
  const loadPreferences = usePreferencesStore((s) => s.loadPreferences);

  const [users, setUsers] = useState<LocalUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<LocalUser | null>(null);
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // --- Biometric state
  const [enrolledCredential, setEnrolledCredential] = useState<BiometricCredential | null>(null);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricNotice, setBiometricNotice] = useState<string | null>(null);
  const autoTriggered = useRef(false);

  // Load existing local users on mount
  useEffect(() => {
    void (async () => {
      const result = await userStorage.listUsers();
      setLoadingUsers(false);
      if (result.success) {
        setUsers(result.data);
        if (result.data.length === 1) {
          setSelectedUser(result.data.at(0) ?? null);
        }
      }
    })();
  }, []);

  // Check biometric availability whenever the selected user changes
  useEffect(() => {
    setEnrolledCredential(null);
    setBiometricNotice(null);
    autoTriggered.current = false;
    if (!selectedUser) return;

    let cancelled = false;
    void (async () => {
      const [platformAvailable, credentialResult] = await Promise.all([
        isPlatformAuthenticatorAvailable(),
        biometricStorage.getBiometricCredentialByUser(selectedUser.id),
      ]);
      if (cancelled) return;
      if (platformAvailable && credentialResult.success && credentialResult.data) {
        setEnrolledCredential(credentialResult.data);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedUser]);

  // Auto-trigger biometric prompt once credential is known
  useEffect(() => {
    if (!enrolledCredential || autoTriggered.current) return;
    autoTriggered.current = true;
    const timer = setTimeout(() => { void handleBiometricLogin(); }, 300);
    return () => { clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrolledCredential]);

  // Shared post-auth flow: load settings and complete the login
  const completeLogin = useCallback(
    async (user: LocalUser, derivedKey: CryptoKey) => {
      const settingsResult = await settingsStorage.getSettingsByUser(user.id, derivedKey);
      const timeoutMinutes = settingsResult.success
        ? settingsResult.data.inactivityTimeoutMinutes
        : 5;
      storeLogin(user, derivedKey, timeoutMinutes);
      if (settingsResult.success) {
        loadPreferences(settingsResult.data);
      } else if (settingsResult.error.code === 'SETTINGS_NOT_FOUND') {
        const now = new Date().toISOString() as Parameters<typeof buildDefaultSettings>[1];
        const defaults = buildDefaultSettings(user.id, now);
        void settingsStorage.upsertSettings(defaults, derivedKey);
      }
      void navigate(ROUTES.DASHBOARD);
    },
    [storeLogin, loadPreferences, navigate],
  );

  // Biometric login handler
  const handleBiometricLogin = useCallback(async () => {
    if (!enrolledCredential || !selectedUser || biometricLoading) return;
    setBiometricLoading(true);
    setBiometricNotice(null);

    const verifyResult = await verifyBiometric({ credentialId: enrolledCredential.credentialId });
    if (!verifyResult.success) {
      setBiometricLoading(false);
      if (verifyResult.error.code !== 'WEBAUTHN_USER_CANCELLED') {
        setBiometricNotice(LABELS.BIOMETRIC_UNAVAILABLE);
      }
      return;
    }

    const keyResult = await decryptKeyFromBiometric(verifyResult.data.encryptedKeyBlob);
    if (!keyResult.success) {
      setBiometricLoading(false);
      setBiometricNotice(LABELS.BIOMETRIC_UNAVAILABLE);
      return;
    }

    await completeLogin(selectedUser, keyResult.data);
    setBiometricLoading(false);
  }, [enrolledCredential, selectedUser, biometricLoading, completeLogin]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
  });

  async function onSubmit(values: LoginFormValues) {
    setFormError(undefined);
    const authResult = await loginUser({ email: values.email, password: values.password });
    if (!authResult.success) {
      setFormError(authResult.error.message);
      return;
    }
    await completeLogin(authResult.data.user, authResult.data.derivedKey);
  }

  const noAccounts = !loadingUsers && users.length === 0;
  const hasUsers = !loadingUsers && users.length > 0;
  const isBiometricAvailable = !!enrolledCredential && !!selectedUser;

  // ── Drive restore flow ────────────────────────────────────────────────────
  const { restoreTokens, clearRestoreSession } = useDriveRestoreFlow();
  const [restorePanelOpen, setRestorePanelOpen] = useState(false);

  // Auto-open the backup list panel when restore tokens land from OAuth callback
  useEffect(() => {
    if (restoreTokens) {
      setRestorePanelOpen(true);
    }
  }, [restoreTokens]);

  return (
    <AuthBackground>
      <AuthCard>
        {/* Card header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <AuthWordmark />
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {noAccounts ? LABELS.HEADING_NO_USERS : LABELS.HEADING}
          </h1>
          {noAccounts && (
            <p className="text-sm text-muted-foreground">{LABELS.SUBTEXT_NO_USERS}</p>
          )}
        </div>

        {/* User switcher — shown when there are existing accounts */}
        {hasUsers && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {LABELS.ACCOUNTS_SECTION}
            </p>
            <div
              className="flex gap-2 overflow-x-auto pb-1"
              role="group"
              aria-label={LABELS.ACCOUNTS_SECTION}
            >
              {users.map((u) => (
                <div key={u.id} className="flex flex-col items-center gap-1.5 shrink-0 w-16">
                  <UserAvatar
                    displayName={u.displayName}
                    size="md"
                    selected={selectedUser?.id === u.id}
                    onClick={() => { setSelectedUser(u); }}
                  />
                  <span
                    className="text-xs text-muted-foreground text-center truncate w-full cursor-pointer"
                    onClick={() => { setSelectedUser(u); }}
                  >
                    {u.displayName}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Divider — between user switcher and sign-in section */}
        {hasUsers && (
          <div className="flex items-center gap-3" aria-hidden="true">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">
              {isBiometricAvailable ? LABELS.OR_DIVIDER : LABELS.DIVIDER}
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>
        )}

        {/* Biometric sign-in — shown when an enrolled credential exists for the selected user */}
        {isBiometricAvailable && (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => { void handleBiometricLogin(); }}
              disabled={biometricLoading || isSubmitting}
              className="h-12 w-full flex items-center justify-center gap-2.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Sign in with biometrics"
            >
              {biometricLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              ) : (
                <Fingerprint className="w-5 h-5" aria-hidden="true" />
              )}
              {biometricLoading ? LABELS.BIOMETRIC_WAITING : LABELS.USE_BIOMETRIC}
            </button>
            {biometricNotice && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground" role="status">
                <Info className="w-3 h-3 shrink-0" aria-hidden="true" />
                {biometricNotice}
              </p>
            )}
          </div>
        )}

        {/* Divider between biometric and password form */}
        {isBiometricAvailable && (
          <div className="flex items-center gap-3" aria-hidden="true">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">{LABELS.DIVIDER}</span>
            <div className="flex-1 h-px bg-border" />
          </div>
        )}

        {/* Password form */}
        {!noAccounts && (
          <form
            onSubmit={(e) => { void handleSubmit(onSubmit)(e); }}
            noValidate
            className="flex flex-col gap-4"
            aria-label={LABELS.HEADING}
          >
            {/* Email field */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                {LABELS.EMAIL}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className={[
                  'h-10 w-full rounded-lg border bg-background px-3 text-sm text-foreground',
                  'placeholder:text-muted-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:shadow-sm',
                  'transition-colors duration-100',
                  errors.email
                    ? 'border-destructive focus-visible:ring-destructive'
                    : 'border-input hover:border-ring',
                ].join(' ')}
                {...register('email')}
              />
              {errors.email && (
                <p id="email-error" role="alert" className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <PasswordInput
              label={LABELS.PASSWORD}
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />

            <FormError message={formError} />

            <button
              type="submit"
              disabled={isSubmitting}
              className={[
                'h-10 w-full rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground',
                'flex items-center justify-center gap-2',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                'transition-opacity duration-100',
                isSubmitting ? 'cursor-not-allowed opacity-60' : 'hover:opacity-90 active:opacity-80',
              ].join(' ')}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  {LABELS.SUBMIT_LOADING}
                </>
              ) : (
                LABELS.SUBMIT
              )}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          {LABELS.REGISTER_PROMPT}{' '}
          <Link to={ROUTES.REGISTER} className="font-medium text-primary hover:underline">
            {LABELS.REGISTER_LINK}
          </Link>
        </p>
      </AuthCard>

      {/* Drive restore prompt — shown on fresh device with no local accounts */}
      {noAccounts && <DriveRestorePrompt />}

      {/* Backup list panel — auto-opened after returning from OAuth restore flow */}
      <BackupListPanel
        open={restorePanelOpen}
        onClose={() => {
          setRestorePanelOpen(false);
          clearRestoreSession();
        }}
      />
    </AuthBackground>
  );
}