import { Router } from 'express';
import multer from 'multer';
import { emailsController } from './emails.controller';
import { requireAuth } from '../auth/auth.middleware';
import { validate } from '../../middleware/validate';
import {
  scheduleEmailSchema,
  scheduleBatchSchema,
  uploadCsvSchema,
  getEmailsSchema,
  cancelEmailSchema,
} from './emails.schema';

export const emailsRouter = Router();

// ─── Multer (in-memory storage for CSV / text uploads) ───────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB hard limit
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['text/csv', 'text/plain', 'application/csv', 'application/octet-stream'];
    // Also allow by extension in case the MIME type is generic
    const allowedExt = /\.(csv|txt)$/i;

    if (allowed.includes(file.mimetype) || allowedExt.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and plain-text files are accepted'));
    }
  },
});

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /emails
 * Schedule a single email.
 */
emailsRouter.post(
  '/',
  requireAuth,
  validate(scheduleEmailSchema),
  (req, res) => emailsController.scheduleEmail(req, res)
);

/**
 * POST /emails/batch
 * Schedule multiple emails in a batch.
 */
emailsRouter.post(
  '/batch',
  requireAuth,
  validate(scheduleBatchSchema),
  (req, res) => emailsController.scheduleBatch(req, res)
);

/**
 * POST /emails/upload
 * Upload a CSV / plain-text file to schedule a batch.
 *
 * Expects multipart/form-data with:
 *   - file     : the CSV or .txt file
 *   - senderId : CUID
 *   - subject  : string
 *   - body     : string
 *   - startAt  : ISO 8601 datetime
 *   - delayMs  : integer (optional, default 0)
 *   - hourlyLimit : integer (optional, default 100)
 */
emailsRouter.post(
  '/upload',
  requireAuth,
  upload.single('file'), // multer runs before body validation
  validate(uploadCsvSchema),
  (req, res) => emailsController.uploadCsv(req, res)
);

/**
 * GET /emails
 * List emails for the authenticated user.
 *
 * Query params:
 *   status?  – SCHEDULED | PROCESSING | SENT | FAILED
 *   batchId? – filter by batch CUID
 *   page?    – page number (default 1)
 *   limit?   – page size (default 50, max 200)
 */
emailsRouter.get(
  '/',
  requireAuth,
  validate(getEmailsSchema),
  (req, res) => emailsController.getEmails(req, res)
);

/**
 * DELETE /emails/:id
 * Cancel a scheduled email.
 * Only SCHEDULED emails may be cancelled; PROCESSING/SENT/FAILED return 409.
 */
emailsRouter.delete(
  '/:id',
  requireAuth,
  validate(cancelEmailSchema),
  (req, res) => emailsController.cancelEmail(req, res)
);
