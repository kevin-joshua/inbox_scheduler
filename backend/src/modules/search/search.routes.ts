import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';

export const searchRouter = Router();

/**
 * TODO(lld): Implement search routes using Elasticsearch
 * GET /search/emails - Full-text search across email subjects and bodies
 */

searchRouter.get('/emails', requireAuth, (req, res) => {
  res.status(501).json({ error: 'Not implemented: Email search' });
});
