/**
 * useGreeting.ts
 *
 * Returns a time-based greeting string and the current date label.
 */

export type GreetingResult = {
  greeting: string;
  dateLabel: string;
};

const DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function useGreeting(displayName: string): GreetingResult {
  const firstName = displayName.split(' ')[0] ?? displayName;

  const now = new Date();
  const hour = now.getHours();

  let salutation: string;
  if (hour >= 5 && hour < 12) {
    salutation = 'Good morning';
  } else if (hour >= 12 && hour < 17) {
    salutation = 'Good afternoon';
  } else {
    salutation = 'Good evening';
  }

  const dayName = DAYS[now.getDay()];
  const monthName = MONTHS[now.getMonth()];
  const day = now.getDate();

  return {
    greeting: `${salutation}, ${firstName}`,
    dateLabel: `${dayName}, ${monthName} ${String(day)}`,
  };
}
