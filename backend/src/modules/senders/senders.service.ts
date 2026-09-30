import { sendersRepo, SenderData, Sender, SenderSummary } from './senders.repo';
import { logger } from '../../infra/logger';
import nodemailer from 'nodemailer';

export class SendersService {
  /**
   * Create a new sender with SMTP credential validation
   */
  async createSender(data: SenderData, userId: string): Promise<Sender> {
    // Ensure userId matches
    if (data.userId !== userId) {
      throw new Error('User ID mismatch');
    }

    // Validate SMTP credentials by attempting to connect
    await this.validateSmtpCredentials(data);

    return await sendersRepo.createSender(data);
  }

  /**
   * Get all senders for a user
   */
  async getSendersByUser(userId: string): Promise<SenderSummary[]> {
    return await sendersRepo.getSendersByUser(userId);
  }

  /**
   * Get sender by ID with ownership validation
   */
  async getSenderById(senderId: string, userId: string): Promise<Sender> {
    const sender = await sendersRepo.getSenderById(senderId);

    if (!sender) {
      throw new Error('Sender not found');
    }

    // Validate ownership
    if (sender.userId !== userId) {
      throw new Error('Unauthorized: Sender does not belong to user');
    }

    return sender;
  }

  /**
   * Update sender with ownership validation
   */
  async updateSender(
    senderId: string,
    userId: string,
    data: Partial<Omit<SenderData, 'userId'>>
  ): Promise<Sender> {
    // Validate ownership first
    const isOwner = await sendersRepo.validateSenderOwnership(senderId, userId);
    if (!isOwner) {
      throw new Error('Unauthorized: Sender does not belong to user');
    }

    // If SMTP credentials are being updated, validate them
    if (data.smtpHost || data.smtpPort || data.smtpUser || data.smtpPass) {
      const currentSender = await sendersRepo.getSenderById(senderId);
      if (!currentSender) {
        throw new Error('Sender not found');
      }

      const testData: SenderData = {
        userId,
        email: data.email || currentSender.email,
        smtpHost: data.smtpHost || currentSender.smtpHost,
        smtpPort: data.smtpPort || currentSender.smtpPort,
        smtpUser: data.smtpUser || currentSender.smtpUser,
        smtpPass: data.smtpPass || currentSender.smtpPass,
      };

      await this.validateSmtpCredentials(testData);
    }

    return await sendersRepo.updateSender(senderId, data);
  }

  /**
   * Delete sender with ownership validation
   */
  async deleteSender(senderId: string, userId: string): Promise<void> {
    // Validate ownership
    const isOwner = await sendersRepo.validateSenderOwnership(senderId, userId);
    if (!isOwner) {
      throw new Error('Unauthorized: Sender does not belong to user');
    }

    await sendersRepo.deleteSender(senderId);
  }

  /**
   * Validate SMTP credentials by attempting to verify connection
   */
  private async validateSmtpCredentials(data: SenderData): Promise<void> {
    try {
      const transporter = nodemailer.createTransport({
        host: data.smtpHost,
        port: data.smtpPort,
        secure: data.smtpPort === 465, // true for 465, false for other ports
        auth: {
          user: data.smtpUser,
          pass: data.smtpPass,
        },
      });

      // Verify connection
      await transporter.verify();

      logger.info({ email: data.email, smtpHost: data.smtpHost }, 'SMTP credentials validated');
    } catch (error) {
      logger.error({ error, smtpHost: data.smtpHost }, 'SMTP credential validation failed');
      throw new Error('Invalid SMTP credentials: Unable to connect to SMTP server');
    }
  }

  /**
   * Test sender by sending a test email
   */
  async testSender(senderId: string, userId: string, testEmail: string): Promise<void> {
    const sender = await this.getSenderById(senderId, userId);

    try {
      const transporter = nodemailer.createTransport({
        host: sender.smtpHost,
        port: sender.smtpPort,
        secure: sender.smtpPort === 465,
        auth: {
          user: sender.smtpUser,
          pass: sender.smtpPass,
        },
      });

      await transporter.sendMail({
        from: sender.email,
        to: testEmail,
        subject: 'Test Email from ReachInbox',
        text: 'This is a test email to verify your SMTP configuration.',
        html: '<p>This is a test email to verify your SMTP configuration.</p>',
      });

      logger.info({ senderId, testEmail }, 'Test email sent successfully');
    } catch (error) {
      logger.error({ error, senderId }, 'Failed to send test email');
      throw new Error('Failed to send test email');
    }
  }
}

export const sendersService = new SendersService();
