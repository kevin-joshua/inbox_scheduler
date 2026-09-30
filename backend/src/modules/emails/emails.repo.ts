import { EmailStatus, Prisma } from '@prisma/client';
import { prisma } from '../../db/client';
import { logger } from '../../infra/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreateEmailData {
  batchId: string;
  userId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: Date;
}

export interface CreateBatchData {
  userId: string;
  subject: string;
  body: string;
  startAt: Date;
  delayMs: number;
  hourlyLimit: number;
}

export interface EmailRow {
  id: string;
  batchId: string;
  userId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: Date;
  sentAt: Date | null;
  status: EmailStatus;
  messageId: string | null;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailListRow {
  id: string;
  batchId: string;
  recipient: string;
  subject: string;
  status: EmailStatus;
  scheduledAt: Date;
  sentAt: Date | null;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
}

export interface GetEmailsFilter {
  userId: string;
  status?: EmailStatus;
  batchId?: string;
  page?: number;
  limit?: number;
}

// ─── Repository ──────────────────────────────────────────────────────────────

export class EmailsRepo {
  /**
   * Insert a single email record.
   */
  async createEmail(data: CreateEmailData): Promise<{ id: string }> {
    try {
      const email = await prisma.email.create({
        data: {
          batchId: data.batchId,
          userId: data.userId,
          senderId: data.senderId,
          recipient: data.recipient,
          subject: data.subject,
          body: data.body,
          scheduledAt: data.scheduledAt,
          status: 'SCHEDULED',
        },
        select: { id: true },
      });

      logger.debug(
        { emailId: email.id, recipient: data.recipient },
        'Email record created'
      );

      return email;
    } catch (error) {
      logger.error({ error, recipient: data.recipient }, 'Failed to create email record');
      throw error;
    }
  }

  /**
   * Insert a batch record.
   */
  async createBatch(data: CreateBatchData): Promise<{ id: string }> {
    try {
      const batch = await prisma.batch.create({
        data: {
          userId: data.userId,
          subject: data.subject,
          body: data.body,
          startAt: data.startAt,
          delayMs: data.delayMs,
          hourlyLimit: data.hourlyLimit,
        },
        select: { id: true },
      });

      logger.debug({ batchId: batch.id }, 'Batch record created');

      return batch;
    } catch (error) {
      logger.error({ error }, 'Failed to create batch record');
      throw error;
    }
  }

  /**
   * Create a batch AND its emails atomically inside a Prisma transaction.
   * Returns the batchId and all created email rows (id + scheduledAt).
   */
  async createBatchWithEmails(
    batchData: CreateBatchData,
    emails: Array<{
      senderId: string;
      recipient: string;
      scheduledAt: Date;
    }>
  ): Promise<{
    batchId: string;
    emailIds: Array<{ id: string; recipient: string; scheduledAt: Date }>;
  }> {
    return prisma.$transaction(async (tx) => {
      // 1. Create the batch
      const batch = await tx.batch.create({
        data: {
          userId: batchData.userId,
          subject: batchData.subject,
          body: batchData.body,
          startAt: batchData.startAt,
          delayMs: batchData.delayMs,
          hourlyLimit: batchData.hourlyLimit,
        },
        select: { id: true },
      });

      // 2. Bulk-insert email records
      // createMany doesn't return IDs in all Prisma versions / databases,
      // so we insert in chunks and then fetch back by batchId.
      await tx.email.createMany({
        data: emails.map((e) => ({
          batchId: batch.id,
          userId: batchData.userId,
          senderId: e.senderId,
          recipient: e.recipient,
          subject: batchData.subject,
          body: batchData.body,
          scheduledAt: e.scheduledAt,
          status: 'SCHEDULED' as EmailStatus,
        })),
        skipDuplicates: true, // Respect @@unique([batchId, recipient])
      });

      // 3. Fetch back the created records to obtain their IDs
      const createdEmails = await tx.email.findMany({
        where: { batchId: batch.id },
        select: { id: true, recipient: true, scheduledAt: true },
        orderBy: { scheduledAt: 'asc' },
      });

      logger.info(
        { batchId: batch.id, emailCount: createdEmails.length },
        'Batch and emails created transactionally'
      );

      return { batchId: batch.id, emailIds: createdEmails };
    });
  }

