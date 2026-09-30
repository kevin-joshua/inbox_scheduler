import nodemailer from 'nodemailer';
import { logger } from './logger';
import { Sender } from '../modules/senders/senders.repo';

// Cache of transporters by sender ID
const transporterCache = new Map<string, nodemailer.Transporter>();

export interface EmailPayload {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface EmailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
  response: string;
}

/**
 * Create a nodemailer transporter for a specific sender
 * Uses sender-specific SMTP credentials from the database
 */
export function createTransportForSender(sender: Sender): nodemailer.Transporter {
  // Check cache first
  if (transporterCache.has(sender.id)) {
    return transporterCache.get(sender.id)!;
  }

  const transporter = nodemailer.createTransport({
    host: sender.smtpHost,
    port: sender.smtpPort,
    secure: sender.smtpPort === 465, // true for 465, false for other ports (like 587)
    auth: {
      user: sender.smtpUser,
      pass: sender.smtpPass, // Already decrypted by repo
    },
    // Connection pool settings
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    // Timeout settings
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 30000, // 30 seconds
  });

  // Cache the transporter
  transporterCache.set(sender.id, transporter);

  logger.info(
    { senderId: sender.id, smtpHost: sender.smtpHost, smtpPort: sender.smtpPort },
    'Transporter created for sender'
  );

  return transporter;
}

/**
 * Send an email using sender-specific SMTP credentials
 */
export async function sendEmail(
  sender: Sender,
  payload: EmailPayload
): Promise<EmailResult> {
  try {
    const transporter = createTransportForSender(sender);

    const info = await transporter.sendMail({
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });

    logger.info(
      {
        senderId: sender.id,
        messageId: info.messageId,
        recipient: payload.to,
        accepted: info.accepted,
        rejected: info.rejected,
      },
      'Email sent successfully'
    );

    return {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    };
  } catch (error) {
    logger.error(
      {
        error,
        senderId: sender.id,
        recipient: payload.to,
        subject: payload.subject,
      },
      'Failed to send email'
    );
    throw error;
  }
}

/**
 * Close a specific sender's transporter
 * Useful when updating sender credentials
 */
export function closeTransporter(senderId: string): void {
  const transporter = transporterCache.get(senderId);
  if (transporter) {
    transporter.close();
    transporterCache.delete(senderId);
    logger.info({ senderId }, 'Transporter closed');
  }
}

/**
 * Close all transporters
 * Called during graceful shutdown
 */
export function closeAllTransporters(): void {
  for (const [senderId, transporter] of transporterCache.entries()) {
    transporter.close();
    logger.debug({ senderId }, 'Transporter closed');
  }
  transporterCache.clear();
  logger.info('All transporters closed');
}

/**
 * Get Ethereal preview URL for test emails
 * Only works with Ethereal SMTP (smtp.ethereal.email)
 */
export function getEtherealPreviewUrl(messageId: string): string | null {
  if (!messageId) return null;
  // Ethereal message IDs can be used to construct preview URLs
  return `https://ethereal.email/message/${messageId}`;
}
