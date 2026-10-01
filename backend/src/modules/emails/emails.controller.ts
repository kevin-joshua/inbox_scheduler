import { Response } from 'express';
import { AuthRequest } from '../auth/auth.middleware';
import { emailsService, NotFoundError, ForbiddenError, ConflictError, QueueUnavailableError } from './emails.service';
import { GetEmailsQuery } from './emails.schema';
import { logger } from '../../infra/logger';

export class EmailsController {
  // ── POST /emails ──────────────────────────────────────────────────────────

  /**
   * Schedule a single email.
   *
   * Body (validated by middleware):
   *   { senderId, recipient, subject, body, scheduledAt }
   */
  async scheduleEmail(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const result = await emailsService.scheduleEmail(req.body, userId);

      res.status(201).json({
        message: 'Email scheduled successfully',
        data: result,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ── POST /emails/batch ────────────────────────────────────────────────────

  /**
   * Schedule a batch of emails.
   *
   * Body (validated by middleware):
   *   { senderId, recipients[], subject, body, startAt, delayMs, hourlyLimit }
   */
  async scheduleBatch(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const result = await emailsService.scheduleBatch(req.body, userId);

      res.status(201).json({
        message: 'Batch scheduled successfully',
        data: result,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ── POST /emails/upload ───────────────────────────────────────────────────

  /**
   * Upload a CSV or plain-text file containing recipient email addresses
   * and schedule a batch.
   *
   * Multipart form fields (validated by middleware):
   *   file  – CSV / TXT file (handled by multer)
   *   senderId, subject, body, startAt, delayMs, hourlyLimit
   */
  async uploadCsv(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;

      // multer attaches the file to req.file
      const file = (req as any).file as Express.Multer.File | undefined;

      if (!file) {
        res.status(400).json({
          error: 'Validation failed',
          details: [{ path: 'file', message: 'A CSV or text file must be provided' }],
        });
        return;
      }

      const result = await emailsService.uploadCsv(file.buffer, req.body, userId);

      res.status(201).json({
        message: 'CSV uploaded and batch scheduled successfully',
        data: result,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ── GET /emails ───────────────────────────────────────────────────────────

  /**
   * Retrieve emails for the authenticated user.
   *
   * Query params (validated by middleware):
   *   status?  – SCHEDULED | PROCESSING | SENT | FAILED
   *   batchId? – filter by batch
   *   page?    – page number (default 1)
   *   limit?   – page size (default 50, max 200)
   */
  async getEmails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;

      // The validate() middleware coerces the query params via Zod transform.
      // Cast through unknown to satisfy TypeScript.
      const query = req.query as unknown as GetEmailsQuery;

      const result = await emailsService.getEmails(userId, query);

      res.status(200).json({
        data: result.emails,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ── DELETE /emails/:id ────────────────────────────────────────────────────

  /**
   * Cancel a scheduled email.
   *
   * Params (validated by middleware):
   *   id – email CUID
   *
   * Rules
   * ─────
   * • Only SCHEDULED emails can be cancelled.
   * • PROCESSING / SENT / FAILED emails respond with 409.
   * • Emails belonging to another user respond with 404 (not revealed).
   */
  async cancelEmail(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const id = String(req.params.id);

      await emailsService.cancelEmail(id, userId);

      res.status(200).json({ message: 'Email cancelled successfully' });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ── Error handler ─────────────────────────────────────────────────────────

  private handleError(error: unknown, res: Response): void {
    if (error instanceof QueueUnavailableError) {
      res.status(503).json({ error: error.message });
      return;
    }
    if (error instanceof NotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }

    if (error instanceof ForbiddenError) {
      // Return 404 for ownership mismatches to avoid resource enumeration
      res.status(404).json({ error: error.message });
      return;
    }

    if (error instanceof ConflictError) {
      res.status(409).json({ error: error.message });
      return;
    }

    logger.error({ error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error }, 'Unhandled error in emails controller');
    res.status(500).json({ error: 'Internal server error' });
  }
}

export const emailsController = new EmailsController();
