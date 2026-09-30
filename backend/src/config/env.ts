import { config } from 'dotenv';
import { resolve } from 'path';
import { z } from 'zod';
import { logger } from '../infra/logger';

config({ path: resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('4000').transform(Number),
  FRONTEND_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  COOKIE_NAME: z.string().default('reachinbox_session'),
  ENCRYPTION_KEY: z.string().length(64, 'Encryption key must be 64 hex characters (32 bytes)'),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),

  // Elasticsearch
  ELASTICSEARCH_URL: z.string().url(),

  // Google OAuth (required for authentication)
  GOOGLE_CLIENT_ID: z.string().min(1, 'Google Client ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'Google Client Secret is required'),
  GOOGLE_REDIRECT_URI: z.string().url(),

  // Slack OAuth (optional for now, will be required when Slack integration is implemented)
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  SLACK_REDIRECT_URI: z.string().url().optional(),

  // Scheduler Configuration
  WORKER_CONCURRENCY: z.string().default('5').transform(Number),
  MIN_DELAY_BETWEEN_EMAILS_MS: z.string().default('2000').transform(Number),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.string().default('100').transform(Number),
  MAX_JOB_ATTEMPTS: z.string().default('3').transform(Number),
  SMTP_RETRY_BACKOFF_MS: z.string().default('5000').transform(Number),

  // Bull Board
  BULL_BOARD_USER: z.string(),
  BULL_BOARD_PASSWORD: z.string(),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  try {
    const parsed = envSchema.parse(process.env);
    
    // Log warning for optional Slack credentials
    if (!parsed.SLACK_CLIENT_ID || !parsed.SLACK_CLIENT_SECRET) {
      logger.warn('Slack OAuth credentials not configured. Slack integration will not work.');
    }
    
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(
        (err) => `${err.path.join('.')}: ${err.message}`
      );
      throw new Error(
        `Environment validation failed:\n${messages.join('\n')}`
      );
    }
    throw error;
  }
}

export const env = validateEnv();
