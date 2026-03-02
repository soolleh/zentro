/**
 * currency.utils.ts
 *
 * Pure utility functions for formatting currency values.
 */

/**
 * Format a numeric amount as a currency string.
 * Falls back to a simple decimal format if the currency code is unknown.
 */
export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Format a number with sign (+ or -) prefix.
 */
export function formatWithSign(amount: number, currency: string): string {
  const abs = formatCurrency(Math.abs(amount), currency);
  if (amount > 0) return `+${abs}`;
  if (amount < 0) return `-${abs}`;
  return abs;
}

/**
 * Format a percentage: e.g. 0.75 → "75%"
 */
export function formatPercent(ratio: number, decimals = 0): string {
  return `${(ratio * 100).toFixed(decimals)}%`;
}
