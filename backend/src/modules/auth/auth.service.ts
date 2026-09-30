import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { prisma } from '../../db/client';
import { logger } from '../../infra/logger';

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
}

interface JWTPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

export class AuthService {
  private oauth2Client;

  constructor() {
    // Initialize Google OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_REDIRECT_URI
    );
  }

  /**
   * Generate Google OAuth authorization URL
   */
  getAuthorizationUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });
  }

  /**
   * Exchange authorization code for Google tokens
   */
  async exchangeGoogleCode(code: string): Promise<{ accessToken: string }> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      if (!tokens.access_token) {
        throw new Error('No access token received from Google');
      }

      return { accessToken: tokens.access_token };
    } catch (error) {
      logger.error({ error }, 'Failed to exchange Google authorization code');
      throw new Error('Failed to authenticate with Google');
    }
  }

  /**
   * Fetch user profile from Google using access token
   */
  async getUserFromGoogle(accessToken: string): Promise<GoogleUserInfo> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });
      
      const oauth2 = google.oauth2({
        auth: this.oauth2Client,
        version: 'v2',
      });

      const { data } = await oauth2.userinfo.get();

      if (!data.email || !data.id) {
        throw new Error('Incomplete user data from Google');
      }

      return data as GoogleUserInfo;
    } catch (error) {
      logger.error({ error }, 'Failed to fetch Google user profile');
      throw new Error('Failed to fetch user profile from Google');
    }
  }

  /**
   * Create or update user in database
   */
  async createOrUpdateUser(profile: {
    googleId: string;
    email: string;
    name: string;
    avatarUrl?: string;
  }): Promise<{ id: string; email: string; name: string }> {
    try {
      const user = await prisma.user.upsert({
        where: { googleId: profile.googleId },
        update: {
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
        },
        create: {
          googleId: profile.googleId,
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
        },
      });

      logger.info({ userId: user.id, email: user.email }, 'User authenticated');

      return {
        id: user.id,
        email: user.email,
        name: user.name || '',
      };
    } catch (error) {
      logger.error({ error, profile }, 'Failed to create/update user');
      throw new Error('Failed to create or update user');
    }
  }

  /**
   * Generate signed JWT token
   */
  generateJWT(userId: string, email: string): string {
    try {
      const payload = {
        userId,
        email,
      };

      const token = jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: '7d', // Token expires in 7 days
        issuer: 'reachinbox',
        audience: 'reachinbox-users',
      });

      return token;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to generate JWT');
      throw new Error('Failed to generate authentication token');
    }
  }

  /**
   * Verify and decode JWT token
   */
  verifyJWT(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET, {
        issuer: 'reachinbox',
        audience: 'reachinbox-users',
      }) as JWTPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      throw new Error('Token verification failed');
    }
  }
}

export const authService = new AuthService();
