/**
 * TODO(lld): Implement time utility functions
 * - parseScheduledTime(input): Parse various time formats
 * - calculateDelay(scheduledAt): Calculate ms delay from now
 * - getCurrentHour(): Get current hour for rate limit bucketing
 * - formatTimestamp(date): Format date for display
 */

export function parseScheduledTime(input: string): Date {
  throw new Error('Not implemented: parseScheduledTime - TODO(lld): Parse time string to Date');
}

export function calculateDelay(scheduledAt: Date): number {
  return scheduledAt.getTime() - Date.now();
}

export function getCurrentHour(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}-${now.getUTCHours()}`;
}
