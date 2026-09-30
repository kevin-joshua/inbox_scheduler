import { getRedisClient } from '../../infra/redis';
import { env } from '../../config/env';
import { logger } from '../../infra/logger';
import { getCurrentHour } from '../../utils/time';

interface SenderStats {
  senderId: string;
  emailsSentThisHour: number;
  lastSentAt: number | null;
  isAvailable: boolean;
}

export class SenderPicker {
  private redis = getRedisClient();

  /**
   * Pick the best available sender from a list
   * Strategy: Round-robin with rate limit awareness
   * Returns the sender ID that can send next
   */
  async pickSender(senderIds: string[]): Promise<string> {
    if (senderIds.length === 0) {
      throw new Error('No senders available');
    }

    // Get stats for all senders
    const stats = await Promise.all(
      senderIds.map((id) => this.getSenderStats(id))
    );

    // Filter to only available senders
    const availableSenders = stats.filter((s) => s.isAvailable);

    if (availableSenders.length === 0) {
      // All senders are at capacity
      logger.warn({ senderIds }, 'All senders are at capacity');
      throw new Error('No available senders (all at capacity)');
    }

    // Sort by least used (fewest emails sent this hour)
    availableSenders.sort((a, b) => a.emailsSentThisHour - b.emailsSentThisHour);

    // Among senders with same usage, prefer least recently used
    const leastUsedCount = availableSenders[0].emailsSentThisHour;
    const leastUsedSenders = availableSenders.filter(
      (s) => s.emailsSentThisHour === leastUsedCount
    );

    if (leastUsedSenders.length === 1) {
      return leastUsedSenders[0].senderId;
    }

    // Break tie by least recently used
    leastUsedSenders.sort((a, b) => {
      const aTime = a.lastSentAt || 0;
      const bTime = b.lastSentAt || 0;
      return aTime - bTime;
    });

    const selected = leastUsedSenders[0];
    logger.debug(
      {
        senderId: selected.senderId,
        emailsSentThisHour: selected.emailsSentThisHour,
        totalAvailable: availableSenders.length,
      },
      'Sender selected'
    );

    return selected.senderId;
  }

  /**
   * Check if a specific sender is available to send
   */
  async checkSenderAvailability(senderId: string): Promise<boolean> {
    const stats = await this.getSenderStats(senderId);
    return stats.isAvailable;
  }

  /**
   * Get sender statistics for the current hour
   */
  async getSenderStats(senderId: string): Promise<SenderStats> {
    const currentHour = getCurrentHour();
    const counterKey = `sender:${senderId}:hour:${currentHour}`;
    const lastSentKey = `sender:${senderId}:last`;

    try {
      const [countStr, lastSentStr] = await Promise.all([
        this.redis.get(counterKey),
        this.redis.get(lastSentKey),
      ]);

      const emailsSentThisHour = countStr ? parseInt(countStr, 10) : 0;
      const lastSentAt = lastSentStr ? parseInt(lastSentStr, 10) : null;

      const isAvailable = emailsSentThisHour < env.MAX_EMAILS_PER_HOUR_PER_SENDER;

      return {
        senderId,
        emailsSentThisHour,
        lastSentAt,
        isAvailable,
      };
    } catch (error) {
      logger.error({ error, senderId }, 'Failed to get sender stats');
      // On error, assume available (fail open)
      return {
        senderId,
        emailsSentThisHour: 0,
        lastSentAt: null,
        isAvailable: true,
      };
    }
  }

  /**
   * Increment sender usage counter
   * Called after successfully sending an email
   */
  async incrementSenderUsage(senderId: string): Promise<void> {
    const currentHour = getCurrentHour();
    const counterKey = `sender:${senderId}:hour:${currentHour}`;
    const lastSentKey = `sender:${senderId}:last`;
    const now = Date.now();

    try {
      const pipeline = this.redis.pipeline();

      // Increment hourly counter
      pipeline.incr(counterKey);
      // Set expiry to 2 hours (in case of clock skew)
      pipeline.expire(counterKey, 7200);

      // Update last sent timestamp
      pipeline.set(lastSentKey, now.toString());
      // Expire after 24 hours
      pipeline.expire(lastSentKey, 86400);

      await pipeline.exec();

      logger.debug({ senderId, currentHour }, 'Sender usage incremented');
    } catch (error) {
      logger.error({ error, senderId }, 'Failed to increment sender usage');
      // Don't throw - this is non-critical
    }
  }

  /**
   * Reset sender counters (for testing or manual intervention)
   */
  async resetSenderCounters(senderId: string): Promise<void> {
    const currentHour = getCurrentHour();
    const counterKey = `sender:${senderId}:hour:${currentHour}`;
    const lastSentKey = `sender:${senderId}:last`;

    try {
      await this.redis.del(counterKey, lastSentKey);
      logger.info({ senderId }, 'Sender counters reset');
    } catch (error) {
      logger.error({ error, senderId }, 'Failed to reset sender counters');
      throw new Error('Failed to reset sender counters');
    }
  }

  /**
   * Get all sender stats for monitoring/dashboard
   */
  async getAllSenderStats(senderIds: string[]): Promise<SenderStats[]> {
    return await Promise.all(senderIds.map((id) => this.getSenderStats(id)));
  }
}

export const senderPicker = new SenderPicker();
