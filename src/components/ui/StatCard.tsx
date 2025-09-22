import React from 'react';
import Tooltip from './Tooltip';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: string | React.ReactNode;
  color?: string;
  gradient?: string;
  change?: {
    value: number;
    label?: string;
  };
  tooltip?: string;
  className?: string;
  size?: 'small' | 'medium' | 'large';
  onClick?: () => void;
}

/**
 * StatCard - A reusable card component for displaying statistics
 * Used in dashboards and admin pages for consistent metric display
 */
export default function StatCard({
  label,
  value,
  unit,
  icon,
  color = 'primary',
  gradient,
  change,
  tooltip,
  className = '',
  size = 'medium',
  onClick
}: StatCardProps) {
  const sizes = {
    small: {
      padding: 'p-4',
      iconSize: 'text-2xl',
      valueSize: 'text-xl',
      labelSize: 'text-xs'
    },
    medium: {
      padding: 'p-6',
      iconSize: 'text-3xl',
      valueSize: 'text-2xl',
      labelSize: 'text-sm'
    },
    large: {
      padding: 'p-8',
      iconSize: 'text-4xl',
      valueSize: 'text-3xl',
      labelSize: 'text-base'
    }
  };

  const sizeClasses = sizes[size];

  const card = (
    <div 
      className={`
        bg-white dark:bg-dark-800 rounded-lg shadow 
        ${sizeClasses.padding} 
        ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className={`${sizeClasses.labelSize} text-gray-600 dark:text-dark-400`}>
            {label}
          </p>
          <div className="flex items-baseline gap-1 mt-1">
            <p className={`${sizeClasses.valueSize} font-bold text-gray-900 dark:text-dark-50`}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {unit && (
              <span className={`${sizeClasses.labelSize} text-gray-500 dark:text-dark-400 ml-1`}>
                {unit}
              </span>
            )}
          </div>
          {change && (
            <div className="flex items-center gap-1 mt-2">
              <span className={`
                text-xs font-medium
                ${change.value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
              `}>
                {change.value >= 0 ? '↑' : '↓'} {Math.abs(change.value)}%
              </span>
              {change.label && (
                <span className="text-xs text-gray-500 dark:text-dark-400">
                  {change.label}
                </span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div className={`${sizeClasses.iconSize} ${
            gradient ? '' : 
            color === 'primary' ? 'text-primary-500 dark:text-primary-400' :
            color === 'green' ? 'text-green-600 dark:text-green-400' :
            color === 'red' ? 'text-red-600 dark:text-red-400' :
            `text-${color}-500`
          }`}>
            {gradient ? (
              <div className={`bg-gradient-to-br ${gradient} bg-clip-text text-transparent`}>
                {typeof icon === 'string' ? icon : icon}
              </div>
            ) : (
              typeof icon === 'string' ? icon : icon
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (tooltip) {
    return (
      <Tooltip content={tooltip}>
        {card}
      </Tooltip>
    );
  }

  return card;
}

/**
 * StatCardGrid - A grid layout for multiple stat cards
 */
export function StatCardGrid({ 
  children, 
  columns = 4,
  className = '' 
}: {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4 | 5;
  className?: string;
}) {
  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
  };

  return (
    <div className={`grid ${columnClasses[columns]} gap-4 ${className}`}>
      {children}
    </div>
  );
}