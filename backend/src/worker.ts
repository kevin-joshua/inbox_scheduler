import 'dotenv/config';
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
async function shutdown(): Promise<void> {
  logger.info('Shutting down workers gracefully');
  
  await emailWorker.close();
  await indexWorker.close();
  await notifyWorker.close();
  
  await closeRedis();
  await disconnectPrisma();
  
  logger.info('Workers shut down successfully');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
