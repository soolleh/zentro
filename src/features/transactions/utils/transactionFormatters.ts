import { format, parseISO, isToday, isYesterday } from 'date-fns';

/**
 * Formats a date string (YYYY-MM-DD) for use in transaction group headers.
 */
export function formatGroupDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEE, d MMM yyyy');
  } catch {
    return dateStr;
  }
}
