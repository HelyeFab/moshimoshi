'use client';

import React from 'react';
import Modal from './Modal';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'info' | 'warning' | 'danger' | 'success';
  isLoading?: boolean;
  showIcon?: boolean;
}

export default function Dialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'info',
  isLoading = false,
  showIcon = true,
}: DialogProps) {
  const [isProcessing, setIsProcessing] = React.useState(false);

  const handleConfirm = async () => {
    console.log('[Dialog.handleConfirm] Starting confirmation');
    if (isProcessing) {
      console.log('[Dialog.handleConfirm] Already processing, ignoring');
      return;
    }

    setIsProcessing(true);
    try {
      console.log('[Dialog.handleConfirm] Calling onConfirm callback');
      await onConfirm();
      console.log('[Dialog.handleConfirm] onConfirm completed successfully');
      onClose();
    } catch (error) {
      console.error('[Dialog.handleConfirm] Dialog action failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getIcon = () => {
    const icons = {
      info: { emoji: 'ℹ️', color: 'text-blue-500' },
      warning: { emoji: '⚠️', color: 'text-yellow-500' },
      danger: { emoji: '⚠️', color: 'text-red-500' },
      success: { emoji: '✅', color: 'text-green-500' },
    };
    return icons[type];
  };

  const getButtonStyles = () => {
    const styles = {
      info: 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500',
      warning: 'bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-500',
      danger: 'bg-red-500 hover:bg-red-600 focus:ring-red-500',
      success: 'bg-green-500 hover:bg-green-600 focus:ring-green-500',
    };
    return styles[type];
  };

  const icon = getIcon();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      closeOnOverlayClick={!isLoading && !isProcessing}
      closeOnEsc={!isLoading && !isProcessing}
      showCloseButton={false}
    >
      <div className="text-center sm:text-left">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          {showIcon && (
            <div className={`mx-auto sm:mx-0 flex-shrink-0 text-3xl ${icon.color}`}>
              {icon.emoji}
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button
            onClick={onClose}
            disabled={isLoading || isProcessing}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading || isProcessing}
            className={`w-full sm:w-auto px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${getButtonStyles()}`}
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}