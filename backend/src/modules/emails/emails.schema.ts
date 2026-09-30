import { z } from 'zod';

export const scheduleEmailSchema = z.object({
  senderId: z.string().cuid(),
  recipient: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  scheduledAt: z.string().datetime(),
});

export const scheduleBatchSchema = z.object({
  senderId: z.string().cuid(),
  recipients: z.array(z.string().email()).min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  startAt: z.string().datetime(),
  delayMs: z.number().int().min(0),
  hourlyLimit: z.number().int().min(1),
});

export const uploadCsvSchema = z.object({
  senderId: z.string().cuid(),
  subject: z.string().min(1),
  body: z.string().min(1),
  startAt: z.string().datetime(),
  delayMs: z.number().int().min(0),
  hourlyLimit: z.number().int().min(1),
});

export type ScheduleEmailInput = z.infer<typeof scheduleEmailSchema>;
export type ScheduleBatchInput = z.infer<typeof scheduleBatchSchema>;
export type UploadCsvInput = z.infer<typeof uploadCsvSchema>;
