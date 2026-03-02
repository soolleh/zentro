import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
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
import { useSessionStore } from '@/app/stores/session.store';
import { usePreferencesStore } from '@/app/preferences.store';
import { ROUTES } from '@/app/routes.constants';
import type { LocalUser } from '@/shared/types/user.types';

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
  DIVIDER: 'Sign in',
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
    const { user, derivedKey } = authResult.data;

    // Load user settings to determine inactivity timeout
    const settingsResult = await settingsStorage.getSettingsByUser(user.id, derivedKey);
    const timeoutMinutes = settingsResult.success
      ? settingsResult.data.inactivityTimeoutMinutes
      : 5;

    storeLogin(user, derivedKey, timeoutMinutes);

    // Hydrate preferences store from settings (best-effort; non-blocking)
    if (settingsResult.success) {
      loadPreferences(settingsResult.data);
    } else if (settingsResult.error.code === 'SETTINGS_NOT_FOUND') {
      // Settings record missing (e.g. after DB schema migration) — create defaults
      const now = new Date().toISOString() as Parameters<typeof buildDefaultSettings>[1];
      const defaults = buildDefaultSettings(user.id, now);
      void settingsStorage.upsertSettings(defaults, derivedKey);
    }

    void navigate(ROUTES.DASHBOARD);
  }

  const noAccounts = !loadingUsers && users.length === 0;
  const hasUsers = !loadingUsers && users.length > 0;

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

        {/* Divider — between user switcher and form */}
        {hasUsers && (
          <div className="flex items-center gap-3" aria-hidden="true">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">{LABELS.DIVIDER}</span>
            <div className="flex-1 h-px bg-border" />
          </div>
        )}

        {/* Form */}
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
    </AuthBackground>
  );
}