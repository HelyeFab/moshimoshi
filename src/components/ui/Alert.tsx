'use client';

import React, { useState } from 'react';
import DoshiMascot from './DoshiMascot';

interface AlertProps {
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  showIcon?: boolean;
  showDoshi?: boolean;
  doshiMood?: 'happy' | 'sad' | 'excited' | 'thinking' | 'sleeping' | 'waving';
  className?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function Alert({
  type = 'info',
  title,
  message,
  dismissible = false,
  onDismiss,
  showIcon = true,
  showDoshi = false,
  doshiMood,
  className = '',
  action,
}: AlertProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  const getStyles = () => {
    const styles = {
      info: {
        container: 'bg-blue-50/95 dark:bg-blue-950/95 border-blue-300 dark:border-blue-700 backdrop-blur-md',
        text: 'text-blue-900 dark:text-blue-100',
        icon: 'ℹ️',
        mood: 'thinking' as const,
        shadow: 'shadow-lg shadow-blue-500/20',
      },
      success: {
        container: 'bg-green-50/95 dark:bg-green-950/95 border-green-300 dark:border-green-700 backdrop-blur-md',
        text: 'text-green-900 dark:text-green-100',
        icon: '✅',
        mood: 'excited' as const,
        shadow: 'shadow-lg shadow-green-500/20',
      },
      warning: {
        container: 'bg-yellow-50/95 dark:bg-yellow-950/95 border-yellow-300 dark:border-yellow-700 backdrop-blur-md',
        text: 'text-yellow-900 dark:text-yellow-100',
        icon: '⚠️',
        mood: 'thinking' as const,
        shadow: 'shadow-lg shadow-yellow-500/20',
      },
      error: {
        container: 'bg-red-50/95 dark:bg-red-950/95 border-red-300 dark:border-red-700 backdrop-blur-md',
        text: 'text-red-900 dark:text-red-100',
        icon: '❌',
        mood: 'sad' as const,
        shadow: 'shadow-lg shadow-red-500/20',
      },
    };
    return styles[type];
  };

  const styles = getStyles();
  const finalDoshiMood = doshiMood || styles.mood;

  return (
    <div
      role="alert"
      className={`border-2 rounded-lg p-4 ${styles.container} ${styles.shadow} relative z-10 ${className}`}
    >
      <div className="flex items-start gap-3">
        {/* Icon or Doshi */}
        {showDoshi ? (
          <DoshiMascot size="small" />
        ) : showIcon ? (
          <span className="text-xl flex-shrink-0" aria-hidden="true">
            {styles.icon}
          </span>
        ) : null}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {title && (
            <h3 className={`font-semibold mb-1 ${styles.text}`}>
              {title}
            </h3>
          )}
          <p className={`text-sm ${styles.text} opacity-90`}>
            {message}
          </p>
          
          {/* Action button */}
          {action && (
            <button
              onClick={action.onClick}
              className={`mt-2 text-sm font-medium underline hover:no-underline ${styles.text}`}
            >
              {action.label}
            </button>
          )}
        </div>

        {/* Dismiss button */}
        {dismissible && (
          <button
            onClick={handleDismiss}
            className={`flex-shrink-0 p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${styles.text}`}
            aria-label="Dismiss alert"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// Export a stack container for managing multiple alerts
export function AlertStack({ 
  children, 
  className = '',
  spacing = 'normal'
}: { 
  children: React.ReactNode;
  className?: string;
  spacing?: 'tight' | 'normal' | 'loose';
}) {
  const spacingClasses = {
    tight: 'space-y-2',
    normal: 'space-y-4',
    loose: 'space-y-6',
  };

  return (
    <div className={`relative ${spacingClasses[spacing]} ${className}`}>
      {React.Children.map(children, (child, index) => {
        if (React.isValidElement(child)) {
          const childElement = child as React.ReactElement<any>;
          return React.cloneElement(childElement, {
            style: { 
              ...(childElement.props?.style || {}),
              zIndex: 100 - index // Higher alerts have higher z-index
            }
          });
        }
        return child;
      })}
    </div>
  );
}

// Export a banner version for full-width alerts
interface BannerAlertProps extends AlertProps {
  fixed?: boolean;
  position?: 'top' | 'bottom';
}

export function BannerAlert({
  fixed = false,
  position = 'top',
  className = '',
  ...props
}: BannerAlertProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const positionClasses = fixed
    ? position === 'top'
      ? 'fixed top-0 left-0 right-0 z-50'
      : 'fixed bottom-0 left-0 right-0 z-50'
    : '';

  return (
    <div className={`${positionClasses} ${className}`}>
      <Alert
        {...props}
        className="rounded-none border-x-0 border-t-0"
        onDismiss={() => {
          setIsVisible(false);
          props.onDismiss?.();
        }}
      />
    </div>
  );
}