import { EmailStatus } from '@prisma/client';
import { emailsRepo } from './emails.repo';
import { emailProducer } from '../../queue/producers/email.producer';
import { indexQueue } from '../../queue/queues';
import { IndexJobData } from '../../queue/workers/index.worker';
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

export class QueueUnavailableError extends Error {
  constructor(message = 'Email queue is unavailable. Please make sure Redis is running.') {
    super(message);
    this.name = 'QueueUnavailableError';
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
        hourlyLimit: 1,
      },
      scheduledAt
    );

    await indexQueue.add(`scheduled:${emailId}`, {
      emailId,
      subject: input.subject,
      body: input.body,
      recipient: input.recipient,
    } satisfies IndexJobData).catch((error) => {
      logger.warn({ error, emailId }, 'Failed to enqueue scheduled email index job');
    });

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
    let senderId = input.senderId;
    if (!senderId && input.fromEmail) {
      const sender = await sendersRepo.getSenderByEmailForUser(input.fromEmail, userId);
      if (!sender) {
        throw new NotFoundError(`Sender account ${input.fromEmail} was not found`);
      }
      senderId = sender.id;
    }
    if (!senderId) {
      throw new NotFoundError('A sender account is required');
    }

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
        senderId,
        recipient,
        scheduledAt: scheduledTimes[i],
      }))
    );

    // Bulk-enqueue BullMQ jobs
    try {
      await emailProducer.addBulkEmailJobs(
        emailIds.map((e) => ({
          data: {
            emailId: e.id,
            senderId,
          recipient: e.recipient,
          subject: input.subject,
          body: input.body,
          hourlyLimit: input.hourlyLimit,
          },
          scheduledAt: e.scheduledAt,
        }))
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: { message, stack: error instanceof Error ? error.stack : undefined }, batchId }, 'Failed to enqueue scheduled email jobs');
      throw new QueueUnavailableError(`Email queue unavailable: ${message}`);
    }

    // Index scheduled records immediately so they are searchable before delivery.
    // Search indexing is best-effort and must not block scheduling.
    await Promise.allSettled(
      emailIds.map((email) =>
        indexQueue.add(`scheduled:${email.id}`, {
          emailId: email.id,
          subject: input.subject,
          body: input.body,
          recipient: email.recipient,
        } satisfies IndexJobData)
      )
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
    await emailProducer.cancelEmailJob(emailId);

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
