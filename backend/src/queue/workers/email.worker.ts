/**
 * Email Worker Processor
 *
 * Full process flow
 * ─────────────────────────────────────────────────────────────────────────────
 *  1.  Receive EmailJobData from BullMQ.
 *  2.  Idempotency guard  – raw SQL UPDATE WHERE status='SCHEDULED' atomically
 *      claims the row.  If it returns 0 rows affected the email is already
 *      handled (SENT, FAILED, or claimed by another concurrent worker); we
 *      complete the job without doing anything.
 *  3.  Rate-limit gate   – atomic Redis Lua script checks the per-sender
 *      hourly cap and min-delay constraint in one round-trip.
 *      If denied → revert the DB row to SCHEDULED, enqueue a new delayed job
 *      for retryAt, and throw UnrecoverableError to close THIS job without
 *      consuming a retry slot.
 *  4.  Load sender       – fetch decrypted SMTP credentials.  If the sender
 *      was deleted mark FAILED immediately (UnrecoverableError – no point
 *      retrying).
 *  5.  Send via SMTP     – nodemailer with per-sender connection pool.
 *      Detects Ethereal test accounts and logs the preview URL.
 *  6.  Persist success   – markAsSent(emailId, messageId) stores the SMTP
 *      message-id and sentAt timestamp.
 *  7.  Post-send jobs    – fire-and-forget:
 *        • indexQueue  – Elasticsearch document indexing
 *        • notifyQueue – Slack notification to email owner
 *      Failures here do NOT fail the email job.
 *  8.  Transient errors  – re-thrown so BullMQ applies exponential back-off
 *      and retries up to MAX_JOB_ATTEMPTS.  The DB row is kept in PROCESSING
 *      during intermediate retries (BullMQ will reclaim the job).
 *      On the final attempt the row is marked FAILED and a Slack error alert
 *      is enqueued.
 *
 * Durability guarantees
 * ─────────────────────────────────────────────────────────────────────────────
 *  • Delayed jobs live in Redis sorted sets – survive API/worker restarts.
 *  • Far-future jobs (any delay) are promoted at exactly scheduledAt; no cron.
 *  • BullMQ stalled-job checker (configured in worker.ts) re-queues jobs
 *    whose locks expire mid-processing.
 *  • Startup reconciler resets PROCESSING rows whose Redis jobs are gone.
 *  • All errors are caught here and re-thrown in a controlled way; the worker
 *    process itself never crashes due to an unhandled job error.
 */

import { Job, UnrecoverableError } from 'bullmq';
import { prisma } from '../../db/client';
import { EmailJobData, emailProducer } from '../producers/email.producer';
import { indexQueue, notifyQueue } from '../queues';
import { rateLimitGate } from '../rate-limit/gate';
import { rateLimitNotifier } from '../rate-limit/notifier';
import { sendersRepo } from '../../modules/senders/senders.repo';
import { emailsRepo } from '../../modules/emails/emails.repo';
import { sendEmail, getEtherealPreviewUrl } from '../../infra/mailer';
import { logger } from '../../infra/logger';
import { env } from '../../config/env';
import { IndexJobData } from './index.worker';
import { NotifyJobData } from './notify.worker';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Whether this is the worker's final attempt for a job.
 * BullMQ counts `attemptsMade` BEFORE incrementing on each run, so on the
 * last attempt it equals `opts.attempts - 1`.
 */
function isFinalAttempt(job: Job): boolean {
  const maxAttempts = job.opts.attempts ?? 3;
  // attemptsMade is 0-indexed: 0 on first run, 1 on first retry, etc.
  return job.attemptsMade >= maxAttempts - 1;
}

/**
 * Enqueue a Slack notification without throwing.
 * Used in both the success path and the error path.
 */
async function enqueueNotification(
  jobName: string,
  data: NotifyJobData
): Promise<void> {
  try {
    await notifyQueue.add(jobName, data);
  } catch (err) {
    logger.warn({ err, jobName }, 'Failed to enqueue Slack notification – ignoring');
  }
}

// ─── Main processor ───────────────────────────────────────────────────────────

