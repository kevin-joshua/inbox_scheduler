import { Job } from 'bullmq';

export interface IndexJobData {
  emailId: string;
  subject: string;
  body: string;
  recipient: string;
}

/**
 * TODO(lld): Implement Elasticsearch indexing worker
 * - Receive job with email data
 * - Index email document in Elasticsearch
 * - Handle indexing errors with retry
 */

export async function processIndexJob(job: Job<IndexJobData>): Promise<void> {
  throw new Error('Not implemented: processIndexJob - TODO(lld): Index email in Elasticsearch');
}
