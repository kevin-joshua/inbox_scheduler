import { Queue } from 'bullmq';
import { getRedisConnection } from '../infra/redis';
import { QUEUE_NAMES, JOB_OPTIONS } from '../config/constants';
import { env } from '../config/env';

const connection = getRedisConnection();

export const emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
  connection,
  defaultJobOptions: {
    attempts: env.MAX_JOB_ATTEMPTS,
    backoff: {
      type: 'exponential',
      delay: env.SMTP_RETRY_BACKOFF_MS,
    },
    removeOnComplete: JOB_OPTIONS.REMOVE_ON_COMPLETE,
    removeOnFail: JOB_OPTIONS.REMOVE_ON_FAIL,
  },
});

export const indexQueue = new Queue(QUEUE_NAMES.INDEX, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: JOB_OPTIONS.REMOVE_ON_COMPLETE,
    removeOnFail: JOB_OPTIONS.REMOVE_ON_FAIL,
  },
});

export const notifyQueue = new Queue(QUEUE_NAMES.NOTIFY, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: JOB_OPTIONS.REMOVE_ON_COMPLETE,
    removeOnFail: JOB_OPTIONS.REMOVE_ON_FAIL,
  },
});
