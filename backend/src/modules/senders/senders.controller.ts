import { Response } from 'express';
import { AuthRequest } from '../auth/auth.middleware';
import { sendersService } from './senders.service';
import { logger } from '../../infra/logger';

export class SendersController {
  /**
   * GET /senders
   * Get all senders for the authenticated user
   */
  async getSenders(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const senders = await sendersService.getSendersByUser(req.userId);

      res.json({
        senders,
        count: senders.length,
      });
    } catch (error) {
      logger.error({ error, userId: req.userId }, 'Failed to fetch senders');
      res.status(500).json({ error: 'Failed to fetch senders' });
    }
  }

  /**
   * GET /senders/:id
   * Get a specific sender by ID
   */
  async getSender(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      if (Array.isArray(id)) {
        res.status(400).json({ error: 'Invalid sender ID' });
        return;
      }
      const sender = await sendersService.getSenderById(id, req.userId);

      res.json(sender);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch sender';

      if (errorMessage.includes('not found')) {
        res.status(404).json({ error: errorMessage });
      } else if (errorMessage.includes('Unauthorized')) {
        res.status(403).json({ error: errorMessage });
      } else {
        logger.error({ error, userId: req.userId }, 'Failed to fetch sender');
        res.status(500).json({ error: 'Failed to fetch sender' });
      }
    }
  }

  /**
   * POST /senders
   * Create a new sender
   */
  async createSender(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { email, smtpHost, smtpPort, smtpUser, smtpPass } = req.body;

      // Validation
      if (!email || !smtpHost || !smtpPort || !smtpUser || !smtpPass) {
        res.status(400).json({
          error: 'Missing required fields',
          required: ['email', 'smtpHost', 'smtpPort', 'smtpUser', 'smtpPass'],
        });
        return;
      }

      const sender = await sendersService.createSender(
        {
          userId: req.userId,
          email,
          smtpHost,
          smtpPort: parseInt(smtpPort, 10),
          smtpUser,
          smtpPass,
        },
        req.userId
      );

      res.status(201).json({
        message: 'Sender created successfully',
        sender: {
          id: sender.id,
          email: sender.email,
          smtpHost: sender.smtpHost,
          smtpPort: sender.smtpPort,
          createdAt: sender.createdAt,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create sender';

      if (/invalid smtp|smtp credential|authentication|EAUTH/i.test(errorMessage)) {
        res.status(400).json({
          error: 'Invalid SMTP credentials. Gmail requires an App Password when 2-Step Verification is enabled.',
        });
      } else {
        logger.error({ error, userId: req.userId }, 'Failed to create sender');
        res.status(500).json({ error: 'Failed to create sender' });
      }
    }
  }

  /**
   * PATCH /senders/:id
   * Update a sender
   */
  async updateSender(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      if (Array.isArray(id)) {
        res.status(400).json({ error: 'Invalid sender ID' });
        return;
      }

      const { email, smtpHost, smtpPort, smtpUser, smtpPass } = req.body;

      const updateData: any = {};
      if (email) updateData.email = email;
      if (smtpHost) updateData.smtpHost = smtpHost;
      if (smtpPort) updateData.smtpPort = parseInt(smtpPort, 10);
      if (smtpUser) updateData.smtpUser = smtpUser;
      if (smtpPass) updateData.smtpPass = smtpPass;

      const sender = await sendersService.updateSender(id, req.userId, updateData);

      res.json({
        message: 'Sender updated successfully',
        sender: {
          id: sender.id,
          email: sender.email,
          smtpHost: sender.smtpHost,
          smtpPort: sender.smtpPort,
          createdAt: sender.createdAt,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update sender';

      if (errorMessage.includes('not found')) {
        res.status(404).json({ error: errorMessage });
      } else if (errorMessage.includes('Unauthorized')) {
        res.status(403).json({ error: errorMessage });
      } else if (errorMessage.includes('Invalid SMTP')) {
        res.status(400).json({ error: errorMessage });
      } else {
        logger.error({ error, userId: req.userId }, 'Failed to update sender');
        res.status(500).json({ error: 'Failed to update sender' });
      }
    }
  }

  /**
   * DELETE /senders/:id
   * Delete a sender
   */
  async deleteSender(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      if (Array.isArray(id)) {
        res.status(400).json({ error: 'Invalid sender ID' });
        return;
      }
      await sendersService.deleteSender(id, req.userId);

      res.json({ message: 'Sender deleted successfully' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete sender';

      if (errorMessage.includes('Unauthorized')) {
        res.status(403).json({ error: errorMessage });
      } else {
        logger.error({ error, userId: req.userId }, 'Failed to delete sender');
        res.status(500).json({ error: 'Failed to delete sender' });
      }
    }
  }

  /**
   * POST /senders/:id/test
   * Send a test email using this sender
   */
  async testSender(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      if (Array.isArray(id)) {
        res.status(400).json({ error: 'Invalid sender ID' });
        return;
      }

      const { testEmail } = req.body;

      if (!testEmail) {
        res.status(400).json({ error: 'testEmail is required' });
        return;
      }

      await sendersService.testSender(id, req.userId, testEmail);

      res.json({
        message: 'Test email sent successfully',
        sentTo: testEmail,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send test email';

      if (errorMessage.includes('not found')) {
        res.status(404).json({ error: errorMessage });
      } else if (errorMessage.includes('Unauthorized')) {
        res.status(403).json({ error: errorMessage });
      } else {
        logger.error({ error, userId: req.userId }, 'Failed to send test email');
        res.status(500).json({ error: 'Failed to send test email' });
      }
    }
  }
}

export const sendersController = new SendersController();
