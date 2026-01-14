'use client';

import React, { useEffect, useState } from 'react';
import { Toast } from './ToastContext';
import { useToast } from './ToastContext';

interface ToastItemProps {
  toast: Toast;
}

export default function ToastItem({ toast }: ToastItemProps) {
  const { removeToast } = useToast();
  const [isExiting, setIsExiting] = useState(false);

  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(() => {
      removeToast(toast.id);
    }, 300); // Match animation duration
  };

  const getToastStyles = () => {
    const base = 'pointer-events-auto w-full max-w-sm sm:max-w-md px-4 py-3 rounded-lg flex items-start gap-3 transition-all duration-300 backdrop-blur-md';

    const variants = {
      success: 'bg-green-50/95 dark:bg-green-900/50 border border-green-200 dark:border-green-700/80 text-green-900 dark:text-green-100 shadow-lg shadow-green-500/20 dark:shadow-green-500/30',
      error: 'bg-red-50/95 dark:bg-red-900/50 border border-red-200 dark:border-red-700/80 text-red-900 dark:text-red-100 shadow-lg shadow-red-500/20 dark:shadow-red-500/30',
      warning: 'bg-yellow-50/95 dark:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-700/80 text-yellow-900 dark:text-yellow-100 shadow-lg shadow-yellow-500/20 dark:shadow-yellow-500/30',
      info: 'bg-blue-50/95 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-700/80 text-blue-900 dark:text-blue-100 shadow-lg shadow-blue-500/20 dark:shadow-blue-500/30',
    };

    const animation = isExiting 
      ? 'opacity-0 translate-y-2 scale-95' 
      : 'opacity-100 translate-y-0 scale-100';

    return `${base} ${variants[toast.type]} ${animation}`;
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
    }
  };

  return (
    <div className={getToastStyles()}>
      <span className="text-xl flex-shrink-0">{getIcon()}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium break-words">{toast.message}</p>
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className="mt-1 text-xs font-semibold underline hover:no-underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={handleRemove}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        aria-label="Close"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}