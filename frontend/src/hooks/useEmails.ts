'use client';

/**
 * TODO(lld): Implement useEmails hook
 * - Fetch emails from api.getEmails()
 * - Handle loading and error states
 * - Support filtering by status
 * - Provide refetch function
 * - Optional: polling for real-time updates
 */

export function useEmails(filters?: { status?: string }) {
  return {
    emails: [],
    isLoading: false,
    error: null,
    refetch: () => {
      // TODO(lld): Implement refetch
    },
  };
}
