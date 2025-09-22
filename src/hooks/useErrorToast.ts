'use client';

import { useCallback } from 'react';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { getUserFriendlyErrorMessage, getErrorToastType } from '@/utils/errorMessages';

export function useErrorToast() {
  const { showToast } = useToast();
  
  const showError = useCallback((error: unknown, customMessage?: string) => {
    const message = customMessage || getUserFriendlyErrorMessage(error);
    const type = getErrorToastType(error);
    
    // Show the toast with appropriate type and duration
    showToast(
      message,
      type,
      type === 'warning' ? 4000 : 5000 // Warnings show for less time
    );
    
    // Also log the original error for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error('Original error:', error);
    }
  }, [showToast]);
  
  return { showError };
}