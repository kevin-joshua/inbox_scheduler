import { Router } from 'express';
import { requireAuth, AuthRequest } from '../auth/auth.middleware';

export const slackRouter = Router();

/**
 * GET /slack/install
 * Redirect to Slack OAuth consent screen
 * Requires authentication
 */
slackRouter.get('/install', requireAuth, (req: AuthRequest, res) => {
  res.status(501).json({
    error: 'Not implemented: Slack OAuth initiation',
    userId: req.userId,
  });
});

/**
 * GET /slack/callback
 * Handle OAuth callback, store workspace credentials
 * Requires authentication
 */
slackRouter.get('/callback', requireAuth, (req: AuthRequest, res) => {
  res.status(501).json({
    error: 'Not implemented: Slack OAuth callback',
    userId: req.userId,
  });
});

/**
 * POST /slack/disconnect
 * Remove Slack integration for user
 * Requires authentication
 */
slackRouter.post('/disconnect', requireAuth, (req: AuthRequest, res) => {
  res.status(501).json({
    error: 'Not implemented: Slack disconnect',
    userId: req.userId,
  });
});

/**
 * GET /slack/status
 * Check if user has Slack connected
 * Requires authentication
 */
slackRouter.get('/status', requireAuth, (req: AuthRequest, res) => {
  res.status(501).json({
    error: 'Not implemented: Slack status check',
    userId: req.userId,
  });
});
