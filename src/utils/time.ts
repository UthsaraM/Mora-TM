/**
 * Time and date utilities for Asia/Colombo timezone (UTC+5:30)
 */

export const COLOMBO_TIMEZONE = 'Asia/Colombo';

/**
 * Returns date in YYYY-MM-DD format according to Asia/Colombo local time.
 */
export function getColomboDateString(date: Date = new Date()): string {
  // 'en-CA' outputs ISO standard YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: COLOMBO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Returns time in 12-hour format e.g. "08:15 AM" according to Asia/Colombo local time.
 */
export function getColomboTimeString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: COLOMBO_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * Returns full live date and time for the header display
 * e.g. "Thursday, October 15, 2026 · 01:45:20 PM"
 */
export function getColomboFullDateTimeString(date: Date = new Date()): {
  dateStr: string;
  timeStr: string;
} {
  const dateStr = new Intl.DateTimeFormat('en-US', {
    timeZone: COLOMBO_TIMEZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);

  const timeStr = new Intl.DateTimeFormat('en-US', {
    timeZone: COLOMBO_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);

  return { dateStr, timeStr };
}

/**
 * Greets based on Asia/Colombo hour rules:
 * - 5:00 AM to 11:59 AM: "Good Morning"
 * - 12:00 PM to 4:59 PM: "Good Afternoon"
 * - 5:00 PM to 4:59 AM: "Good Evening"
 */
export function getGreetingForColombo(date: Date = new Date()): 'Good Morning' | 'Good Afternoon' | 'Good Evening' {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: COLOMBO_TIMEZONE,
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(date);
  
  const hour = parseInt(hourStr, 10);
  if (hour >= 5 && hour < 12) {
    return 'Good Morning';
  } else if (hour >= 12 && hour < 17) {
    return 'Good Afternoon';
  } else {
    return 'Good Evening';
  }
}
