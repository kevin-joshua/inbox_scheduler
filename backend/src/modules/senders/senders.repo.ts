import { prisma } from '../../db/client';
import { logger } from '../../infra/logger';
import { encrypt, decrypt } from '../../utils/encryption';

export interface SenderData {
  userId: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
}

export interface Sender {
  id: string;
  userId: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string; // Decrypted when retrieved
  createdAt: Date;
}

export interface SenderSummary {
  id: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  createdAt: Date;
}

export class SendersRepo {
  /**
   * Create a new sender with encrypted SMTP password
   */
  async createSender(data: SenderData): Promise<Sender> {
    try {
      // Encrypt SMTP password before storing
      const encryptedPassword = encrypt(data.smtpPass);

      const sender = await prisma.sender.create({
        data: {
          userId: data.userId,
          email: data.email,
          smtpHost: data.smtpHost,
          smtpPort: data.smtpPort,
          smtpUser: data.smtpUser,
          smtpPass: encryptedPassword,
        },
      });

      logger.info({ senderId: sender.id, email: sender.email, userId: data.userId }, 'Sender created');

      // Return with decrypted password
      return {
        ...sender,
        smtpPass: data.smtpPass, // Return original unencrypted password
      };
    } catch (error) {
      logger.error({ error, email: data.email }, 'Failed to create sender');
      throw new Error('Failed to create sender');
    }
  }

  /**
   * Get all senders for a user (summary only, no passwords)
   */
  async getSendersByUser(userId: string): Promise<SenderSummary[]> {
    try {
      const senders = await prisma.sender.findMany({
        where: { userId },
        select: {
          id: true,
          email: true,
          smtpHost: true,
          smtpPort: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return senders;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to fetch senders');
      throw new Error('Failed to fetch senders');
    }
  }

  /**
   * Get sender by ID with decrypted SMTP credentials
   */
  async getSenderById(senderId: string): Promise<Sender | null> {
    try {
      const sender = await prisma.sender.findUnique({
        where: { id: senderId },
      });

      if (!sender) {
        return null;
      }

      // Decrypt SMTP password
      const decryptedPassword = decrypt(sender.smtpPass);

      return {
        ...sender,
        smtpPass: decryptedPassword,
      };
    } catch (error) {
      logger.error({ error, senderId }, 'Failed to fetch sender');
      throw new Error('Failed to fetch sender');
    }
  }

  /**
   * Update sender (re-encrypts password if provided)
   */
  async updateSender(
    senderId: string,
    data: Partial<Omit<SenderData, 'userId'>>
  ): Promise<Sender> {
    try {
      const updateData: any = { ...data };

      // Re-encrypt password if it's being updated
      if (data.smtpPass) {
        updateData.smtpPass = encrypt(data.smtpPass);
      }

      const sender = await prisma.sender.update({
        where: { id: senderId },
        data: updateData,
      });

      logger.info({ senderId, email: sender.email }, 'Sender updated');

      // Decrypt password for return
      const decryptedPassword = decrypt(sender.smtpPass);

      return {
        ...sender,
        smtpPass: decryptedPassword,
      };
    } catch (error) {
      logger.error({ error, senderId }, 'Failed to update sender');
      throw new Error('Failed to update sender');
    }
  }

  /**
   * Delete sender
   */
  async deleteSender(senderId: string): Promise<void> {
    try {
      await prisma.sender.delete({
        where: { id: senderId },
      });

      logger.info({ senderId }, 'Sender deleted');
    } catch (error) {
      logger.error({ error, senderId }, 'Failed to delete sender');
      throw new Error('Failed to delete sender');
    }
  }

  /**
   * Validate sender belongs to user
   */
  async validateSenderOwnership(senderId: string, userId: string): Promise<boolean> {
    try {
      const sender = await prisma.sender.findFirst({
        where: {
          id: senderId,
          userId: userId,
        },
      });

      return sender !== null;
    } catch (error) {
      logger.error({ error, senderId, userId }, 'Failed to validate sender ownership');
      return false;
    }
  }

  /**
   * Get senders by IDs (for batch operations)
   */
  async getSendersByIds(senderIds: string[]): Promise<Sender[]> {
    try {
      const senders = await prisma.sender.findMany({
        where: {
          id: { in: senderIds },
        },
      });

      // Decrypt all passwords
      return senders.map((sender) => ({
        ...sender,
        smtpPass: decrypt(sender.smtpPass),
      }));
    } catch (error) {
      logger.error({ error, senderIds }, 'Failed to fetch senders by IDs');
      throw new Error('Failed to fetch senders');
    }
  }
}

export const sendersRepo = new SendersRepo();
