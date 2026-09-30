import { Router } from 'express';
import { emailsController } from './emails.controller';
import { requireAuth } from '../auth/auth.middleware';

export const emailsRouter = Router();

emailsRouter.post('/', requireAuth, (req, res) => emailsController.scheduleEmail(req, res));
emailsRouter.post('/batch', requireAuth, (req, res) => emailsController.scheduleBatch(req, res));
emailsRouter.post('/upload', requireAuth, (req, res) => emailsController.uploadCsv(req, res));
emailsRouter.get('/', requireAuth, (req, res) => emailsController.getEmails(req, res));
emailsRouter.delete('/:id', requireAuth, (req, res) => emailsController.cancelEmail(req, res));
