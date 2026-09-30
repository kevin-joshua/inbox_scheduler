/**
 * Slack service — OAuth flow, installation management, and message delivery.
 *
 * OAuth flow (incoming webhook)
 * ──────────────────────────────
 *  1. GET /slack/install  →  redirect to Slack's OAuth consent URL
 *  2. Slack redirects to GET /slack/callback?code=…
 *  3. exchangeCode()  →  POST to slack.com/api/oauth.v2.access
 *  4. Store teamId + webhookUrl (+ optional accessToken / channelId)
 *
 * Security notes
 * ──────────────
 * • accessToken is stored encrypted-at-rest by Prisma (plain column for now;
 *   rotate via Sender encryption pattern if needed).
 * • accessToken is NEVER logged.
 * • webhookUrl is also sensitive (anyone with it can post to the channel) –
 *   it is not logged either.
 * • When SLACK_CLIENT_ID / SECRET are absent the service throws a clear error
 *   rather than silently misbehaving.
 */

import { env } from '../../config/env';
import { slackRepo, SlackInstallRecord } from './slack.repo';
import { logger } from '../../infra/logger';

// ─── Slack API response shapes ────────────────────────────────────────────────

interface SlackOAuthResponse {
  ok:           boolean;
  error?:       string;
  team:         { id: string; name: string };
  access_token?: string;
  incoming_webhook?: {
    url:     string;
    channel: string;
    channel_id: string;
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class SlackService {
  /**
   * Build the Slack OAuth consent URL the user should be redirected to.
   * Scopes:  incoming-webhook   – post messages to a channel
   *          chat:write         – alternative if using Bot token
   */
  buildInstallUrl(state: string): string {
    this.requireCredentials();

    const params = new URLSearchParams({
      client_id:    env.SLACK_CLIENT_ID!,
      scope:        'incoming-webhook',
      redirect_uri: env.SLACK_REDIRECT_URI!,
      state,
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * Exchange an OAuth authorization code for credentials.
   * Called from the /slack/callback route handler.
   *
   * Returns the data needed to call saveInstallation().
   */
  async exchangeCode(code: string): Promise<{
    teamId:      string;
    accessToken: string | undefined;
    webhookUrl:  string | undefined;
    channelId:   string | undefined;
  }> {
    this.requireCredentials();

    const params = new URLSearchParams({
      code,
      client_id:     env.SLACK_CLIENT_ID!,
      client_secret: env.SLACK_CLIENT_SECRET!,
      redirect_uri:  env.SLACK_REDIRECT_URI!,
    });

    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Slack API HTTP error: ${response.status}`);
    }

    const data = (await response.json()) as SlackOAuthResponse;

    if (!data.ok) {
      throw new Error(`Slack OAuth failed: ${data.error ?? 'unknown_error'}`);
    }

    logger.info({ teamId: data.team.id, teamName: data.team.name }, 'Slack OAuth code exchanged');
    // Deliberately NOT logging accessToken or webhookUrl

    return {
      teamId:      data.team.id,
      accessToken: data.access_token,
      webhookUrl:  data.incoming_webhook?.url,
      channelId:   data.incoming_webhook?.channel_id,
    };
  }

  /**
   * Persist (or replace) a Slack installation for a user.
   * Safe to call on reconnect – upserts the existing record.
   */
  async saveInstallation(
    userId: string,
    data:   { teamId: string; accessToken?: string; webhookUrl?: string; channelId?: string }
  ): Promise<SlackInstallRecord> {
    return slackRepo.upsertInstallation({ userId, ...data });
  }

  /**
   * Get the installation status for a user (no sensitive fields).
   */
  async getStatus(userId: string): Promise<{
    connected:  boolean;
    teamId?:    string;
    channelId?: string;
    installedAt?: Date;
  }> {
    const record = await slackRepo.getInstallationByUser(userId);

    if (!record) {
      return { connected: false };
    }

    return {
      connected:   true,
      teamId:      record.teamId,
      channelId:   record.channelId ?? undefined,
      installedAt: record.createdAt,
    };
  }

  /**
   * Send a Slack message to a user's connected workspace.
   * Silently no-ops when:
   *  • The user has no Slack installation.
   *  • The installation has no webhookUrl.
   *
   * Throws when the webhook responds with a non-2xx status so the caller
   * (notify worker) can decide whether to retry.
   */
  async sendNotification(userId: string, message: string): Promise<void> {
    const webhookUrl = await slackRepo.getWebhookUrl(userId);

    if (!webhookUrl) {
      logger.debug({ userId }, 'Slack notification skipped – no webhook configured');
      return;
    }

    const response = await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      // Slack incoming-webhook payload
      body: JSON.stringify({
        text: message,
        // Unfurl links to keep messages clean
        unfurl_links: false,
        unfurl_media: false,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      // Deliberate: do NOT log webhookUrl
      throw new Error(`Slack webhook returned ${response.status}: ${body}`);
    }

    logger.info({ userId }, 'Slack notification delivered');
    // Deliberate: do NOT log webhookUrl or message content
  }

  /**
   * Remove a user's Slack integration.
   * Note: this does NOT revoke the Slack access token (would require a
   * POST to auth.revoke). Revocation can be added if needed.
   */
  async removeInstallation(userId: string): Promise<void> {
    await slackRepo.deleteInstallation(userId);
    logger.info({ userId }, 'Slack installation removed');
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private requireCredentials(): void {
    if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET || !env.SLACK_REDIRECT_URI) {
      throw new Error(
        'Slack OAuth is not configured. Set SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, and SLACK_REDIRECT_URI.'
      );
    }
  }
}

export const slackService = new SlackService();
