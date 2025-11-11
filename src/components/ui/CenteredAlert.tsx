'use client';

import React from 'react';
import Alert from './Alert';

interface CenteredAlertProps {
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  isOpen: boolean;
  onClose: () => void;
  showIcon?: boolean;
  showDoshi?: boolean;
  doshiMood?: 'happy' | 'sad' | 'excited' | 'thinking' | 'sleeping' | 'waving';
  action?: {
    label: string;
    onClick: () => void;
  };
  closeOnBackdropClick?: boolean;
}

/**
 * CenteredAlert - A modal-style alert that appears in the center of the screen
 * with a backdrop overlay. Perfect for important messages that require user attention.
 *
 * Respects the app's theme system (light/dark mode)
 */
export default function CenteredAlert({
  type = 'info',
  title,
  message,
  isOpen,
  onClose,
  showIcon = true,
  showDoshi = false,
  doshiMood,
  action,
  closeOnBackdropClick = true,
}: CenteredAlertProps) {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-fadeIn"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="centered-alert-title"
      aria-describedby="centered-alert-message"
    >
      <div className="relative w-full max-w-md transform transition-all animate-slideUp">
        <Alert
          type={type}
          title={title}
          message={message}
          dismissible={true}
          onDismiss={onClose}
          showIcon={showIcon}
          showDoshi={showDoshi}
          doshiMood={doshiMood}
          action={action}
          className="animate-scaleIn"
        />
      </div>
    </div>
  );
}

// Hook for managing centered alert state
export function useCenteredAlert() {
  const [alert, setAlert] = React.useState<{
    isOpen: boolean;
    type: 'info' | 'success' | 'warning' | 'error';
    title?: string;
    message: string;
    action?: {
      label: string;
      onClick: () => void;
    };
  }>({
    isOpen: false,
    type: 'info',
    message: '',
  });

  const showAlert = React.useCallback((
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    title?: string,
    action?: { label: string; onClick: () => void }
  ) => {
    setAlert({
      isOpen: true,
      type,
      title,
      message,
      action,
    });
  }, []);

  const closeAlert = React.useCallback(() => {
    setAlert(prev => ({ ...prev, isOpen: false }));
  }, []);

  return {
    alert,
    showAlert,
    closeAlert,
  };
}
