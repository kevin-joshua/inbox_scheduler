/**
 * Slack notification worker.
 *
 * Sends an in-app / Slack notification to the email owner on key events
 * (sent, failed, batch_complete).
 *
 * Gracefully no-ops when the user has no Slack integration configured –
 * this is expected and should not cause the job to fail.
 */

import { Job } from 'bullmq';
import { prisma } from '../../db/client';
import { logger } from '../../infra/logger';

export interface NotifyJobData {
  userId: string;
  message: string;
  eventType: 'sent' | 'failed' | 'batch_complete' | 'sender_limit_reached';
  // Optional context fields
  senderId?: string;
  senderEmail?: string;
  emailId?: string;
  batchId?: string;
}

export async function processNotifyJob(job: Job<NotifyJobData>): Promise<void> {
  const { userId, message, eventType } = job.data;

  logger.debug({ jobId: job.id, userId, eventType }, 'Processing notification job');

  // Look up the user's Slack integration
  const slackInstall = await prisma.slackInstall.findUnique({
    where: { userId },
    select: { webhookUrl: true, channelId: true },
  });

  if (!slackInstall?.webhookUrl) {
    // User has not connected Slack – silently complete
    logger.debug({ userId, eventType }, 'No Slack integration – notification skipped');
    return;
  }

  // POST message to the incoming webhook
  const response = await fetch(slackInstall.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Slack webhook responded with ${response.status}: ${body}`
    );
  }

  logger.info({ jobId: job.id, userId, eventType }, 'Slack notification sent');
}
