const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: unknown
  ) {
    super(`API Error: ${status} ${statusText}`);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Important: include cookies for auth
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(response.status, response.statusText, data);
  }

  return response.json();
}

export const api = {
  // Auth
  getMe: () => fetchApi<{ id: string; email: string; name: string | null; avatarUrl: string | null; createdAt: string }>('/auth/me'),
  logout: () => fetchApi('/auth/logout', { method: 'POST' }),

  // Emails
  getEmails: (filters?: { status?: string; batchId?: string; page?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.batchId) params.append('batchId', filters.batchId);
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));
    return fetchApi<{
      emails: Array<{
        id: string;
        recipient: string;
        subject: string;
        body: string;
        status: string;
        scheduledAt: string;
        sentAt: string | null;
        messageId: string | null;
        failureReason: string | null;
        senderId: string;
        batchId: string;
      }>;
      pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    }>(`/emails?${params}`);
  },
  scheduleEmail: (data: {
    senderId: string;
    recipient: string;
    subject: string;
    body: string;
    scheduledAt: string;
  }) => fetchApi('/emails', { method: 'POST', body: JSON.stringify(data) }),
  scheduleBatch: (data: {
    senderId: string;
    recipients: string[];
    subject: string;
    body: string;
    startAt: string;
    delayMs: number;
    hourlyLimit: number;
  }) =>
    fetchApi('/emails/batch', { method: 'POST', body: JSON.stringify(data) }),
  cancelEmail: (id: string) =>
    fetchApi(`/emails/${id}`, { method: 'DELETE' }),

  // Senders
  getSenders: () =>
    fetchApi<{
      senders: Array<{
        id: string;
        email: string;
        smtpHost: string;
        smtpPort: number;
        createdAt: string;
      }>;
      count: number;
    }>('/senders'),

  // Search
  searchEmails: (query: string) =>
    fetchApi(`/search/emails?q=${encodeURIComponent(query)}`),
};
