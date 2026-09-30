/**
 * Rate-limit notification helper.
 *
 * Tracks whether we've already notified a user about a sender reaching
 * capacity, to avoid spamming them with repeated notifications within
 * the same hour.
 *
 * Uses Redis to store notification flags with a 2-hour TTL (covers hour
 * boundary edge cases).
 */

import { getRedisClient } from '../../infra/redis';
import { getCurrentHour } from '../../utils/time';
import { logger } from '../../infra/logger';

export class RateLimitNotifier {
  /**
   * Check if we should notify about rate limit for this sender.
   * Returns true only ONCE per hour per sender.
   *
   * Uses Redis SET with NX (only if not exists) to ensure atomicity.
   *
   * Key format: `rl:sender:{senderId}:notified:{hour}`
   * Example: `rl:sender:cm3x123:notified:2026-09-30-14`
   */
  async shouldNotify(senderId: string): Promise<boolean> {
    const redis = getRedisClient();
    const hour = getCurrentHour(); // e.g., "2026-09-30-14"
    const key = `rl:sender:${senderId}:notified:${hour}`;

    try {
      // SET key "1" EX 7200 NX
      // Returns "OK" if key was set (first time)
      // Returns null if key already exists (already notified)
      const result = await redis.set(key, '1', 'EX', 7200, 'NX');

      const shouldNotify = result === 'OK';

      logger.debug(
        { senderId, hour, shouldNotify },
        'Rate limit notification check'
      );

      return shouldNotify;
    } catch (error) {
      logger.error(
        { error, senderId },
        'Failed to check rate limit notification status'
      );
      // On error, don't notify (fail safe - avoid spam)
      return false;
    }
  }

  /**
   * Manually mark a sender as having been notified (for testing).
   * Useful for integration tests or manual intervention.
   */
  async markAsNotified(senderId: string): Promise<void> {
    const redis = getRedisClient();
    const hour = getCurrentHour();
    const key = `rl:sender:${senderId}:notified:${hour}`;

    try {
      await redis.set(key, '1', 'EX', 7200);
      logger.info({ senderId, hour }, 'Sender marked as notified');
    } catch (error) {
      logger.error({ error, senderId }, 'Failed to mark sender as notified');
      throw error;
    }
  }

  /**
   * Reset notification status for a sender (for testing).
   * Allows notifications to be sent again within the same hour.
   */
  async resetNotification(senderId: string): Promise<void> {
    const redis = getRedisClient();
    const hour = getCurrentHour();
    const key = `rl:sender:${senderId}:notified:${hour}`;

    try {
      await redis.del(key);
      logger.info({ senderId, hour }, 'Sender notification status reset');
    } catch (error) {
      logger.error({ error, senderId }, 'Failed to reset notification status');
      throw error;
    }
  }

  /**
   * Check if a sender has already been notified this hour (read-only).
   */
  async hasBeenNotified(senderId: string): Promise<boolean> {
    const redis = getRedisClient();
    const hour = getCurrentHour();
    const key = `rl:sender:${senderId}:notified:${hour}`;

    try {
      const exists = await redis.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error({ error, senderId }, 'Failed to check notification status');
      return false;
    }
  }
}

export const rateLimitNotifier = new RateLimitNotifier();
