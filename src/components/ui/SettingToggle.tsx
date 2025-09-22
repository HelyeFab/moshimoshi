import React from 'react';
import Tooltip from './Tooltip';

interface SettingToggleProps {
  label: string;
  description?: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
  icon?: string | React.ReactNode;
  disabled?: boolean;
  tooltip?: string;
  className?: string;
}

/**
 * SettingToggle - A reusable toggle switch component for settings
 * Used across settings pages for consistent toggle behavior
 */
export default function SettingToggle({ 
  label, 
  description, 
  enabled, 
  onChange, 
  icon,
  disabled = false,
  tooltip,
  className = ''
}: SettingToggleProps) {
  const toggle = (
    <div className={`flex items-center justify-between py-4 border-b border-gray-200 dark:border-dark-700 last:border-0 ${className}`}>
      <div className="flex items-start gap-3">
        {icon && (
          <span className="text-2xl mt-1">
            {typeof icon === 'string' ? icon : icon}
          </span>
        )}
        <div className="flex-1">
          <p className="font-medium text-gray-900 dark:text-dark-100">
            {label}
          </p>
          {description && (
            <p className="text-sm text-gray-600 dark:text-dark-400 mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>
      <button
        onClick={() => !disabled && onChange(!enabled)}
        disabled={disabled}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors
          ${enabled ? 'bg-primary-500 dark:bg-primary-600' : 'bg-gray-300 dark:bg-dark-600'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        aria-label={`Toggle ${label}`}
        aria-checked={enabled}
        role="switch"
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
            ${enabled ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
    </div>
  );

  if (tooltip) {
    return (
      <Tooltip content={tooltip}>
        {toggle}
      </Tooltip>
    );
  }

  return toggle;
}

/**
 * SettingToggleGroup - A group of related toggle settings
 */
export function SettingToggleGroup({ 
  title, 
  children,
  className = '' 
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`${className}`}>
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-4">
          {title}
        </h3>
      )}
      <div className="space-y-0">
        {children}
      </div>
    </div>
  );
}