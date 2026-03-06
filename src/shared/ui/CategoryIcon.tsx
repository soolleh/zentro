/**
 * CategoryIcon.tsx
 *
 * Dynamically renders a Lucide icon from a kebab-case or camelCase slug
 * stored on a Category's `icon` field (e.g. "shopping-cart", "tag").
 *
 * Falls back to a generic Tag icon when the slug is unknown or absent.
 */

import * as LucideIcons from 'lucide-react';
import { Tag } from 'lucide-react';
import type { LucideProps } from 'lucide-react';

type Props = LucideProps & {
  /** Lucide icon slug, e.g. "tag", "shopping-cart", "credit-card" */
  name?: string | null;
};

/**
 * Convert a kebab-case or snake_case slug to PascalCase.
 * "shopping-cart" → "ShoppingCart"
 * "coffee"        → "Coffee"
 */
function toPascalCase(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export function CategoryIcon({ name, ...props }: Props) {
  if (!name) return <Tag {...props} />;

  const pascalName = toPascalCase(name);
  const IconComponent = (LucideIcons as Record<string, unknown>)[pascalName] as
    | React.ComponentType<LucideProps>
    | undefined;

  if (!IconComponent) return <Tag {...props} />;

  return <IconComponent {...props} />;
}