export async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { emailId, senderId, recipient, subject, body, hourlyLimit } = job.data;
  const attempt = job.attemptsMade + 1; // human-readable (1-indexed)

  logger.info({ jobId: job.id, emailId, attempt }, 'Processing email job');

  // ── Step 1: Atomic SCHEDULED → PROCESSING claim ───────────────────────────
  //
  // Raw SQL conditional UPDATE so only one worker wins when multiple workers
  // race on the same job (e.g. after a stall + requeue).

  const claimed = await prisma.$executeRaw`
    UPDATE emails
    SET    status = 'PROCESSING',
           "updatedAt" = NOW()
    WHERE  id     = ${emailId}
    AND    status = 'SCHEDULED'
  `;

  if (claimed === 0) {
    // The row is already PROCESSING (another worker beat us),
    // SENT (success path already ran), or FAILED (permanent failure path ran).
    // All are safe to skip – complete the job so BullMQ removes it.
    logger.warn(
      { jobId: job.id, emailId, attempt },
      'Email not in SCHEDULED state – skipping (duplicate job or already processed)'
    );
    return;
  }

  // ── Step 2: Rate-limit gate ───────────────────────────────────────────────

  let gate;
  try {
    gate = await rateLimitGate.checkSender(senderId, hourlyLimit);
  } catch (gateErr) {
    // Gate itself errored (Redis down, etc.) – treat as transient, revert and retry.
    await emailsRepo.updateEmailStatus(emailId, 'SCHEDULED').catch(() => {});
    throw gateErr; // BullMQ will retry with back-off
  }

  if (!gate.allowed) {
    // Revert row to SCHEDULED so the new delayed job can claim it later.
    await emailsRepo.updateEmailStatus(emailId, 'SCHEDULED');

    const retryDate = new Date(gate.retryAt!);
    await emailProducer.addEmailJob(
      { emailId, senderId, recipient, subject, body, hourlyLimit },
      retryDate
    );

    logger.info(
      { emailId, retryAt: retryDate.toISOString(), senderId },
      'Rate limited – job re-scheduled at retryAt'
    );

    // ── Notify user if this is the FIRST time hitting limit this hour ────────
    
    try {
      const shouldNotify = await rateLimitNotifier.shouldNotify(senderId);
      
      if (shouldNotify) {
        // Load sender details for notification message
        const sender = await sendersRepo.getSenderById(senderId);
        
        if (sender) {
          logger.info(
            { senderId, senderEmail: sender.email, userId: sender.userId },
            'Notifying user of sender rate limit'
          );
          
          await enqueueNotification('sender_limit_reached', {
            userId: sender.userId,
            message: `⚠️ Sender limit reached: ${sender.email} has hit the hourly limit of ${hourlyLimit ?? env.MAX_EMAILS_PER_HOUR_PER_SENDER} emails. Emails will resume automatically at the top of the next hour.`,
            eventType: 'sender_limit_reached',
            senderId: sender.id,
            senderEmail: sender.email,
          });
        }
      }
    } catch (notifyErr) {
      // Don't let notification failures block the email flow
      logger.error(
        { err: notifyErr, senderId, emailId },
        'Failed to send rate limit notification – continuing anyway'
      );
    }

    // Close THIS job as UnrecoverableError so BullMQ does NOT schedule its
    // own retry – we already added a correctly-timed new job above.
    throw new UnrecoverableError(
      `Rate limited – new job enqueued for ${retryDate.toISOString()}`
    );
  }

  // ── Steps 3-7: Send email (wrapped so every error path is handled) ─────────

  try {
    // ── Step 3: Load sender SMTP credentials ────────────────────────────────

    const sender = await sendersRepo.getSenderById(senderId);

    if (!sender) {
      // Sender was deleted – will never succeed; fail permanently.
      await emailsRepo.markAsFailed(emailId, 'Sender account no longer exists');
      throw new UnrecoverableError(`Sender ${senderId} not found in database`);
    }

    // ── Step 4: Send via SMTP ────────────────────────────────────────────────

    const result = await sendEmail(sender, {
      from: `${sender.email}`,
      to: recipient,
      subject,
      // Treat body as plain-text; HTML support can be layered on later.
      text: body,
    });

    // Log Ethereal preview URL for development / test accounts.
    if (sender.smtpHost.includes('ethereal.email')) {
      const previewUrl = getEtherealPreviewUrl(result.messageId);
      if (previewUrl) {
        logger.info({ emailId, previewUrl }, '📨 Ethereal preview URL');
      }
    }

    // ── Step 5: Persist success ──────────────────────────────────────────────
    //
    // markAsSent stores status=SENT, sentAt=now(), messageId.
    // This is the single source of truth that the job succeeded.

    await emailsRepo.markAsSent(emailId, result.messageId);

    logger.info(
      {
        jobId:     job.id,
        emailId,
        messageId: result.messageId,
        recipient,
        attempt,
        smtpHost:  sender.smtpHost,
        accepted:  result.accepted,
        rejected:  result.rejected,
      },
      'Email sent successfully'
    );

    // ── Step 6: Post-send side-effects (fire-and-forget) ────────────────────

    await Promise.allSettled([
      // Elasticsearch – index the email for full-text search.
      indexQueue
        .add(`sent:${emailId}`, {
          emailId,
          subject,
          body,
          recipient,
        } satisfies IndexJobData)
        .catch((err) => {
          logger.warn({ err, emailId }, 'Failed to enqueue index job – ignoring');
        }),

    ]);

  } catch (err) {
    // Re-throw UnrecoverableError (sender deleted, rate-limit duplicate guard)
    // without any further state changes – caller already set the correct status.
    if (err instanceof UnrecoverableError) {
      throw err;
    }

    // ── Step 7: Transient failure handling ────────────────────────────────────
    //
    // This covers SMTP errors, network timeouts, DB hiccups, etc.
    //
    // Behaviour per attempt:
    //  • Intermediate attempts (1…N-1):
    //    – DB row stays in PROCESSING (BullMQ still owns the lock; it will
    //      re-execute the job after the exponential back-off delay, and the
    //      idempotency guard at step 1 will skip it if PROCESSING).
    //    – Wait – actually the row must be SCHEDULED for step 1 to pick it up
    //      again.  Reset to SCHEDULED so the next attempt can claim it.
    //  • Final attempt (N):
    //    – Mark row FAILED with the error message.
    //    – Enqueue a Slack failure alert.
    //
    // In both cases we re-throw so BullMQ records the failure and applies its
    // own back-off / removal logic.

    const errorMessage = err instanceof Error ? err.message : String(err);
    const isLast = isFinalAttempt(job);

    logger.error(
      {
        jobId:     job.id,
        emailId,
        attempt,
        isFinal:   isLast,
        error:     errorMessage,
      },
      isLast ? 'Email job permanently failed' : 'Email job attempt failed – will retry'
    );

    if (isLast) {
      // Permanent failure: mark in DB and alert the user.
      await emailsRepo
        .markAsFailed(emailId, errorMessage)
        .catch((dbErr) => {
          logger.error({ dbErr, emailId }, 'markAsFailed DB update failed');
        });

      // Fetch userId for the Slack alert.
      const row = await prisma.email.findUnique({
        where:  { id: emailId },
        select: { userId: true },
      }).catch(() => null);

      if (row) {
        await enqueueNotification(`notify-fail:${emailId}`, {
          userId:    row.userId,
          message:   `❌ Failed to deliver email to *${recipient}* after ${attempt} attempt(s): ${errorMessage}`,
          eventType: 'failed',
        });
      }
    } else {
      // Intermediate failure: revert to SCHEDULED so next attempt can claim it.
      // Also increment the attempt counter in DB for UI visibility.
      await emailsRepo
        .recordTransientFailure(emailId, errorMessage)
        .catch((dbErr) => {
          logger.error({ dbErr, emailId }, 'Failed to revert email to SCHEDULED after transient error');
        });
    }

    // Always re-throw: lets BullMQ handle retry scheduling / final failure.
    throw err;
  }
}
