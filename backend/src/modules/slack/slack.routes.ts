import { Router } from 'express';

export const slackRouter = Router();

/**
 * TODO(lld): Implement Slack OAuth and notification routes
 * GET /slack/install - Redirect to Slack OAuth consent screen
 * GET /slack/callback - Handle OAuth callback, store workspace credentials
 * POST /slack/disconnect - Remove Slack integration for user
 * GET /slack/status - Check if user has Slack connected
 */

slackRouter.get('/install', (req, res) => {
  res.status(501).json({ error: 'Not implemented: Slack OAuth initiation' });
});

slackRouter.get('/callback', (req, res) => {
  res.status(501).json({ error: 'Not implemented: Slack OAuth callback' });
});

slackRouter.post('/disconnect', (req, res) => {
  res.status(501).json({ error: 'Not implemented: Slack disconnect' });
});

slackRouter.get('/status', (req, res) => {
  res.status(501).json({ error: 'Not implemented: Slack status check' });
});
