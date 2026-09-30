import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from project root (one level up from backend/).
// Must be first – before any module that reads env vars.
config({ path: resolve(__dirname, '../../.env') });

import { Worker } from 'bullmq';
import { env } from './config/env';
import { logger } from './infra/logger';
import { getRedisConnection, closeRedis } from './infra/redis';
import { disconnectPrisma } from './db/client';
import { QUEUE_NAMES } from './config/constants';
import { processEmailJob } from './queue/workers/email.worker';
import { processIndexJob } from './queue/workers/index.worker';
import { processNotifyJob } from './queue/workers/notify.worker';
import { reconciler } from './queue/reconciler';
import { closeAllTransporters } from './infra/mailer';

// ─── Process-level safety net ─────────────────────────────────────────────────
//
// These handlers prevent the worker process from crashing due to an unhandled
// promise rejection or uncaught exception that escapes the BullMQ processor.
// The worker itself uses try/catch everywhere, but third-party libs or
// infrastructure code may still emit unexpected errors.

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled promise rejection – worker will keep running');
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception – worker will keep running');
  // NOTE: do NOT exit here; BullMQ workers are resilient and we want to keep
  // processing other jobs.  A truly fatal error should be caught explicitly.
});

// ─── Redis connection shared by all workers ───────────────────────────────────

const connection = getRedisConnection();

// ─── Email worker ─────────────────────────────────────────────────────────────
//
// lockDuration / lockRenewTime
//   BullMQ keeps the job locked so no other worker picks it up while it runs.
//   The lock is renewed every lockRenewTime ms.  If the process is killed
//   before renewal, BullMQ considers the job stalled after stalledInterval ms.
//
// stalledInterval / maxStalledCount
//   Controls how long BullMQ waits before declaring a job stalled and moving
//   it back to the waiting list.  maxStalledCount = 1 means: allow 1 stall
//   (re-queue once), then mark it as failed.

const emailWorker = new Worker(QUEUE_NAMES.EMAIL, processEmailJob, {
  connection,
  concurrency:      env.WORKER_CONCURRENCY,
  lockDuration:     30_000, // 30 s – maximum time per email job
  lockRenewTime:    15_000, // Renew the lock every 15 s
  stalledInterval:  30_000, // Check for stalled jobs every 30 s
  maxStalledCount:  1,      // Re-queue once on stall, then mark failed
});

emailWorker.on('completed', (job) => {
  logger.info(
    { jobId: job.id, emailId: job.data.emailId },
    'Email job completed'
  );
});

emailWorker.on('failed', (job, err) => {
  // This fires AFTER BullMQ has exhausted all attempts or for UnrecoverableError.
  logger.error(
    {
      jobId:     job?.id,
      emailId:   job?.data?.emailId,
      attempt:   job?.attemptsMade,
      error:     err.message,
      isUnrecoverable: err.name === 'UnrecoverableError',
    },
    'Email job permanently failed'
  );
});

emailWorker.on('stalled', (jobId) => {
  logger.warn({ jobId }, 'Email job stalled – BullMQ will re-queue it');
});

// Worker-level error: emitted for Redis/BullMQ infrastructure errors
// (not job processor errors, which are caught inside processEmailJob).
emailWorker.on('error', (err) => {
  logger.error({ err }, 'Email worker infrastructure error');
});

// ─── Index worker ─────────────────────────────────────────────────────────────

const indexWorker = new Worker(QUEUE_NAMES.INDEX, processIndexJob, {
  connection,
  concurrency:   5,
  lockDuration:  15_000,
  lockRenewTime: 7_500,
});

indexWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, emailId: job.data.emailId }, 'Index job completed');
});

indexWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, emailId: job?.data?.emailId, error: err.message }, 'Index job permanently failed');
});

indexWorker.on('error', (err) => {
  logger.error({ err }, 'Index worker infrastructure error');
});

// ─── Notify worker ────────────────────────────────────────────────────────────

const notifyWorker = new Worker(QUEUE_NAMES.NOTIFY, processNotifyJob, {
  connection,
  concurrency:   5,
  lockDuration:  15_000,
  lockRenewTime: 7_500,
});

notifyWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, eventType: job.data.eventType }, 'Notify job completed');
});

notifyWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Notify job permanently failed');
});

notifyWorker.on('error', (err) => {
  logger.error({ err }, 'Notify worker infrastructure error');
});

// ─── Startup reconciliation ───────────────────────────────────────────────────
//
// Immediately after workers are ready, repair any emails left in PROCESSING
// from a previous worker crash.  Errors here are logged but do NOT prevent
// the worker from starting.

reconciler
  .reconcileOnStartup()
  .then(({ reconciledCount }) => {
    logger.info(
      { reconciledCount },
      reconciledCount > 0
        ? 'Startup reconciliation: orphaned jobs re-enqueued'
        : 'Startup reconciliation: no orphaned jobs found'
    );
  })
  .catch((err) => {
    logger.error({ err }, 'Startup reconciliation failed – workers will continue anyway');
  });

logger.info(
  { concurrency: env.WORKER_CONCURRENCY, queues: Object.values(QUEUE_NAMES) },
  'Workers started'
);

// ─── Graceful shutdown ────────────────────────────────────────────────────────
//
// On SIGTERM / SIGINT:
//  1. Stop accepting new jobs (Worker.close() drains in-flight jobs first).
//  2. Close nodemailer SMTP connection pools.
//  3. Disconnect Prisma.
//  4. Disconnect Redis.
//
// The process exits with code 0 on clean shutdown, 1 on error.

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutdown signal received – draining workers');

  try {
    await Promise.all([
      emailWorker.close(),
      indexWorker.close(),
      notifyWorker.close(),
    ]);
    logger.info('All workers drained and closed');

    closeAllTransporters();
    await disconnectPrisma();
    await closeRedis();

    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
