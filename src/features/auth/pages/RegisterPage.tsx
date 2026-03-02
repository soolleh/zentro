import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { AuthCard } from '../components/AuthCard';
import { PasswordInput } from '../components/PasswordInput';
import { FormError } from '../components/FormError';
import { registerUser } from '@/services/auth/auth.service';
import {
  getPasswordStrength,
  PASSWORD_MIN_LENGTH,
} from '@/services/auth/auth.constants';
import { useSessionStore } from '@/app/stores/session.store';
import { ROUTES } from '@/app/routes.constants';

// ---------------------------------------------------------------------------
// Labels (no hardcoded strings in JSX)
// ---------------------------------------------------------------------------
const LABELS = {
  HEADING: 'Create your account',
  SUBHEADING: 'Your data stays on this device — always.',
  DISPLAY_NAME: 'Display name',
  EMAIL: 'Email address',
  PASSWORD: 'Password',
  CONFIRM_PASSWORD: 'Confirm password',
  SUBMIT: 'Create account',
  SUBMIT_LOADING: 'Creating account…',
  LOGIN_PROMPT: 'Already have an account?',
  LOGIN_LINK: 'Sign in',
  PASSWORD_STRENGTH_LABEL: 'Password strength',
  STRENGTH_LABELS: ['', 'Weak', 'Fair', 'Good', 'Strong'] as const,
} as const;

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------
const registerSchema = z
  .object({
    displayName: z
      .string()
      .min(2, 'Display name must be at least 2 characters.')
      .max(50, 'Display name must be at most 50 characters.'),
    email: z.email('Please enter a valid email address.'),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Password must be at least ${String(PASSWORD_MIN_LENGTH)} characters.`)
      .refine((v) => /[A-Z]/.test(v), 'Must include at least one uppercase letter.')
      .refine((v) => /[a-z]/.test(v), 'Must include at least one lowercase letter.')
      .refine((v) => /[0-9]/.test(v), 'Must include at least one number.')
      .refine((v) => /[^A-Za-z0-9]/.test(v), 'Must include at least one special character.'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

// ---------------------------------------------------------------------------
// Password strength meter
// ---------------------------------------------------------------------------
const STRENGTH_COLORS = [
  '',
  'bg-destructive',
  'bg-amber-500',
  'bg-[hsl(35_90%_55%)]',
  'bg-[hsl(155_65%_42%)]',
] as const;

type StrengthMeterProps = { readonly password: string };

function StrengthMeter({ password }: StrengthMeterProps) {
  const strength = getPasswordStrength(password);
  const color = STRENGTH_COLORS[strength];
  const label = LABELS.STRENGTH_LABELS[strength];

  return (
    <div className="flex flex-col gap-1" aria-label={LABELS.PASSWORD_STRENGTH_LABEL}>
      <div className="flex gap-1" role="progressbar" aria-valuenow={strength} aria-valuemin={0} aria-valuemax={4}>
        {([1, 2, 3, 4] as const).map((tier) => (
          <div
            key={tier}
            className={[
              'h-1.5 flex-1 rounded-full transition-colors duration-200',
              strength >= tier ? color : 'bg-muted',
            ].join(' ')}
          />
        ))}
      </div>
      {label && (
        <p className={['text-xs font-medium', strength <= 1 ? 'text-destructive' : strength === 2 ? 'text-amber-500' : 'text-[hsl(155_65%_42%)]'].join(' ')}>
          {label}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RegisterPage
// ---------------------------------------------------------------------------
export function RegisterPage() {
  const navigate = useNavigate();
  const login = useSessionStore((s) => s.login);
  const [formError, setFormError] = useState<string | undefined>(undefined);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
  });

  const passwordValue = watch('password', '');

  async function onSubmit(values: RegisterFormValues) {
    setFormError(undefined);
    const result = await registerUser({
      displayName: values.displayName,
      email: values.email,
      password: values.password,
    });
    if (!result.success) {
      setFormError(result.error.message);
      return;
    }
    login(result.data.user, result.data.derivedKey, 5);
    void navigate(ROUTES.ONBOARDING);
  }

  return (
    <AuthCard>
      <form
        onSubmit={(e) => { void handleSubmit(onSubmit)(e); }}
        noValidate
        className="flex flex-col gap-5"
        aria-label={LABELS.HEADING}
      >
        <header className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-foreground">{LABELS.HEADING}</h1>
          <p className="text-sm text-muted-foreground">{LABELS.SUBHEADING}</p>
        </header>

        {/* Display name */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="displayName" className="text-sm font-medium text-foreground">
            {LABELS.DISPLAY_NAME}
          </label>
          <input
            id="displayName"
            type="text"
            autoComplete="name"
            aria-invalid={Boolean(errors.displayName)}
            aria-describedby={errors.displayName ? 'displayName-error' : undefined}
            className={[
              'w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground',
              'placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
              'transition-colors duration-100',
              errors.displayName
                ? 'border-destructive focus:ring-destructive'
                : 'border-input hover:border-ring',
            ].join(' ')}
            {...register('displayName')}
          />
          {errors.displayName && (
            <p id="displayName-error" role="alert" className="text-xs text-destructive">
              {errors.displayName.message}
            </p>
          )}
        </div>

        {/* Email */}
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

        {/* Password + strength meter */}
        <div className="flex flex-col gap-2">
          <PasswordInput
            label={LABELS.PASSWORD}
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
          {passwordValue.length > 0 && <StrengthMeter password={passwordValue} />}
        </div>

        {/* Confirm password */}
        <PasswordInput
          label={LABELS.CONFIRM_PASSWORD}
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        {/* Form-level error */}
        <FormError message={formError} />

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={[
            'w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
            'transition-opacity duration-100',
            isSubmitting ? 'cursor-not-allowed opacity-60' : 'hover:opacity-90 active:opacity-80',
          ].join(' ')}
        >
          {isSubmitting ? LABELS.SUBMIT_LOADING : LABELS.SUBMIT}
        </button>

        <p className="text-center text-sm text-muted-foreground">
          {LABELS.LOGIN_PROMPT}{' '}
          <Link to={ROUTES.LOGIN} className="font-medium text-primary hover:underline">
            {LABELS.LOGIN_LINK}
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
