/**
 * Slack repository — CRUD for the slack_installs table.
 *
 * Security notes
 * ──────────────
 * • accessToken and webhookUrl are sensitive; they are NEVER logged.
 * • upsert is used so reconnecting (new OAuth flow for an existing user)
 *   replaces the old installation without requiring a prior disconnect.
 */

import { prisma } from '../../db/client';
import { logger } from '../../infra/logger';

export interface SlackInstallData {
  userId:      string;
  teamId:      string;
  accessToken?: string;
  webhookUrl?:  string;
  channelId?:   string;
}

export interface SlackInstallRecord {
  id:         string;
  userId:     string;
  teamId:     string;
  webhookUrl: string | null;
  channelId:  string | null;
  createdAt:  Date;
  // accessToken intentionally omitted – never expose outside repo layer
}

export class SlackRepo {
  /**
   * Create or replace the Slack installation for a user.
   * Uses upsert so reconnecting without prior disconnect works seamlessly.
   */
  async upsertInstallation(data: SlackInstallData): Promise<SlackInstallRecord> {
    const record = await prisma.slackInstall.upsert({
      where:  { userId: data.userId },
      create: {
        userId:      data.userId,
        teamId:      data.teamId,
        accessToken: data.accessToken,
        webhookUrl:  data.webhookUrl,
        channelId:   data.channelId,
      },
      update: {
        teamId:      data.teamId,
        accessToken: data.accessToken,
        webhookUrl:  data.webhookUrl,
        channelId:   data.channelId,
      },
      select: {
        id:         true,
        userId:     true,
        teamId:     true,
        webhookUrl: true,
        channelId:  true,
        createdAt:  true,
        // accessToken NOT selected — never leak it out of the repo
      },
    });

    logger.info({ userId: data.userId, teamId: data.teamId }, 'Slack installation upserted');
    return record;
  }

  // Keep the old createInstallation name as an alias for backward-compat
  async createInstallation(data: SlackInstallData): Promise<{ id: string }> {
    return this.upsertInstallation(data);
  }

  /**
   * Get the Slack installation for a user.
   * Returns null when the user has no integration.
   * webhookUrl and channelId are safe to return; accessToken is excluded.
   */
  async getInstallationByUser(userId: string): Promise<SlackInstallRecord | null> {
    return prisma.slackInstall.findUnique({
      where:  { userId },
      select: {
        id:         true,
        userId:     true,
        teamId:     true,
        webhookUrl: true,
        channelId:  true,
        createdAt:  true,
      },
    });
  }

  /**
   * Get ONLY the webhookUrl for a user (used by the notify worker – minimal query).
   * Returns null when no installation exists or webhookUrl is not set.
   */
  async getWebhookUrl(userId: string): Promise<string | null> {
    const record = await prisma.slackInstall.findUnique({
      where:  { userId },
      select: { webhookUrl: true },
    });
    return record?.webhookUrl ?? null;
  }

  /**
   * Remove the Slack installation for a user (disconnect).
   * No-ops if the user has no installation.
   */
  async deleteInstallation(userId: string): Promise<void> {
    await prisma.slackInstall.deleteMany({ where: { userId } });
    logger.info({ userId }, 'Slack installation removed');
  }

  /**
   * Check whether a user has a Slack integration installed.
   */
  async hasInstallation(userId: string): Promise<boolean> {
    const count = await prisma.slackInstall.count({ where: { userId } });
    return count > 0;
  }
}

export const slackRepo = new SlackRepo();
