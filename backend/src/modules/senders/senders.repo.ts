/**
 * TODO(lld): Implement sender repository methods
 * - createSender(data): Insert sender record with SMTP credentials
 * - getSendersByUser(userId): Get all senders for a user
 * - getSenderById(senderId): Get sender by ID
 * - updateSender(senderId, data): Update sender record
 * - deleteSender(senderId): Delete sender record
 */

export class SendersRepo {
  async createSender(data: {
    userId: string;
    email: string;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
  }): Promise<{ id: string }> {
    throw new Error('Not implemented: createSender - TODO(lld): Insert sender with SMTP credentials');
  }

  async getSendersByUser(userId: string): Promise<Array<{ id: string; email: string; smtpHost: string }>> {
    throw new Error('Not implemented: getSendersByUser - TODO(lld): Query senders by userId');
  }

  async getSenderById(senderId: string): Promise<{ id: string; email: string; smtpHost: string; smtpPort: number; smtpUser: string; smtpPass: string }> {
    throw new Error('Not implemented: getSenderById - TODO(lld): Query sender by ID with credentials');
  }
}

export const sendersRepo = new SendersRepo();
