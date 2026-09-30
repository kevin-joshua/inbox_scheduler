/**
 * Slack routes
 *
 * GET  /slack/install     – redirect to Slack OAuth consent screen
 * GET  /slack/callback    – handle OAuth callback, store installation
 * POST /slack/disconnect  – remove user's Slack integration
 * GET  /slack/status      – check whether user has Slack connected
 *
 * All routes require authentication (requireAuth middleware).
 *
 * OAuth state parameter
 * ──────────────────────
 * The `state` query param passed to Slack's OAuth URL is the authenticated
 * user's userId, encoded in base64.  On callback Slack echoes it back, and
 * we decode it to identify whose installation this is.  This protects against
 * CSRF: a random attacker cannot complete an installation for another user
 * without first authenticating.
 */

import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../auth/auth.middleware';
import { slackService } from './slack.service';
import { logger } from '../../infra/logger';

export const slackRouter = Router();

// ── GET /slack/install ────────────────────────────────────────────────────────

slackRouter.get('/install', requireAuth, (req: AuthRequest, res: Response): void => {
  try {
    const userId = req.userId!;
    // Encode userId as the OAuth state param (base64 is sufficient; JWT-signing
    // state can be added for extra hardening if needed).
    const state = Buffer.from(userId).toString('base64');
    const installUrl = slackService.buildInstallUrl(state);

    res.redirect(installUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to build Slack install URL';
    logger.error({ err }, 'Slack install error');
    res.status(503).json({ error: message });
  }
});

// ── GET /slack/callback ───────────────────────────────────────────────────────

slackRouter.get('/callback', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code, state, error: oauthError } = req.query as Record<string, string>;

    // Slack sends `error` when the user denies the installation
    if (oauthError) {
      logger.warn({ userId: req.userId, oauthError }, 'Slack OAuth denied by user');
      res.status(400).json({ error: `Slack OAuth denied: ${oauthError}` });
      return;
    }

    if (!code) {
      res.status(400).json({ error: 'Missing code parameter from Slack' });
      return;
    }

    // Validate state param – must decode to the authenticated user's id
    let stateUserId: string;
    try {
      stateUserId = Buffer.from(state ?? '', 'base64').toString('utf8');
    } catch {
      res.status(400).json({ error: 'Invalid state parameter' });
      return;
    }

    if (stateUserId !== req.userId) {
      logger.warn(
        { authenticatedUserId: req.userId, stateUserId },
        'Slack OAuth state mismatch'
      );
      res.status(403).json({ error: 'OAuth state mismatch – please try again' });
      return;
    }

    // Exchange code → credentials
    const credentials = await slackService.exchangeCode(code);

    // Persist (upsert – safe to reconnect)
    await slackService.saveInstallation(req.userId!, credentials);

    logger.info({ userId: req.userId, teamId: credentials.teamId }, 'Slack connected');

    res.status(200).json({
      message: 'Slack connected successfully',
      data: {
        teamId:    credentials.teamId,
        channelId: credentials.channelId ?? null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Slack OAuth callback failed';
    logger.error({ err }, 'Slack callback error');
    res.status(500).json({ error: message });
  }
});

// ── POST /slack/disconnect ────────────────────────────────────────────────────

slackRouter.post('/disconnect', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await slackService.removeInstallation(req.userId!);

    res.status(200).json({ message: 'Slack disconnected successfully' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to disconnect Slack';
    logger.error({ err, userId: req.userId }, 'Slack disconnect error');
    res.status(500).json({ error: message });
  }
});

// ── GET /slack/status ─────────────────────────────────────────────────────────

slackRouter.get('/status', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const status = await slackService.getStatus(req.userId!);

    res.status(200).json({ data: status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get Slack status';
    logger.error({ err, userId: req.userId }, 'Slack status error');
    res.status(500).json({ error: message });
  }
});
