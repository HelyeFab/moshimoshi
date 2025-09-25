'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';

export function useSessionRefresh() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();

  const refreshSession = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      const response = await fetch('/api/auth/refresh-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Session refreshed:', data);

        if (data.oldTier !== data.newTier) {
          showToast(
            `Session updated: ${data.oldTier} → ${data.newTier}`,
            'success'
          );

          // Refresh the page to get new session data
          router.refresh();

          // Also reload to ensure all components get new data
          setTimeout(() => {
            window.location.reload();
          }, 500);
        } else {
          showToast('Session is already up to date', 'info');
        }

        return data;
      } else {
        throw new Error('Failed to refresh session');
      }
    } catch (error) {
      console.error('Session refresh error:', error);
      showToast('Failed to refresh session', 'error');
      throw error;
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, router, showToast]);

  return {
    refreshSession,
    isRefreshing,
  };
}