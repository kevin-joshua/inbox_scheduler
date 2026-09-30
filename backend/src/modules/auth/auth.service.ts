/**
 * TODO(lld): Implement authentication service methods
 * - exchangeGoogleCode(code: string): Exchange OAuth code for Google tokens
 * - getUserFromGoogle(accessToken: string): Fetch user profile from Google
 * - createOrUpdateUser(googleProfile): Create or update user in database
 * - generateJWT(userId: string): Generate signed JWT token
 * - verifyJWT(token: string): Verify and decode JWT token
 */

export class AuthService {
  async exchangeGoogleCode(code: string): Promise<{ accessToken: string }> {
    throw new Error('Not implemented: exchangeGoogleCode - TODO(lld): Exchange OAuth code for tokens');
  }

  async getUserFromGoogle(accessToken: string): Promise<{ id: string; email: string; name: string }> {
    throw new Error('Not implemented: getUserFromGoogle - TODO(lld): Fetch user profile from Google API');
  }

  async createOrUpdateUser(profile: { googleId: string; email: string; name: string; avatarUrl?: string }): Promise<{ id: string }> {
    throw new Error('Not implemented: createOrUpdateUser - TODO(lld): Upsert user in database');
  }

  generateJWT(userId: string): string {
    throw new Error('Not implemented: generateJWT - TODO(lld): Sign JWT with user ID');
  }

  verifyJWT(token: string): { userId: string } {
    throw new Error('Not implemented: verifyJWT - TODO(lld): Verify and decode JWT');
  }
}

export const authService = new AuthService();
