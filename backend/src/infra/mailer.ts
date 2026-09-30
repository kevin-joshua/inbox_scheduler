import nodemailer from 'nodemailer';
import { logger } from './logger';

let transporter: nodemailer.Transporter | null = null;

export interface EmailPayload {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Get or create nodemailer transporter
 * TODO(lld): This will use Ethereal SMTP for testing. In production, configure with
 * real SMTP credentials from Sender records stored in the database.
 */
export function getMailer(): nodemailer.Transporter {
  if (!transporter) {
    // TODO(lld): Create Ethereal test account dynamically or use sender-specific SMTP config
    // For now, create a basic transporter that will fail until configured
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: 'example@ethereal.email',
        pass: 'password',
      },
    });

    logger.warn('Mailer initialized with placeholder config. Configure real SMTP credentials.');
  }

  return transporter;
}

/**
 * Send an email using the configured transporter
 * TODO(lld): Implement actual email sending logic with proper error handling,
 * retry logic, and sender-specific SMTP configuration.
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  throw new Error('Not implemented: sendEmail - TODO(lld): Implement SMTP sending with sender-specific credentials');
}
