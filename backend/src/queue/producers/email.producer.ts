import { emailQueue } from '../queues';

export interface EmailJobData {
  emailId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
}

/**
 * TODO(lld): Implement email job producer
 * - addEmailJob(data, delay): Add delayed email job to queue
 * - addBulkEmailJobs(jobs): Add multiple email jobs at once
 * - cancelEmailJob(jobId): Remove job from queue
 */

export class EmailProducer {
  async addEmailJob(data: EmailJobData, scheduledAt: Date): Promise<string> {
    throw new Error('Not implemented: addEmailJob - TODO(lld): Add delayed job to BullMQ email queue');
  }

  async addBulkEmailJobs(jobs: Array<{ data: EmailJobData; scheduledAt: Date }>): Promise<void> {
    throw new Error('Not implemented: addBulkEmailJobs - TODO(lld): Add multiple jobs to queue');
  }

  async cancelEmailJob(jobId: string): Promise<void> {
    throw new Error('Not implemented: cancelEmailJob - TODO(lld): Remove job from queue');
  }
}

export const emailProducer = new EmailProducer();
