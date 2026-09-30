import { ScheduleEmailInput, ScheduleBatchInput } from './emails.schema';

/**
 * TODO(lld): Implement email service methods for business logic
 * - scheduleEmail(input, userId): Schedule a single email
 * - scheduleBatch(input, userId): Schedule a batch of emails
 * - uploadCsv(file, input, userId): Parse CSV and schedule batch
 * - getEmails(userId, filters): Get user's emails with filtering
 * - cancelEmail(emailId, userId): Cancel a scheduled email
 * - retryEmail(emailId, userId): Retry a failed email
 */

export class EmailsService {
  async scheduleEmail(input: ScheduleEmailInput, userId: string): Promise<{ id: string }> {
    throw new Error('Not implemented: scheduleEmail - TODO(lld): Create email record and enqueue job');
  }

  async scheduleBatch(input: ScheduleBatchInput, userId: string): Promise<{ batchId: string; emailCount: number }> {
    throw new Error('Not implemented: scheduleBatch - TODO(lld): Create batch and email records, enqueue jobs');
  }

  async uploadCsv(csvContent: string, input: Omit<ScheduleBatchInput, 'recipients'>, userId: string): Promise<{ batchId: string; emailCount: number }> {
    throw new Error('Not implemented: uploadCsv - TODO(lld): Parse CSV, extract recipients, schedule batch');
  }

  async getEmails(userId: string, filters: { status?: string; batchId?: string }): Promise<Array<{ id: string; recipient: string; status: string }>> {
    throw new Error('Not implemented: getEmails - TODO(lld): Query emails with filters');
  }

  async cancelEmail(emailId: string, userId: string): Promise<void> {
    throw new Error('Not implemented: cancelEmail - TODO(lld): Remove job from queue and update status');
  }
}

export const emailsService = new EmailsService();