  /**
   * List emails for the given user, with optional status / batchId filters
   * and simple cursor-based pagination.
   */
  async getEmails(filter: GetEmailsFilter): Promise<{
    emails: EmailListRow[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.EmailWhereInput = {
      userId: filter.userId,
      ...(filter.status && { status: filter.status }),
      ...(filter.batchId && { batchId: filter.batchId }),
    };

    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where,
        select: {
          id: true,
          batchId: true,
          recipient: true,
          subject: true,
          status: true,
          scheduledAt: true,
          sentAt: true,
          attempts: true,
          lastError: true,
          createdAt: true,
        },
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.email.count({ where }),
    ]);

    return {
      emails,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find a single email by ID, scoped to the given userId.
   */
  async getEmailByIdForUser(
    emailId: string,
    userId: string
  ): Promise<EmailRow | null> {
    return prisma.email.findFirst({
      where: { id: emailId, userId },
    });
  }

  /**
   * Update email status (generic).
   */
  async updateEmailStatus(emailId: string, status: EmailStatus): Promise<void> {
    await prisma.email.update({
      where: { id: emailId },
      data: { status },
    });
  }

  /**
   * Mark email as SENT with the SMTP message-id.
   */
  async markAsSent(emailId: string, messageId: string): Promise<void> {
    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        messageId,
      },
    });
  }

  /**
   * Permanently mark an email as FAILED (final attempt).
   * Records the error message and increments the attempt counter.
   */
  async markAsFailed(emailId: string, error: string): Promise<void> {
    await prisma.email.update({
      where: { id: emailId },
      data: {
        status:    'FAILED',
        lastError: error,
        attempts:  { increment: 1 },
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Record a transient (non-final) failure.
   * Reverts the email to SCHEDULED (so the next BullMQ retry can claim it
   * via the SCHEDULED → PROCESSING idempotency guard) while still
   * incrementing the attempt counter and storing the last error for the UI.
   */
  async recordTransientFailure(emailId: string, error: string): Promise<void> {
    await prisma.email.update({
      where: { id: emailId },
      data: {
        status:    'SCHEDULED',
        lastError: error,
        attempts:  { increment: 1 },
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Hard-delete an email record (used after queue job is removed).
   */
  async deleteEmail(emailId: string): Promise<void> {
    await prisma.email.delete({ where: { id: emailId } });
  }

  /**
   * Find all emails currently stuck in PROCESSING status.
   * Used by the startup reconciler to detect orphaned jobs from crashed workers.
   */
  async getProcessingEmails(): Promise<
    Array<{
      id: string;
      senderId: string;
      recipient: string;
      subject: string;
      body: string;
      scheduledAt: Date;
    }>
  > {
    return prisma.email.findMany({
      where: { status: 'PROCESSING' },
      select: {
        id: true,
        senderId: true,
        recipient: true,
        subject: true,
        body: true,
        scheduledAt: true,
      },
    });
  }

  /**
   * Atomically reset an email from PROCESSING → SCHEDULED.
   * Returns the number of rows updated (0 when already in a different state).
   */
  async resetToScheduled(emailId: string): Promise<number> {
    const result = await prisma.$executeRaw`
      UPDATE emails
      SET    status = 'SCHEDULED', "updatedAt" = NOW()
      WHERE  id = ${emailId}
      AND    status = 'PROCESSING'
    `;
    return result;
  }

  /**
   * Get SCHEDULED emails whose scheduledAt is in the past.
   * Used by health-check or a future polling reconciler.
   */
  async getOverdueScheduledEmails(limit = 100): Promise<
    Array<{ id: string; senderId: string; scheduledAt: Date }>
  > {
    return prisma.email.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: new Date() },
      },
      select: { id: true, senderId: true, scheduledAt: true },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
    });
  }
}

export const emailsRepo = new EmailsRepo();
