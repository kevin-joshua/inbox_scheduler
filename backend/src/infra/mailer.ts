/**
 * Nodemailer mailer infrastructure
 *
 * • Per-sender connection-pooled transporters cached by sender ID.
 * • Ethereal detection: if smtpHost contains "ethereal.email" the preview
 *   URL is returned so developers can inspect sent messages without a real
 *   inbox.
 * • Stale transporter invalidation: call evictTransporter(senderId) after
 *   updating a sender's SMTP credentials so the next send picks up fresh ones.
 * • Rejection guard: nodemailer considers a send "successful" even if all
 *   recipients were rejected (e.g. SMTP 550). We throw in that case so
 *   BullMQ retries / marks the job failed appropriately.
 */

import nodemailer from 'nodemailer';
import { logger } from './logger';
import { Sender } from '../modules/senders/senders.repo';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmailPayload {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface EmailResult {
  messageId:   string;
  accepted:    string[];
  rejected:    string[];
  response:    string;
  previewUrl:  string | null; // Non-null only for Ethereal test accounts
}

// ─── Transporter cache ────────────────────────────────────────────────────────

// Keyed by sender.id. Evicted on credential update or explicit close.
const transporterCache = new Map<string, nodemailer.Transporter>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** True when the sender uses Ethereal's test SMTP server. */
function isEtherealSender(sender: Sender): boolean {
  return sender.smtpHost.toLowerCase().includes('ethereal.email');
}

/**
 * Build the Ethereal web-preview URL for a given message-id.
 * Only meaningful when the nodemailer test account (smtp.ethereal.email) was used.
 * The message-id envelope format is `<token@ethereal.email>`.
 */
export function getEtherealPreviewUrl(messageId: string): string | null {
  if (!messageId) return null;
  // Strip angle brackets if present: <abc123@ethereal.email> → abc123@ethereal.email
  const clean = messageId.replace(/^<|>$/g, '');
  const token = clean.split('@')[0];
  if (!token) return null;
  return `https://ethereal.email/message/${token}`;
}

// ─── Transporter factory ──────────────────────────────────────────────────────

/**
 * Return a cached (or newly created) nodemailer Transporter for the given sender.
 * The cache key is sender.id so each sender's connection pool is independent.
 */
export function createTransportForSender(sender: Sender): nodemailer.Transporter {
  if (transporterCache.has(sender.id)) {
    return transporterCache.get(sender.id)!;
  }

  const transporter = nodemailer.createTransport({
    host:   sender.smtpHost,
    port:   sender.smtpPort,
    // port 465 → implicit TLS; everything else (587, 25, …) → STARTTLS
    secure: sender.smtpPort === 465,
    auth: {
      user: sender.smtpUser,
      pass: sender.smtpPass, // Already decrypted by the repo layer
    },
    // Connection pool – reuse connections across sequential sends from the
    // same sender to avoid TLS handshake overhead on every message.
    pool:           true,
    maxConnections: 5,
    maxMessages:    100,
    // Timeouts – aggressive enough to fail fast without hanging the worker.
    connectionTimeout: 10_000, // 10 s
    greetingTimeout:   10_000, // 10 s
    socketTimeout:     30_000, // 30 s
  });

  transporterCache.set(sender.id, transporter);

  logger.debug(
    { senderId: sender.id, smtpHost: sender.smtpHost, smtpPort: sender.smtpPort },
    'SMTP transporter created'
  );

  return transporter;
}

// ─── Send ─────────────────────────────────────────────────────────────────────

/**
 * Send one email through the sender's SMTP server.
 *
 * Throws on:
 *  • SMTP connection / authentication errors
 *  • All recipients rejected by the server (250 accepted = 0)
 *
 * Returns EmailResult with messageId, accepted/rejected lists, and a
 * previewUrl (non-null only for Ethereal test accounts).
 */
export async function sendEmail(
  sender: Sender,
  payload: EmailPayload
): Promise<EmailResult> {
  const transporter = createTransportForSender(sender);

  let info: nodemailer.SentMessageInfo;

  try {
    info = await transporter.sendMail({
      from:    payload.from,
      to:      payload.to,
      subject: payload.subject,
      text:    payload.text,
      html:    payload.html,
    });
  } catch (err) {
    // Evict cached transporter on authentication/connection errors so the
    // next attempt gets a fresh connection (handles rotated credentials).
    if (isAuthOrConnectionError(err)) {
      evictTransporter(sender.id);
      logger.warn(
        { senderId: sender.id, smtpHost: sender.smtpHost },
        'SMTP auth/connection error – evicting cached transporter'
      );
    }

    logger.error(
      { senderId: sender.id, recipient: payload.to, subject: payload.subject, err },
      'SMTP sendMail error'
    );
    throw err;
  }

  // ── Rejection guard ──────────────────────────────────────────────────────
  // nodemailer does NOT throw when every recipient is rejected – it just
  // puts them in `rejected`.  We must detect and surface this as an error.

  const accepted: string[] = (info.accepted as string[]) ?? [];
  const rejected: string[] = (info.rejected as string[]) ?? [];

  if (accepted.length === 0 && rejected.length > 0) {
    const reason = `All recipients rejected by SMTP server: ${rejected.join(', ')}`;
    logger.error({ senderId: sender.id, rejected, messageId: info.messageId }, reason);
    throw new Error(reason);
  }

  // ── Ethereal preview URL ─────────────────────────────────────────────────

  const previewUrl = isEtherealSender(sender)
    ? getEtherealPreviewUrl(info.messageId)
    : null;

  logger.info(
    {
      senderId:   sender.id,
      messageId:  info.messageId,
      recipient:  payload.to,
      accepted,
      rejected,
      previewUrl: previewUrl ?? undefined,
    },
    'Email dispatched via SMTP'
  );

  return {
    messageId: info.messageId,
    accepted,
    rejected,
    response:   info.response   ?? '',
    previewUrl,
  };
}

// ─── Cache management ─────────────────────────────────────────────────────────

/**
 * Evict a specific sender's transporter from cache.
 * Call this after updating a sender's SMTP credentials so the next send
 * creates a fresh transporter with the new credentials.
 */
export function evictTransporter(senderId: string): void {
  const t = transporterCache.get(senderId);
  if (t) {
    t.close();
    transporterCache.delete(senderId);
    logger.debug({ senderId }, 'SMTP transporter evicted from cache');
  }
}

// Alias for the existing API surface (used by worker.ts shutdown)
export const closeTransporter = evictTransporter;

/** Close every cached transporter. Called during graceful shutdown. */
export function closeAllTransporters(): void {
  for (const [senderId, transporter] of transporterCache.entries()) {
    transporter.close();
    logger.debug({ senderId }, 'SMTP transporter closed');
  }
  transporterCache.clear();
  logger.info('All SMTP transporters closed');
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function isAuthOrConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('auth') ||
    msg.includes('credentials') ||
    msg.includes('535')  || // 535 = Authentication failed (RFC 4954)
    msg.includes('connect') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout')
  );
}
