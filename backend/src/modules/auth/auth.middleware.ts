import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  userId?: string;
}

/**
 * TODO(lld): Implement JWT authentication middleware
 * - Read JWT from httpOnly cookie
 * - Verify JWT signature
 * - Decode userId from token
 * - Attach userId to req object
 * - Return 401 if token is missing or invalid
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  // Stub implementation - always rejects
  res.status(501).json({ error: 'Not implemented: Authentication middleware - TODO(lld): Implement JWT verification' });
}
