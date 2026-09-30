import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from project root (one level up from backend/)
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

const connection = getRedisConnection();

// Email worker
const emailWorker = new Worker(QUEUE_NAMES.EMAIL, processEmailJob, {
  connection,
  concurrency: env.WORKER_CONCURRENCY,
});

emailWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Email job completed');
});

emailWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Email job failed');
});

// Index worker
const indexWorker = new Worker(QUEUE_NAMES.INDEX, processIndexJob, {
  connection,
  concurrency: 5,
});

indexWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Index job completed');
});

indexWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Index job failed');
});

// Notify worker
const notifyWorker = new Worker(QUEUE_NAMES.NOTIFY, processNotifyJob, {
  connection,
  concurrency: 5,
});

notifyWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Notify job completed');
});

notifyWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Notify job failed');
});

logger.info('Workers started successfully');

// TODO(lld): Uncomment when reconciler is implemented
// reconciler.reconcileOnStartup().then((result) => {
//   logger.info({ reconciledCount: result.reconciledCount }, 'Job reconciliation completed');
// });

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received, shutting down workers gracefully`);
  
  try {
    // Close workers (wait for active jobs to complete, reject new jobs)
    logger.info('Closing workers...');
    await Promise.all([
      emailWorker.close(),
      indexWorker.close(),
      notifyWorker.close(),
    ]);
    logger.info('All workers closed');

    // Close database connection
    await disconnectPrisma();

    // Close Redis connection
    await closeRedis();

    logger.info('Worker shutdown completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during worker shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
