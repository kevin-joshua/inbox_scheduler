/**
 * Startup Reconciler
 *
 * Runs once when the worker process boots. Its job is to detect and recover
 * from emails that were left in PROCESSING status because the previous worker
 * instance crashed (or was killed) mid-job.
 *
 * Strategy
 * ─────────
 *  1. Find all emails with status = PROCESSING.
 *     These were claimed by a worker but the job was never completed.
 *
 *  2. Check whether BullMQ still has an active / waiting job for each one.
 *     • If yes → the job is alive, leave the DB row as-is; BullMQ's own
 *       stalled-job checker will handle it (or it may still be processing).
 *     • If no  → the job is gone (worker crash before completion).
 *                Reset status to SCHEDULED and re-enqueue a new delayed job
 *                at max(now + 5s, original scheduledAt) so it retries soon.
 *
 *  3. Log a summary: how many were found, how many re-enqueued.
 *
 * Durability contract
 * ────────────────────
 *  BullMQ delayed jobs live in Redis' sorted set and survive API / worker
 *  restarts automatically. This reconciler only needs to handle the edge
 *  case where *both* the Redis job and the worker process were lost
 *  simultaneously (e.g. full server restart without graceful shutdown).
 */

import { emailQueue } from './queues';
import { emailProducer } from './producers/email.producer';
import { prisma } from '../db/client';
import { logger } from '../infra/logger';

export class Reconciler {
  async reconcileOnStartup(): Promise<{ reconciledCount: number }> {
    logger.info('Starting job reconciliation…');

    // 1. Find orphaned PROCESSING emails
    const stuck = await prisma.email.findMany({
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

    if (stuck.length === 0) {
      logger.info('Job reconciliation complete – no orphaned emails found');
      return { reconciledCount: 0 };
    }

    logger.warn(
      { count: stuck.length },
      'Found emails stuck in PROCESSING – reconciling…'
    );

    let reconciledCount = 0;

    for (const email of stuck) {
      try {
        // 2. Check if a BullMQ job already exists for this email
        const jobId = `email:${email.id}`;
        const existingJob = await emailQueue.getJob(jobId);

        if (existingJob) {
          const state = await existingJob.getState();

          if (state === 'active' || state === 'waiting' || state === 'delayed') {
            // Job is still alive in BullMQ – leave it alone
            logger.debug(
              { emailId: email.id, jobState: state },
              'BullMQ job still alive – skipping reconciliation for this email'
            );
            continue;
          }

          // Job exists but is in a terminal state (completed / failed) – remove it
          await existingJob.remove().catch(() => {/* ignore */});
        }

        // 3. Reset DB status and re-enqueue
        await prisma.email.update({
          where: { id: email.id },
          data: { status: 'SCHEDULED', updatedAt: new Date() },
        });

        // Schedule at the later of (now + 5 s) or the original scheduledAt
        const rescheduledAt = new Date(
          Math.max(Date.now() + 5_000, email.scheduledAt.getTime())
        );

        await emailProducer.addEmailJob(
          {
            emailId: email.id,
            senderId: email.senderId,
            recipient: email.recipient,
            subject: email.subject,
            body: email.body,
          },
          rescheduledAt
        );

        reconciledCount++;

        logger.info(
          {
            emailId: email.id,
            rescheduledAt: rescheduledAt.toISOString(),
          },
          'Orphaned email re-scheduled'
        );
      } catch (err) {
        logger.error(
          { error: err, emailId: email.id },
          'Failed to reconcile email – will leave as-is'
        );
      }
    }

    logger.info(
      { found: stuck.length, reconciled: reconciledCount },
      'Job reconciliation complete'
    );

    return { reconciledCount };
  }
}

export const reconciler = new Reconciler();
