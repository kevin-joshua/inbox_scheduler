export const QUEUE_NAMES = {
  EMAIL: 'email',
  INDEX: 'index',
  NOTIFY: 'notify',
} as const;

export const EMAIL_STATUS = {
  SCHEDULED: 'SCHEDULED',
  PROCESSING: 'PROCESSING',
  SENT: 'SENT',
  FAILED: 'FAILED',
} as const;

export const JOB_OPTIONS = {
  REMOVE_ON_COMPLETE: {
    age: 3600, // Keep completed jobs for 1 hour
    count: 1000, // Keep max 1000 completed jobs
  },
  REMOVE_ON_FAIL: {
    age: 86400, // Keep failed jobs for 24 hours
    count: 5000, // Keep max 5000 failed jobs
  },
} as const;

export const REDIS_KEY_PREFIX = 'reachinbox:';
