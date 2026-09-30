import { Request, Response } from 'express';
import { AuthRequest } from '../auth/auth.middleware';

/**
 * TODO(lld): Implement email controllers to handle HTTP requests
 * - scheduleEmail: POST /emails
 * - scheduleBatch: POST /emails/batch
 * - uploadCsv: POST /emails/upload
 * - getEmails: GET /emails
 * - cancelEmail: DELETE /emails/:id
 */

export class EmailsController {
  async scheduleEmail(req: AuthRequest, res: Response): Promise<void> {
    res.status(501).json({ error: 'Not implemented: scheduleEmail controller' });
  }

  async scheduleBatch(req: AuthRequest, res: Response): Promise<void> {
    res.status(501).json({ error: 'Not implemented: scheduleBatch controller' });
  }

  async uploadCsv(req: AuthRequest, res: Response): Promise<void> {
    res.status(501).json({ error: 'Not implemented: uploadCsv controller' });
  }

  async getEmails(req: AuthRequest, res: Response): Promise<void> {
    res.status(501).json({ error: 'Not implemented: getEmails controller' });
  }

  async cancelEmail(req: AuthRequest, res: Response): Promise<void> {
    res.status(501).json({ error: 'Not implemented: cancelEmail controller' });
  }
}

export const emailsController = new EmailsController();
