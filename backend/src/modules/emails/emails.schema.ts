import { z } from 'zod';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Validates that a datetime string represents a moment at least 30 seconds
 * in the future, preventing scheduling in the past.
 */
const futureDateTime = z
  .string()
  .datetime({ message: 'Must be a valid ISO 8601 datetime string' })
  .refine(
    (val) => new Date(val).getTime() > Date.now() + 30_000,
    { message: 'Scheduled time must be at least 30 seconds in the future' }
  );

// ─── POST /emails ────────────────────────────────────────────────────────────

export const scheduleEmailSchema = z.object({
  body: z.object({
    senderId: z.string().cuid('senderId must be a valid CUID'),
    recipient: z.string().email('recipient must be a valid email address'),
    subject: z.string().min(1, 'subject is required').max(998, 'subject too long'),
    body: z.string().min(1, 'body is required'),
    scheduledAt: futureDateTime,
  }),
});

// ─── POST /emails/batch ──────────────────────────────────────────────────────

export const scheduleBatchSchema = z.object({
  body: z.object({
    senderId: z.string().cuid('senderId must be a valid CUID'),
    recipients: z
      .array(z.string().email())
      .min(1, 'At least one recipient is required')
      .max(10_000, 'Maximum 10,000 recipients per batch'),
    subject: z.string().min(1, 'subject is required').max(998, 'subject too long'),
    body: z.string().min(1, 'body is required'),
    startAt: futureDateTime,
    delayMs: z
      .number({ invalid_type_error: 'delayMs must be a number' })
      .int('delayMs must be an integer')
      .min(0, 'delayMs cannot be negative'),
    hourlyLimit: z
      .number({ invalid_type_error: 'hourlyLimit must be a number' })
      .int('hourlyLimit must be an integer')
      .min(1, 'hourlyLimit must be at least 1')
      .max(10_000, 'hourlyLimit too high'),
  }),
});

// ─── POST /emails/upload ─────────────────────────────────────────────────────

/**
 * The file itself is validated by multer middleware.
 * This schema validates the multipart form fields sent alongside the file.
 */
export const uploadCsvSchema = z.object({
  body: z.object({
    senderId: z.string().cuid('senderId must be a valid CUID'),
    subject: z.string().min(1, 'subject is required').max(998, 'subject too long'),
    body: z.string().min(1, 'body is required'),
    startAt: futureDateTime,
    delayMs: z
      .union([
        z.number().int().min(0),
        z.string().regex(/^\d+$/, 'delayMs must be a non-negative integer string').transform(Number),
      ])
      .default(0),
    hourlyLimit: z
      .union([
        z.number().int().min(1).max(10_000),
        z
          .string()
          .regex(/^\d+$/, 'hourlyLimit must be a positive integer string')
          .transform(Number)
          .pipe(z.number().int().min(1).max(10_000)),
      ])
      .default(100),
  }),
});

// ─── GET /emails ─────────────────────────────────────────────────────────────

export const getEmailsSchema = z.object({
  query: z.object({
    status: z
      .enum(['SCHEDULED', 'PROCESSING', 'SENT', 'FAILED'], {
        message: 'status must be one of SCHEDULED, PROCESSING, SENT, FAILED',
      })
      .optional(),
    batchId: z.string().cuid('batchId must be a valid CUID').optional(),
    page: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .pipe(z.number().int().min(1))
      .optional()
      .default('1'),
    limit: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .pipe(z.number().int().min(1).max(200))
      .optional()
      .default('50'),
  }),
});

// ─── DELETE /emails/:id ──────────────────────────────────────────────────────

export const cancelEmailSchema = z.object({
  params: z.object({
    id: z.string().cuid('Email ID must be a valid CUID'),
  }),
});

// ─── Inferred types ──────────────────────────────────────────────────────────

export type ScheduleEmailInput = z.infer<typeof scheduleEmailSchema>['body'];
export type ScheduleBatchInput = z.infer<typeof scheduleBatchSchema>['body'];
export type UploadCsvInput = z.infer<typeof uploadCsvSchema>['body'];
export type GetEmailsQuery = z.infer<typeof getEmailsSchema>['query'];
