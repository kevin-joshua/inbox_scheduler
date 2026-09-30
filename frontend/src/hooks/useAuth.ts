'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchUser = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const userData = await api.getMe();
      setUser(userData);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Not authenticated - this is expected on login page
        setUser(null);
        setError(null);
      } else {
        console.error('Failed to fetch user:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch user');
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const logout = async () => {
    try {
      await api.logout();
      setUser(null);
      router.push('/login');
    } catch (err) {
      console.error('Logout failed:', err);
      // Even if API fails, clear local state and redirect
      setUser(null);
      router.push('/login');
    }
  };

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    logout,
    refetch: fetchUser,
  };
}
