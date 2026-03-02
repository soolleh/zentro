/**
 * SettingsRow
 *
 * A single row inside a SettingsCard. Renders a label + optional description
 * on the left and an interactive control on the right.
 */

import type { LucideIcon } from 'lucide-react';

type SettingsRowProps = {
  readonly label: string;
  readonly description?: string;
  readonly icon?: LucideIcon;
  /** The control element (select, toggle, button, etc.) */
  readonly control?: React.ReactNode;
  /** When true, the row stacks vertically instead of side-by-side */
  readonly stacked?: boolean;
  readonly children?: React.ReactNode;
};

export function SettingsRow({
  label,
  description,
  icon: Icon,
  control,
  stacked = false,
  children,
}: SettingsRowProps) {
  return (
    <div
      className={`flex gap-4 px-4 py-3.5 ${stacked ? 'flex-col' : 'flex-row items-center justify-between'
        }`}
    >
      {/* Left side */}
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <Icon
            size={18}
            className="text-muted-foreground mt-0.5 shrink-0"
            aria-hidden="true"
          />
        )}
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-medium text-foreground leading-snug truncate">
            {label}
          </span>
          {description && (
            <span className="text-xs text-muted-foreground leading-snug">
              {description}
            </span>
          )}
        </div>
      </div>

      {/* Right side: explicit control prop or children */}
      {(control ?? children) && (
        <div className={`shrink-0 ${stacked ? '' : 'ml-auto'}`}>
          {control ?? children}
        </div>
      )}
    </div>
  );
}
