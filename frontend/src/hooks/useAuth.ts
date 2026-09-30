'use client';

/**
 * TODO(lld): Implement useAuth hook
 * - Fetch current user from api.getMe()
 * - Handle loading and error states
 * - Provide isAuthenticated flag
 * - Provide logout function
 * - Redirect to login if not authenticated
 */

export function useAuth() {
  return {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    logout: () => {
      // TODO(lld): Implement logout
    },
  };
}
