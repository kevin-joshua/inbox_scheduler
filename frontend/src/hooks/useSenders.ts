'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Sender {
  id: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  createdAt: string;
}

interface UseSendersReturn {
  senders: Sender[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSenders(): UseSendersReturn {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSenders = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getSenders();
      setSenders(data.senders);
    } catch (err) {
      console.error('Failed to fetch senders:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch senders');
      setSenders([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSenders();
  }, []);

  return {
    senders,
    isLoading,
    error,
    refetch: fetchSenders,
  };
}
