/**
 * Email search routes
 *
 * GET /search/emails   – full-text search across the authenticated user's emails
 *
 * All results are scoped to the authenticated user (mandatory `userId` filter
 * in Elasticsearch – impossible to bypass via query params).
 *
 * Query parameters
 * ────────────────
 *   q          string   – free-text query (subject + body). Optional; omitting
 *                         returns all emails (match_all) for the user.
 *   status     string   – filter by status: SCHEDULED | PROCESSING | SENT | FAILED
 *   batchId    string   – filter by batch CUID
 *   recipient  string   – filter by exact recipient email address
 *   page       integer  – page number, default 1
 *   limit      integer  – results per page, default 20, max 100
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../auth/auth.middleware';
import { searchService } from './search.service';
import { logger } from '../../infra/logger';

export const searchRouter = Router();

// ─── Query schema ─────────────────────────────────────────────────────────────

const searchQuerySchema = z.object({
  q:         z.string().optional().default(''),
  status:    z.enum(['SCHEDULED', 'PROCESSING', 'SENT', 'FAILED']).optional(),
  batchId:   z.string().cuid().optional(),
  recipient: z.string().email().optional(),
  page:      z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1)).optional().default('1'),
  limit:     z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional().default('20'),
});

// ─── GET /search/emails ───────────────────────────────────────────────────────

searchRouter.get('/emails', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = searchQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({
        error:   'Invalid query parameters',
        details: parsed.error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
      });
      return;
    }

    const { q, status, batchId, recipient, page, limit } = parsed.data;

    const result = await searchService.searchEmails(
      req.userId!,
      q,
      { status, batchId, recipient },
      page,
      limit
    );

    res.status(200).json({
      data: result.hits,
      pagination: {
        total:      result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed';
    logger.error({ err, userId: req.userId }, 'Email search error');

    // Elasticsearch may be temporarily unavailable – return 503 rather than 500
    // so the client can retry.
    res.status(503).json({ error: 'Search service temporarily unavailable', detail: message });
  }
});
