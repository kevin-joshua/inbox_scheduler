import { EmailStatus } from '@prisma/client';
import { emailsRepo } from './emails.repo';
import { emailProducer } from '../../queue/producers/email.producer';
import { sendersRepo } from '../senders/senders.repo';
import { parseEmailCsv, deduplicateEmails } from '../../utils/csv';
import { addMilliseconds } from '../../utils/time';
import { logger } from '../../infra/logger';
import {
  ScheduleEmailInput,
  ScheduleBatchInput,
  UploadCsvInput,
  GetEmailsQuery,
} from './emails.schema';

// ─── Error types ─────────────────────────────────────────────────────────────

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class EmailsService {
  // ── Single-email scheduling ─────────────────────────────────────────────

  /**
   * Schedule a single email.
   *
   * 1. Verify the sender belongs to the user.
   * 2. Create a one-email batch + the email record transactionally.
   * 3. Enqueue a delayed BullMQ job.
   */
  async scheduleEmail(
    input: ScheduleEmailInput,
    userId: string
  ): Promise<{ id: string; batchId: string }> {
    // Validate sender ownership
    await this.assertSenderOwnership(input.senderId, userId);

    const scheduledAt = new Date(input.scheduledAt);

    // Create a synthetic batch for a single email (keeps the schema clean)
    const { batchId, emailIds } = await emailsRepo.createBatchWithEmails(
      {
        userId,
        subject: input.subject,
        body: input.body,
        startAt: scheduledAt,
        delayMs: 0,
        hourlyLimit: 1,
      },
      [
        {
          senderId: input.senderId,
          recipient: input.recipient.toLowerCase().trim(),
          scheduledAt,
        },
      ]
    );

    const emailId = emailIds[0].id;

    // Enqueue the job
    await emailProducer.addEmailJob(
      {
        emailId,
        senderId: input.senderId,
        recipient: input.recipient,
        subject: input.subject,
        body: input.body,
      },
      scheduledAt
    );

    logger.info({ emailId, batchId, userId }, 'Single email scheduled');

    return { id: emailId, batchId };
  }

  // ── Batch scheduling ────────────────────────────────────────────────────

  /**
   * Schedule a batch of emails.
   *
   * 1. Verify sender ownership.
   * 2. Deduplicate recipients.
   * 3. Calculate per-email scheduledAt respecting delayMs + hourlyLimit.
   * 4. Create batch + email records in a single transaction.
   * 5. Bulk-enqueue BullMQ jobs.
   */
  async scheduleBatch(
    input: ScheduleBatchInput,
    userId: string
  ): Promise<{ batchId: string; emailCount: number; skippedDuplicates: number }> {
    await this.assertSenderOwnership(input.senderId, userId);

    // Deduplicate
    const { unique: recipients, duplicates: skippedDuplicates } =
      deduplicateEmails(input.recipients);

    if (recipients.length === 0) {
      throw new ConflictError('All provided recipients were duplicates');
    }

    const startAt = new Date(input.startAt);
    const scheduledTimes = this.calculateScheduledTimes(
      recipients.length,
      startAt,
      input.delayMs,
      input.hourlyLimit
    );

    // Transactional DB write
    const { batchId, emailIds } = await emailsRepo.createBatchWithEmails(
      {
        userId,
        subject: input.subject,
        body: input.body,
        startAt,
        delayMs: input.delayMs,
        hourlyLimit: input.hourlyLimit,
      },
      recipients.map((recipient, i) => ({
        senderId: input.senderId,
        recipient,
        scheduledAt: scheduledTimes[i],
      }))
    );

    // Bulk-enqueue BullMQ jobs
    await emailProducer.addBulkEmailJobs(
      emailIds.map((e) => ({
        data: {
          emailId: e.id,
          senderId: input.senderId,
          recipient: e.recipient,
          subject: input.subject,
          body: input.body,
        },
        scheduledAt: e.scheduledAt,
      }))
    );

    logger.info(
      { batchId, emailCount: emailIds.length, skippedDuplicates, userId },
      'Batch scheduled'
    );

    return { batchId, emailCount: emailIds.length, skippedDuplicates };
  }

  // ── CSV upload ──────────────────────────────────────────────────────────

  /**
   * Parse a CSV/plain-text file uploaded via multipart, then schedule batch.
   */
  async uploadCsv(
    fileBuffer: Buffer,
    input: UploadCsvInput,
    userId: string
  ): Promise<{
    batchId: string;
    emailCount: number;
    skippedDuplicates: number;
    invalidAddresses: number;
  }> {
    const csvContent = fileBuffer.toString('utf-8');
    const { emails, invalid, duplicates } = parseEmailCsv(csvContent);

    if (emails.length === 0) {
      throw new ConflictError(
        'No valid email addresses found in the uploaded file'
      );
    }

    logger.info(
      { valid: emails.length, invalid: invalid.length, duplicates },
      'CSV parsed'
    );

    // Re-use scheduleBatch logic (recipients are already deduplicated by parseEmailCsv)
    const result = await this.scheduleBatch(
      {
        senderId: input.senderId,
        recipients: emails,
        subject: input.subject,
        body: input.body,
        startAt: input.startAt,
        delayMs: input.delayMs,
        hourlyLimit: input.hourlyLimit,
      },
      userId
    );

    return {
      ...result,
      invalidAddresses: invalid.length,
    };
  }

  // ── List emails ─────────────────────────────────────────────────────────

  async getEmails(userId: string, query: GetEmailsQuery) {
    const status = query.status as EmailStatus | undefined;

    return emailsRepo.getEmails({
      userId,
      status,
      batchId: query.batchId,
      page: query.page,
      limit: query.limit,
    });
  }

  // ── Cancel / delete ─────────────────────────────────────────────────────

  /**
   * Cancel a SCHEDULED email.
   *
   * Rules
   * ─────
   * • Only the owning user can cancel.
   * • Only SCHEDULED emails can be cancelled – PROCESSING/SENT/FAILED are rejected.
   * • Removes the BullMQ job then deletes the email record.
   */
  async cancelEmail(emailId: string, userId: string): Promise<void> {
    const email = await emailsRepo.getEmailByIdForUser(emailId, userId);

    if (!email) {
      throw new NotFoundError('Email not found');
    }

    if (email.userId !== userId) {
      throw new ForbiddenError('You do not have permission to cancel this email');
    }

    if (email.status !== 'SCHEDULED') {
      throw new ConflictError(
        `Cannot cancel email with status "${email.status}". Only SCHEDULED emails can be cancelled.`
      );
    }

    // Remove from queue (throws if currently active)
    await emailProducer.cancelEmailJob(`email:${emailId}`);

    // Update status to reflect cancellation (soft-delete approach)
    await emailsRepo.updateEmailStatus(emailId, 'FAILED' as EmailStatus);

    logger.info({ emailId, userId }, 'Email cancelled');
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  /**
   * Assert that a sender belongs to the given user.
   * Throws ForbiddenError when the sender is not found or not owned.
   */
  private async assertSenderOwnership(
    senderId: string,
    userId: string
  ): Promise<void> {
    const owned = await sendersRepo.validateSenderOwnership(senderId, userId);
    if (!owned) {
      throw new ForbiddenError(
        'Sender not found or does not belong to your account'
      );
    }
  }

  /**
   * Given N recipients, compute a scheduledAt for each one that respects:
   * - The base startAt time
   * - A minimum delayMs gap between consecutive emails
   * - An hourlyLimit cap (no more than N emails per hour per window)
   */
  private calculateScheduledTimes(
    count: number,
    startAt: Date,
    delayMs: number,
    hourlyLimit: number
  ): Date[] {
    const times: Date[] = [];
    let current = startAt.getTime();
    const slotMs = delayMs > 0 ? delayMs : 0;
    // Minimum inter-email gap enforced by hourlyLimit
    const minGapFromLimit = Math.ceil((60 * 60 * 1000) / hourlyLimit);
    const effectiveGap = Math.max(slotMs, minGapFromLimit);

    for (let i = 0; i < count; i++) {
      times.push(new Date(current));
      current += effectiveGap;
    }

    return times;
  }
}

export const emailsService = new EmailsService();
