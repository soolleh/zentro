import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { AuthCard } from '../components/AuthCard';
import { PasswordInput } from '../components/PasswordInput';
import { FormError } from '../components/FormError';
import { loginUser } from '@/services/auth/auth.service';
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
  HEADING_NO_ACCOUNTS: 'No accounts found',
  SUBHEADING: 'Sign in to your local account.',
  SUBHEADING_NO_ACCOUNTS: 'Create an account to get started.',
  EMAIL: 'Email address',
  PASSWORD: 'Password',
  SUBMIT: 'Sign in',
  SUBMIT_LOADING: 'Signing in…',
  REGISTER_PROMPT: "Don't have an account?",
  REGISTER_LINK: 'Create one',
  ACCOUNTS_ON_DEVICE: 'Accounts on this device',
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
// Avatar chip helpers
// ---------------------------------------------------------------------------
const AVATAR_COLORS = [
  'bg-[hsl(var(--chart-1))]',
  'bg-[hsl(var(--chart-2))]',
  'bg-[hsl(var(--chart-3))]',
  'bg-[hsl(var(--chart-4))]',
  'bg-[hsl(var(--chart-5))]',
] as const;

function getAvatarColor(displayName: string): string {
  const sum = Array.from(displayName).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]?.[0] ?? '?').toUpperCase();
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

type AvatarChipProps = {
  readonly user: LocalUser;
  readonly selected: boolean;
  readonly onSelect: (user: LocalUser) => void;
};

function AvatarChip({ user, selected, onSelect }: AvatarChipProps) {
  const color = getAvatarColor(user.displayName);
  return (
    <button
      type="button"
      onClick={() => { onSelect(user); }}
      aria-pressed={selected}
      className={[
        'flex flex-col items-center gap-1.5 rounded-xl px-3 py-2 transition-colors duration-100',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
        selected
          ? 'bg-primary/10 ring-2 ring-primary'
          : 'hover:bg-muted',
      ].join(' ')}
    >
      <div
        className={[
          'flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white',
          color,
        ].join(' ')}
        aria-hidden="true"
      >
        {getInitials(user.displayName)}
      </div>
      <span className="max-w-[72px] truncate text-xs text-foreground">
        {user.displayName}
      </span>
    </button>
  );
}

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

    // Hydrate preferences store from settings (best-effort; non-blocking)
    // TODO(Prompt-05): load all preference fields when preferences store is wired
    if (settingsResult.success) {
      loadPreferences(settingsResult.data);
    }

    storeLogin(user, derivedKey, timeoutMinutes);
    void navigate(ROUTES.DASHBOARD);
  }

  const noAccounts = !loadingUsers && users.length === 0;

  return (
    <AuthCard>
      <form
        onSubmit={(e) => { void handleSubmit(onSubmit)(e); }}
        noValidate
        className="flex flex-col gap-5"
        aria-label={LABELS.HEADING}
      >
        <header className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-foreground">
            {noAccounts ? LABELS.HEADING_NO_ACCOUNTS : LABELS.HEADING}
          </h1>
          <p className="text-sm text-muted-foreground">
            {noAccounts ? LABELS.SUBHEADING_NO_ACCOUNTS : LABELS.SUBHEADING}
          </p>
        </header>

        {/* User switcher — shown when there are existing accounts */}
        {!loadingUsers && users.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">{LABELS.ACCOUNTS_ON_DEVICE}</p>
            <div
              className="flex gap-2 overflow-x-auto pb-1"
              role="group"
              aria-label={LABELS.ACCOUNTS_ON_DEVICE}
            >
              {users.map((u) => (
                <AvatarChip
                  key={u.id}
                  user={u}
                  selected={selectedUser?.id === u.id}
                  onSelect={setSelectedUser}
                />
              ))}
            </div>
          </div>
        )}

        {/* Email field — always shown unless there are truly no accounts */}
        {!noAccounts && (
          <>
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
                  'w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground',
                  'placeholder:text-muted-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                  'transition-colors duration-100',
                  errors.email
                    ? 'border-destructive focus:ring-destructive'
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
                'w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                'transition-opacity duration-100',
                isSubmitting
                  ? 'cursor-not-allowed opacity-60'
                  : 'hover:opacity-90 active:opacity-80',
              ].join(' ')}
            >
              {isSubmitting ? LABELS.SUBMIT_LOADING : LABELS.SUBMIT}
            </button>
          </>
        )}

        <p className="text-center text-sm text-muted-foreground">
          {LABELS.REGISTER_PROMPT}{' '}
          <Link to={ROUTES.REGISTER} className="font-medium text-primary hover:underline">
            {LABELS.REGISTER_LINK}
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
