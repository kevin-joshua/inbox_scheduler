import { Job } from 'bullmq';

export interface NotifyJobData {
  userId: string;
  message: string;
  eventType: 'sent' | 'failed' | 'batch_complete';
}

/**
 * TODO(lld): Implement Slack notification worker
 * - Receive job with userId and message
 * - Check if user has Slack integration enabled
 * - Send notification to user's Slack channel
 * - Handle notification errors gracefully
 */

export async function processNotifyJob(job: Job<NotifyJobData>): Promise<void> {
  throw new Error('Not implemented: processNotifyJob - TODO(lld): Send Slack notification');
}
