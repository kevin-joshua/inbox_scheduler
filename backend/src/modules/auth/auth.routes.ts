import { Router, Request, Response } from 'express';
import { authService } from './auth.service';
import { requireAuth, AuthRequest } from './auth.middleware';
import { env } from '../../config/env';
import { logger } from '../../infra/logger';
import { prisma } from '../../db/client';

export const authRouter = Router();

/**
 * GET /auth/google
 * Initiate Google OAuth flow by redirecting to Google consent screen
 */
authRouter.get('/google', (req: Request, res: Response) => {
  try {
    const authUrl = authService.getAuthorizationUrl();
    res.redirect(authUrl);
  } catch (error) {
    logger.error({ error }, 'Failed to generate Google auth URL');
    res.status(500).json({ error: 'Failed to initiate authentication' });
  }
});

/**
 * GET /auth/google/callback
 * Handle OAuth callback from Google
 * - Exchange code for tokens
 * - Fetch user profile
 * - Create/update user in database
 * - Generate JWT
 * - Set secure HTTP-only cookie
 * - Redirect to frontend dashboard
 */
authRouter.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const { code, error } = req.query;

    // Handle OAuth errors
    if (error) {
      logger.warn({ error }, 'OAuth error from Google');
      return res.redirect(`${env.FRONTEND_URL}/login?error=oauth_failed`);
    }

    if (!code || typeof code !== 'string') {
      logger.warn('No authorization code received');
      return res.redirect(`${env.FRONTEND_URL}/login?error=no_code`);
    }

    // Exchange code for access token
    const { accessToken } = await authService.exchangeGoogleCode(code);

    // Fetch user profile from Google
    const googleProfile = await authService.getUserFromGoogle(accessToken);

    // Create or update user in database
    const user = await authService.createOrUpdateUser({
      googleId: googleProfile.id,
      email: googleProfile.email,
      name: googleProfile.name,
      avatarUrl: googleProfile.picture,
    });

    // Generate JWT
    const token = authService.generateJWT(user.id, user.email);

    // Set secure HTTP-only cookie
    res.cookie(env.COOKIE_NAME, token, {
      httpOnly: true, // Prevents JavaScript access (XSS protection)
      secure: env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax', // CSRF protection
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      path: '/',
    });

    logger.info({ userId: user.id, email: user.email }, 'User logged in successfully');

    // Redirect to dashboard
    res.redirect(`${env.FRONTEND_URL}/dashboard`);
  } catch (error) {
    logger.error({ error }, 'OAuth callback error');
    res.redirect(`${env.FRONTEND_URL}/login?error=auth_failed`);
  }
});

/**
 * GET /auth/me
 * Get current authenticated user
 * Requires authentication
 */
authRouter.get('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    logger.error({ error, userId: req.userId }, 'Failed to fetch current user');
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

/**
 * POST /auth/logout
 * Clear authentication cookie
 */
authRouter.post('/logout', (req: Request, res: Response) => {
  try {
    res.clearCookie(env.COOKIE_NAME, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/',
    });

    logger.info('User logged out');
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error({ error }, 'Logout error');
    res.status(500).json({ error: 'Failed to logout' });
  }
});
