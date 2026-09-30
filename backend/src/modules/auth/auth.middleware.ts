import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { env } from '../../config/env';
import { logger } from '../../infra/logger';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

/**
 * JWT authentication middleware
 * - Reads JWT from HTTP-only cookie
 * - Verifies JWT signature and expiration
 * - Decodes userId and email
 * - Attaches userId and userEmail to request object
 * - Returns 401 if token is missing or invalid
 */
export function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    // Read token from cookie
    const token = req.cookies[env.COOKIE_NAME];

    if (!token) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'No authentication token provided',
      });
      return;
    }

    // Verify and decode JWT
    try {
      const decoded = authService.verifyJWT(token);

      // Attach user info to request
      req.userId = decoded.userId;
      req.userEmail = decoded.email;

      logger.debug({ userId: decoded.userId }, 'Request authenticated');
      next();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Invalid token';
      
      logger.warn({ error: errorMessage }, 'JWT verification failed');
      
      res.status(401).json({
        error: 'Authentication failed',
        message: errorMessage,
      });
      return;
    }
  } catch (error) {
    logger.error({ error }, 'Authentication middleware error');
    res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication check failed',
    });
    return;
  }
}

/**
 * Optional authentication middleware
 * - Attempts to authenticate but doesn't reject if no token
 * - Useful for endpoints that behave differently for authenticated users
 */
export function optionalAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const token = req.cookies[env.COOKIE_NAME];

    if (token) {
      try {
        const decoded = authService.verifyJWT(token);
        req.userId = decoded.userId;
        req.userEmail = decoded.email;
      } catch (error) {
        // Token is invalid but we don't reject the request
        logger.debug('Optional auth: Invalid token, continuing without authentication');
      }
    }

    next();
  } catch (error) {
    logger.error({ error }, 'Optional auth middleware error');
    next();
  }
}
