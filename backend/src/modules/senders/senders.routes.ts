import { Router } from 'express';
import { sendersController } from './senders.controller';
import { requireAuth } from '../auth/auth.middleware';

export const sendersRouter = Router();

// All routes require authentication
sendersRouter.use(requireAuth);

/**
 * GET /senders
 * List all senders for the authenticated user
 */
sendersRouter.get('/', (req, res) => sendersController.getSenders(req, res));

/**
 * GET /senders/:id
 * Get a specific sender
 */
sendersRouter.get('/:id', (req, res) => sendersController.getSender(req, res));

/**
 * POST /senders
 * Create a new sender with SMTP credentials
 */
sendersRouter.post('/', (req, res) => sendersController.createSender(req, res));

/**
 * PATCH /senders/:id
 * Update a sender
 */
sendersRouter.patch('/:id', (req, res) => sendersController.updateSender(req, res));

/**
 * DELETE /senders/:id
 * Delete a sender
 */
sendersRouter.delete('/:id', (req, res) => sendersController.deleteSender(req, res));

/**
 * POST /senders/:id/test
 * Send a test email to verify SMTP configuration
 */
sendersRouter.post('/:id/test', (req, res) => sendersController.testSender(req, res));
