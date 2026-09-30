import { Router } from 'express';
import { requireAuth, AuthRequest } from '../auth/auth.middleware';

export const searchRouter = Router();

/**
 * GET /search/emails
 * Full-text search across email subjects and bodies
 * Requires authentication - searches only user's emails
 */
searchRouter.get('/emails', requireAuth, (req: AuthRequest, res) => {
  res.status(501).json({
    error: 'Not implemented: Email search',
    userId: req.userId, // Demonstrates user scoping
  });
});
