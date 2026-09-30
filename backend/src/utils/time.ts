/**
 * Time utility functions for scheduling and rate limiting
 */

/**
 * Parse scheduled time from various formats
 * Accepts: ISO 8601, Unix timestamp (ms), Date object
 */
export function parseScheduledTime(input: string | number | Date): Date {
  if (input instanceof Date) {
    return input;
  }

  if (typeof input === 'number') {
    return new Date(input);
  }

  if (typeof input === 'string') {
    const parsed = new Date(input);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Invalid date format: ${input}`);
    }
    return parsed;
  }

  throw new Error('Invalid date input type');
}

/**
 * Calculate delay in milliseconds from now until scheduled time
 */
export function calculateDelay(scheduledAt: Date): number {
  const delay = scheduledAt.getTime() - Date.now();
  return Math.max(0, delay); // Never return negative delay
}

/**
 * Get current hour bucket for rate limiting
 * Format: YYYY-MM-DD-HH (UTC)
 * Example: "2026-09-30-14"
 */
export function getCurrentHour(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const date = String(now.getUTCDate()).padStart(2, '0');
  const hour = String(now.getUTCHours()).padStart(2, '0');
  return `${year}-${month}-${date}-${hour}`;
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(date: Date): string {
  return date.toISOString();
}

/**
 * Check if a date is in the past
 */
export function isPast(date: Date): boolean {
  return date.getTime() < Date.now();
}

/**
 * Check if a date is in the future
 */
export function isFuture(date: Date): boolean {
  return date.getTime() > Date.now();
}

/**
 * Add milliseconds to a date
 */
export function addMilliseconds(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

/**
 * Get time until a future date in human-readable format
 */
export function getTimeUntil(futureDate: Date): string {
  const ms = futureDate.getTime() - Date.now();
  if (ms < 0) return 'in the past';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
