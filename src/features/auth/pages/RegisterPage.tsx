import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { AuthBackground } from '../components/AuthBackground';
import { AuthWordmark } from '../components/AuthWordmark';
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
  SUBHEADING: 'Your data stays on this device. Never transmitted, never shared.',
  DISPLAY_NAME: 'Display name',
  EMAIL: 'Email address',
  EMAIL_HINT: 'Used locally to identify your profile.',
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
const STRENGTH_SEGMENT_COLORS = [
  '',
  'bg-destructive',
  'bg-amber-400',
  'bg-[hsl(var(--chart-3))]',
  'bg-[hsl(var(--chart-4))]',
] as const;

const STRENGTH_LABEL_COLORS = [
  '',
  'text-destructive',
  'text-amber-500',
  'text-[hsl(var(--chart-3))]',
  'text-[hsl(var(--chart-4))]',
] as const;

type StrengthMeterProps = { readonly password: string };

function StrengthMeter({ password }: StrengthMeterProps) {
  const strength = getPasswordStrength(password);
  const segmentColor = STRENGTH_SEGMENT_COLORS[strength];
  const labelColor = STRENGTH_LABEL_COLORS[strength];
  const label = LABELS.STRENGTH_LABELS[strength];

  return (
    <div className="flex flex-col gap-1.5" aria-label={LABELS.PASSWORD_STRENGTH_LABEL}>
      <div className="flex gap-1" role="progressbar" aria-valuenow={strength} aria-valuemin={0} aria-valuemax={4}>
        {([1, 2, 3, 4] as const).map((tier) => (
          <div
            key={tier}
            className={[
              'h-1 flex-1 rounded-full transition-colors duration-200',
              strength >= tier ? segmentColor : 'bg-muted',
            ].join(' ')}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{LABELS.PASSWORD_STRENGTH_LABEL}</span>
        {label && (
          <span className={`text-xs font-medium ${labelColor}`}>{label}</span>
        )}
      </div>
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

  // eslint-disable-next-line react-hooks/incompatible-library
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
    <AuthBackground>
      <AuthCard>
        {/* Card header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <AuthWordmark size="lg" />
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {LABELS.HEADING}
          </h1>
          <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <ShieldCheck
              className="w-3.5 h-3.5 shrink-0 text-[hsl(var(--chart-4))]"
              aria-hidden="true"
            />
            {LABELS.SUBHEADING}
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={(e) => { void handleSubmit(onSubmit)(e); }}
          noValidate
          className="flex flex-col gap-4"
          aria-label={LABELS.HEADING}
        >
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
                'h-10 w-full rounded-lg border bg-background px-3 text-sm text-foreground',
                'placeholder:text-muted-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:shadow-sm',
                'transition-colors duration-100',
                errors.displayName
                  ? 'border-destructive focus-visible:ring-destructive'
                  : 'border-input hover:border-ring',
              ].join(' ')}
              {...register('displayName')}
            />
            {errors.displayName && (
              <p
                id="displayName-error"
                role="alert"
                className="flex items-center gap-1 text-xs text-destructive animate-in fade-in-0 slide-in-from-top-1 duration-150"
              >
                <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
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
              aria-describedby={errors.email ? 'email-error' : 'email-hint'}
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
            {errors.email ? (
              <p
                id="email-error"
                role="alert"
                className="flex items-center gap-1 text-xs text-destructive animate-in fade-in-0 slide-in-from-top-1 duration-150"
              >
                <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
                {errors.email.message}
              </p>
            ) : (
              <p id="email-hint" className="text-xs text-muted-foreground">
                {LABELS.EMAIL_HINT}
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

          <p className="text-center text-sm text-muted-foreground">
            {LABELS.LOGIN_PROMPT}{' '}
            <Link to={ROUTES.LOGIN} className="font-medium text-primary hover:underline">
              {LABELS.LOGIN_LINK}
            </Link>
          </p>
        </form>
      </AuthCard>
    </AuthBackground>
  );
}
