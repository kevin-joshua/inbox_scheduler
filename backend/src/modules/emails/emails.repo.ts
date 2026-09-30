import { EmailStatus } from '@prisma/client';

/**
 * TODO(lld): Implement email repository methods for database operations
 * - createEmail(data): Insert email record
 * - createBatch(data): Insert batch record
 * - getBatchEmails(batchId): Get all emails in a batch
 * - updateEmailStatus(emailId, status): Update email status
 * - markAsSent(emailId, messageId): Mark email as sent
 * - markAsFailed(emailId, error): Mark email as failed
 * - getScheduledEmails(limit): Get emails ready to send
 * - getEmailStats(userId): Get email statistics
 */

export class EmailsRepo {
  async createEmail(data: {
    batchId: string;
    userId: string;
    senderId: string;
    recipient: string;
    subject: string;
    body: string;
    scheduledAt: Date;
  }): Promise<{ id: string }> {
    throw new Error('Not implemented: createEmail - TODO(lld): Insert email record into database');
  }

  async createBatch(data: {
    userId: string;
    subject: string;
    body: string;
    startAt: Date;
    delayMs: number;
    hourlyLimit: number;
  }): Promise<{ id: string }> {
    throw new Error('Not implemented: createBatch - TODO(lld): Insert batch record into database');
  }

  async updateEmailStatus(emailId: string, status: EmailStatus): Promise<void> {
    throw new Error('Not implemented: updateEmailStatus - TODO(lld): Update email status in database');
  }

  async markAsSent(emailId: string, messageId: string): Promise<void> {
    throw new Error('Not implemented: markAsSent - TODO(lld): Mark email as sent with messageId');
  }

  async markAsFailed(emailId: string, error: string): Promise<void> {
    throw new Error('Not implemented: markAsFailed - TODO(lld): Mark email as failed with error message');
  }
}

export const emailsRepo = new EmailsRepo();
