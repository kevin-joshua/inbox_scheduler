import { Router } from 'express';

export const authRouter = Router();

/**
 * TODO(lld): Implement Google OAuth flow
 * GET /auth/google - Redirect to Google OAuth consent screen
 * GET /auth/google/callback - Handle OAuth callback, exchange code for tokens, create/update user, set session cookie
 * POST /auth/logout - Clear session cookie
 * GET /auth/me - Return current user info from session
 */

authRouter.get('/google', (req, res) => {
  res.status(501).json({ error: 'Not implemented: Google OAuth initiation' });
});

authRouter.get('/google/callback', (req, res) => {
  res.status(501).json({ error: 'Not implemented: Google OAuth callback' });
});

authRouter.post('/logout', (req, res) => {
  res.status(501).json({ error: 'Not implemented: Logout' });
});

authRouter.get('/me', (req, res) => {
  res.status(501).json({ error: 'Not implemented: Get current user' });
});
