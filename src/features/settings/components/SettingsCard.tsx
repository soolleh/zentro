/**
 * SettingsCard
 *
 * A bordered card container that visually groups related settings rows.
 * Child elements are separated by a horizontal divider.
 */

type SettingsCardProps = {
  readonly children: React.ReactNode;
  readonly className?: string;
};

export function SettingsCard({ children, className = '' }: SettingsCardProps) {
  return (
    <div
      className={`rounded-xl border border-border bg-card overflow-hidden divide-y divide-border ${className}`}
    >
      {children}
    </div>
  );
}
