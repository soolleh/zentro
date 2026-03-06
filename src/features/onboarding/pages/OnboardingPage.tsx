import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { AuthBackground } from '@/features/auth/components/AuthBackground';
import { AuthWordmark } from '@/features/auth/components/AuthWordmark';
import { useCurrentUser, useDerivedKey } from '@/app/stores/session.store';
import {
  useOnboardingStep,
  useOnboardingStatus,
  useOnboardingStore,
} from '@/app/stores/onboarding.store';
import { markOnboardingComplete } from '@/services/onboarding/onboarding.service';
import { ROUTES } from '@/app/routes.constants';
import { StepTransition } from '../components/StepTransition';
import { Step1Account } from '../components/Step1Account';
import { Step2Income } from '../components/Step2Income';
import { Step3Budget } from '../components/Step3Budget';
import { Step4Complete } from '../components/Step4Complete';

const STEP_LABELS: Record<number, string> = {
  1: 'Add your account',
  2: 'Record your income',
  3: 'Set a budget',
  4: "You're all set",
};

const TOTAL_STEPS = 4;

function StepDot({ index, currentStep }: { index: number; currentStep: number }) {
  const isComplete = index < currentStep;
  const isCurrent = index === currentStep;
  return (
    <div
      aria-hidden="true"
      className={[
        'rounded-full h-1.5 transition-all duration-300',
        isComplete ? 'bg-primary/60 w-1.5' : '',
        isCurrent ? 'bg-primary w-6' : '',
        !isComplete && !isCurrent ? 'bg-border w-1.5' : '',
      ].join(' ')}
    />
  );
}

function renderStep(step: number) {
  switch (step) {
    case 1: return <Step1Account />;
    case 2: return <Step2Income />;
    case 3: return <Step3Budget />;
    case 4: return <Step4Complete />;
    default: return null;
  }
}

export function OnboardingPage() {
  const currentUser = useCurrentUser();
  const derivedKey = useDerivedKey();
  const navigate = useNavigate();
  const { currentStep, direction, prevStep, nextStep } = useOnboardingStep();
  const { isSubmitting, stepError, setSubmitting, setStepError } = useOnboardingStatus();
  const reset = useOnboardingStore((s) => s.reset);

  const progressPct = (currentStep / TOTAL_STEPS) * 100;

  const handleComplete = useCallback(async () => {
    if (!currentUser || !derivedKey) return;
    setSubmitting(true);
    setStepError(null);
    try {
      const result = await markOnboardingComplete(currentUser.id, derivedKey);
      if (!result.success) {
        setStepError(result.error.message);
        return;
      }
      reset();
      void navigate(ROUTES.DASHBOARD, { replace: true });
    } finally {
      setSubmitting(false);
    }
  }, [currentUser, derivedKey, navigate, reset, setStepError, setSubmitting]);

  return (
    <AuthBackground>
      <div className="w-full max-w-[520px] mx-auto">
        <div className="bg-card border border-border rounded-2xl shadow-md flex flex-col overflow-hidden">

          {/* Card header */}
          <div className="px-6 pt-5 pb-4 flex flex-col gap-4 border-b border-border">
            {/* Wordmark + dots */}
            <div className="flex items-center justify-between">
              <AuthWordmark size="sm" />
              {/* Skip setup — visible on steps 1-3 */}
              {currentStep < 4 && (
                <button
                  type="button"
                  onClick={() => { void handleComplete(); }}
                  disabled={isSubmitting}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150 underline-offset-2 hover:underline disabled:opacity-40"
                >
                  Skip setup
                </button>
              )}
              <div
                className="flex items-center gap-1.5"
                role="progressbar"
                aria-valuenow={currentStep}
                aria-valuemin={1}
                aria-valuemax={TOTAL_STEPS}
                aria-label={`Step ${String(currentStep)} of ${String(TOTAL_STEPS)}`}
              >
                {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                  <StepDot key={i + 1} index={i + 1} currentStep={currentStep} />
                ))}
              </div>
            </div>

            {/* Step label + progress bar */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {STEP_LABELS[currentStep]}
              </p>
              <div className="h-0.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${String(progressPct)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Step content */}
          <div className="px-6 py-5 overflow-y-auto max-h-[calc(100vh-280px)]">
            <StepTransition step={currentStep} direction={direction}>
              {renderStep(currentStep)}
            </StepTransition>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
            {/* Back button */}
            {currentStep > 1 && currentStep < 4 ? (
              <button
                type="button"
                onClick={prevStep}
                disabled={isSubmitting}
                className={[
                  'flex items-center gap-1.5 text-sm font-medium text-muted-foreground',
                  'hover:text-foreground transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                ].join(' ')}
                aria-label="Go back"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <div />
            )}

            {/* Primary action */}
            {currentStep < 4 ? (
              <div className="flex items-center gap-4">
                {/* Skip this step */}
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={isSubmitting}
                  className={[
                    'text-sm text-muted-foreground hover:text-foreground',
                    'transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                  ].join(' ')}
                >
                  Skip
                </button>
                {/* Continue */}
                <button
                  type="submit"
                  form="onboarding-step-form"
                  disabled={isSubmitting}
                  className={[
                    'inline-flex items-center gap-2 px-6 h-10 rounded-lg text-sm font-semibold',
                    'bg-primary text-primary-foreground',
                    'hover:bg-primary/90 active:scale-[0.98] transition-all duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    'disabled:opacity-60 disabled:cursor-not-allowed',
                  ].join(' ')}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    'Continue'
                  )}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { void handleComplete(); }}
                disabled={isSubmitting}
                className={[
                  'inline-flex items-center gap-2 px-6 h-10 rounded-lg text-sm font-semibold',
                  'bg-primary text-primary-foreground',
                  'hover:bg-primary/90 active:scale-[0.98] transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'disabled:opacity-60 disabled:cursor-not-allowed',
                ].join(' ')}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Setting up…
                  </>
                ) : (
                  'Go to Dashboard'
                )}
              </button>
            )}
          </div>

          {/* Step error (shown outside form for step 4) */}
          {currentStep === 4 && stepError && (
            <div className="px-6 pb-4">
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive" role="alert">
                {stepError}
              </div>
            </div>
          )}
        </div>
      </div>
    </AuthBackground>
  );
}

