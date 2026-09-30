/**
 * Elasticsearch indexing worker.
 *
 * Indexes a sent (or updated) email document so it can be full-text searched.
 * Idempotent: uses emailId as the ES document _id so re-runs are safe.
 *
 * Failure policy
 * ──────────────
 * Indexing failures do NOT affect email delivery.  This job is enqueued as
 * fire-and-forget from email.worker.ts after a successful SMTP send.
 * The queue is configured with 3 retries + exponential back-off in queues.ts.
 * If all retries are exhausted the job is moved to the failed set and the
 * email remains searchable by its Postgres data (just not full-text indexed).
 *
 * Index bootstrap
 * ───────────────
 * ensureIndex() is called on the first job execution.  It is idempotent and
 * cheap (just an existence check) on subsequent calls.
 */

import { Job } from 'bullmq';
import { prisma } from '../../db/client';
import { searchService } from '../../modules/search/search.service';
import { logger } from '../../infra/logger';

export interface IndexJobData {
  emailId:   string;
  subject:   string;
  body:      string;
  recipient: string;
}

// Lazily initialise the index mapping on the first job execution
let indexReady = false;

async function ensureIndexOnce(): Promise<void> {
  if (indexReady) return;
  await searchService.ensureIndex();
  indexReady = true;
}

export async function processIndexJob(job: Job<IndexJobData>): Promise<void> {
  const { emailId, subject, body, recipient } = job.data;

  logger.debug({ jobId: job.id, emailId }, 'Indexing email in Elasticsearch');

  // Ensure the index exists with the correct mappings (no-op after first time)
  await ensureIndexOnce();

  // Fetch full context from Postgres so we can index userId, batchId, status,
  // and timestamps – these are not carried in the job payload to keep it lean.
  const email = await prisma.email.findUnique({
    where:  { id: emailId },
    select: {
      id:          true,
      userId:      true,
      batchId:     true,
      recipient:   true,
      subject:     true,
      body:        true,
      status:      true,
      sentAt:      true,
      scheduledAt: true,
    },
  });

  if (!email) {
    // Email was deleted before indexing completed – skip silently
    logger.warn({ emailId }, 'Email not found in DB – skipping index');
    return;
  }

  await searchService.indexEmail({
    emailId:     email.id,
    userId:      email.userId,
    batchId:     email.batchId,
    recipient:   email.recipient,
    subject:     email.subject,
    body:        email.body,
    status:      email.status,
    sentAt:      email.sentAt?.toISOString() ?? null,
    scheduledAt: email.scheduledAt.toISOString(),
    indexedAt:   new Date().toISOString(),
  });

  logger.info({ jobId: job.id, emailId }, 'Email indexed in Elasticsearch');
}
