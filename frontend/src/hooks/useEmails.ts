'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

interface Email {
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
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface UseEmailsReturn {
  emails: Email[];
  pagination: Pagination | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useEmails(filters?: {
  status?: string;
  batchId?: string;
  page?: number;
  limit?: number;
}): UseEmailsReturn {
  const [emails, setEmails] = useState<Email[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmails = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getEmails(filters);
      setEmails(data.data);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to fetch emails:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch emails');
      setEmails([]);
      setPagination(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters?.status, filters?.batchId, filters?.page, filters?.limit]);

  return {
    emails,
    pagination,
    isLoading,
    error,
    refetch: fetchEmails,
  };
}
