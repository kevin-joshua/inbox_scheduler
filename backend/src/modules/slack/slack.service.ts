/**
 * TODO(lld): Implement Slack service methods
 * - exchangeCode(code): Exchange OAuth code for Slack tokens
 * - saveInstallation(userId, tokens): Store Slack workspace credentials
 * - sendNotification(userId, message): Send notification to user's Slack channel
 * - removeInstallation(userId): Remove Slack integration
 */

export class SlackService {
  async exchangeCode(code: string): Promise<{ accessToken: string; teamId: string; webhookUrl: string }> {
    throw new Error('Not implemented: exchangeCode - TODO(lld): Exchange OAuth code for Slack tokens');
  }

  async saveInstallation(userId: string, data: { teamId: string; accessToken?: string; webhookUrl?: string }): Promise<void> {
    throw new Error('Not implemented: saveInstallation - TODO(lld): Store Slack credentials in database');
  }

  async sendNotification(userId: string, message: string): Promise<void> {
    throw new Error('Not implemented: sendNotification - TODO(lld): Send message to user\'s Slack channel');
  }
}

export const slackService = new SlackService();
