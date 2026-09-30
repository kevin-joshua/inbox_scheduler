import { emailQueue } from '../queues';
import { calculateDelay } from '../../utils/time';
import { logger } from '../../infra/logger';

export interface EmailJobData {
  emailId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
}

export class EmailProducer {
  /**
   * Add a single delayed email job to the BullMQ queue.
   * Returns the BullMQ job ID.
   */
  async addEmailJob(data: EmailJobData, scheduledAt: Date): Promise<string> {
    const delay = calculateDelay(scheduledAt);

    const job = await emailQueue.add(`email:${data.emailId}`, data, {
      delay,
      jobId: `email:${data.emailId}`, // Idempotency – one job per email record
    });

    logger.debug(
      { jobId: job.id, emailId: data.emailId, delay },
      'Email job enqueued'
    );

    return job.id!;
  }

  /**
   * Add many email jobs in a single bulk operation (more efficient than
   * looping addEmailJob when scheduling hundreds/thousands of emails).
   */
  async addBulkEmailJobs(
    jobs: Array<{ data: EmailJobData; scheduledAt: Date }>
  ): Promise<void> {
    if (jobs.length === 0) return;

    const bulkJobs = jobs.map(({ data, scheduledAt }) => ({
      name: `email:${data.emailId}`,
      data,
      opts: {
        delay: calculateDelay(scheduledAt),
        jobId: `email:${data.emailId}`,
      },
    }));

    await emailQueue.addBulk(bulkJobs);

    logger.debug({ count: bulkJobs.length }, 'Bulk email jobs enqueued');
  }

  /**
   * Remove a job from the queue (cancel before processing).
   * Silently succeeds when the job doesn't exist (already processed).
   */
  async cancelEmailJob(jobId: string): Promise<void> {
    const job = await emailQueue.getJob(jobId);

    if (!job) {
      logger.debug({ jobId }, 'Cancel: job not found in queue (may already be processed)');
      return;
    }

    const state = await job.getState();

    if (state === 'active') {
      // Job is being processed right now – we cannot safely remove it
      throw new Error('Email is currently being processed and cannot be cancelled');
    }

    await job.remove();
    logger.debug({ jobId }, 'Email job removed from queue');
  }
}

export const emailProducer = new EmailProducer();
