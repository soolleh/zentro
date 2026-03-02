import { CheckCircle2, Lock } from 'lucide-react';
import { useOnboardingData } from '@/app/stores/onboarding.store';
import { ALL_SYSTEM_CATEGORIES } from '@/shared/constants/categories.constants';

const CATEGORY_MAP = new Map(ALL_SYSTEM_CATEGORIES.map((c) => [c.id, c.name]));

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

type RecapCardProps = {
  label: string;
  primary: string;
  secondary: string;
  delay: string;
};

function RecapCard({ label, primary, secondary, delay }: RecapCardProps) {
  return (
    <div
      className={`animate-in fade-in slide-in-from-bottom-2 duration-500 ${delay} rounded-xl border border-border bg-card p-4`}
    >
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="text-base font-semibold text-foreground leading-tight">{primary}</p>
      <p className="text-sm text-muted-foreground mt-0.5">{secondary}</p>
    </div>
  );
}

export function Step4Complete() {
  const { createdAccount, createdTransaction, createdBudget } = useOnboardingData();

  const incomeCategoryName = createdTransaction
    ? (CATEGORY_MAP.get(createdTransaction.categoryId) ?? 'Income')
    : 'Income';

  const budgetCategoryName = createdBudget
    ? (CATEGORY_MAP.get(createdBudget.categoryId) ?? 'Budget')
    : 'Budget';

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Success icon */}
      <div className="animate-in zoom-in-50 duration-500 delay-100 flex items-center justify-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-primary" />
        </div>
      </div>

      {/* Heading */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          You're ready to go.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs">
          Zentro is set up and your data is encrypted on this device.
        </p>
      </div>

      {/* Recap cards */}
      <div className="w-full flex flex-col gap-3">
        {createdAccount && (
          <RecapCard
            label="Account"
            primary={createdAccount.name}
            secondary={`${createdAccount.type} · ${formatCurrency(createdAccount.openingBalance, createdAccount.currency)}`}
            delay="delay-200"
          />
        )}
        {createdTransaction && createdAccount && (
          <RecapCard
            label="Income"
            primary={formatCurrency(createdTransaction.amount, createdAccount.currency)}
            secondary={incomeCategoryName}
            delay="delay-[350ms]"
          />
        )}
        {createdBudget && createdAccount && (
          <RecapCard
            label="Budget"
            primary={budgetCategoryName}
            secondary={`${formatCurrency(createdBudget.amount, createdAccount.currency)} / month`}
            delay="delay-500"
          />
        )}
      </div>

      {/* Privacy strip */}
      <div className="animate-in fade-in duration-500 delay-[600ms] w-full flex items-center gap-2 rounded-lg bg-muted/50 border border-border px-4 py-3">
        <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground leading-snug">
          Your data is encrypted and never leaves this device.
        </p>
      </div>
    </div>
  );
}
