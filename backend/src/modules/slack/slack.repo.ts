/**
 * TODO(lld): Implement Slack repository methods
 * - createInstallation(data): Insert Slack installation record
 * - getInstallationByUser(userId): Get user's Slack installation
 * - updateInstallation(userId, data): Update Slack installation
 * - deleteInstallation(userId): Delete Slack installation
 */

export class SlackRepo {
  async createInstallation(data: {
    userId: string;
    teamId: string;
    accessToken?: string;
    webhookUrl?: string;
    channelId?: string;
  }): Promise<{ id: string }> {
    throw new Error('Not implemented: createInstallation - TODO(lld): Insert Slack installation record');
  }

  async getInstallationByUser(userId: string): Promise<{ webhookUrl?: string; channelId?: string } | null> {
    throw new Error('Not implemented: getInstallationByUser - TODO(lld): Query Slack installation by userId');
  }

  async deleteInstallation(userId: string): Promise<void> {
    throw new Error('Not implemented: deleteInstallation - TODO(lld): Remove Slack installation from database');
  }
}

export const slackRepo = new SlackRepo();
