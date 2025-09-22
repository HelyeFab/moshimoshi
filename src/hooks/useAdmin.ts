'use client';

import { useEffect, useState } from 'react';
import { debugLog } from '@/lib/logger/debug-logger';

const log = debugLog('app:admin');

interface AdminState {
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  user: any;
}

export function useAdmin() {
  const [adminState, setAdminState] = useState<AdminState>({
    isAdmin: false,
    isLoading: true,
    error: null,
    user: null,
  });

  useEffect(() => {
    async function checkAdminStatus() {
      try {
        log('Starting admin status check');

        // Debug: Show that hook is running
        if (typeof window !== 'undefined') {
          (window as any).__ADMIN_HOOK_RUNNING__ = true;
          log('Set __ADMIN_HOOK_RUNNING__ = true');
        }

        // Use the simpler admin check endpoint
        log('Fetching /api/admin/check');
        const response = await fetch('/api/admin/check', {
          credentials: 'include',
        });

        log('Response status:', response.status);
        const data = await response.json();
        log('Response data:', data);

        // Store result globally for debugging
        if (typeof window !== 'undefined') {
          (window as any).__ADMIN_CHECK_RESULT__ = data;
          log('Stored __ADMIN_CHECK_RESULT__:', data);
        }

        if (!data.authenticated) {
          log('User not authenticated');
          setAdminState({
            isAdmin: false,
            isLoading: false,
            error: 'Not authenticated',
            user: null,
          });
          return;
        }

        const newState = {
          isAdmin: data.isAdmin === true,
          isLoading: false,
          error: data.isAdmin ? null : 'Not authorized as admin',
          user: {
            uid: data.uid,
            email: data.email,
            firebaseIsAdmin: data.firebaseIsAdmin,
            jwtAdmin: data.jwtAdmin
          },
        };

        log('Setting admin state:', newState);
        setAdminState(newState);
      } catch (error) {
        log('Error checking admin status:', error);
        setAdminState({
          isAdmin: false,
          isLoading: false,
          error: 'Failed to verify admin status',
          user: null,
        });
      }
    }

    checkAdminStatus();
  }, []);

  return adminState;
}