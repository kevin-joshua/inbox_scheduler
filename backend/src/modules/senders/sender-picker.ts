/**
 * TODO(lld): Implement sender selection logic
 * - pickSender(senderIds): Select a sender based on rate limits and availability
 * - checkSenderAvailability(senderId): Check if sender can send more emails
 * - getSenderStats(senderId): Get sender's current hour email count
 * 
 * This should integrate with the rate-limit gate to ensure senders don't exceed
 * their hourly limits (MAX_EMAILS_PER_HOUR_PER_SENDER).
 */

export class SenderPicker {
  async pickSender(senderIds: string[]): Promise<string> {
    throw new Error('Not implemented: pickSender - TODO(lld): Implement sender rotation with rate limit checks');
  }

  async checkSenderAvailability(senderId: string): Promise<boolean> {
    throw new Error('Not implemented: checkSenderAvailability - TODO(lld): Check if sender is under hourly limit');
  }
}

export const senderPicker = new SenderPicker();
