'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Activity, Info } from 'lucide-react';
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

  // Enhanced props for statistics page
  animated?: boolean;
  animationDelay?: number;
  accentGradient?: string;
  description?: string;
  showInfoIcon?: boolean;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  trendPosition?: 'top-right' | 'bottom';
}

/**
 * StatCard - A reusable card component for displaying statistics
 * Used in dashboards, admin pages, and statistics page for consistent metric display
 *
 * Supports both simple and enhanced modes:
 * - Simple: Basic card with icon, value, and optional change indicator
 * - Enhanced: Animated cards with accent gradients, description overlays, and trend indicators
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
  onClick,
  // Enhanced props
  animated = false,
  animationDelay = 0,
  accentGradient,
  description,
  showInfoIcon = false,
  trend,
  trendValue,
  trendPosition = 'bottom'
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

  // Render trend indicator
  const renderTrendIndicator = () => {
    // Use trend prop if provided, otherwise fall back to change prop
    const trendDirection = trend || (change ? (change.value >= 0 ? 'up' : change.value < 0 ? 'down' : 'stable') : null);
    const displayValue = trendValue || (change ? `${Math.abs(change.value)}%` : null);

    if (!trendDirection && !change) return null;

    const trendColors = {
      up: 'text-green-600 dark:text-green-400',
      down: 'text-red-600 dark:text-red-400',
      stable: 'text-gray-500 dark:text-gray-400'
    };

    const TrendIcon = trendDirection === 'up' ? TrendingUp : trendDirection === 'down' ? TrendingDown : Activity;

    return (
      <div className={`flex items-center gap-1 text-sm font-medium ${trendColors[trendDirection || 'stable']}`}>
        <TrendIcon className="w-4 h-4" />
        {displayValue && <span>{displayValue}</span>}
        {change?.label && trendPosition === 'bottom' && (
          <span className="text-xs text-gray-500 dark:text-dark-400 ml-1">
            {change.label}
          </span>
        )}
      </div>
    );
  };

  // Card content
  const cardContent = (
    <>
      {/* Gradient accent bar at top */}
      {accentGradient && (
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${accentGradient} rounded-t-2xl`} />
      )}

      {/* Header with icon and trend (top-right position) */}
      <div className="flex items-start justify-between mb-4">
        {icon && (
          <div className={`
            ${accentGradient ? `p-3 rounded-xl bg-gradient-to-br ${accentGradient} text-white shadow-lg` : ''}
            ${!accentGradient && gradient ? '' : ''}
            ${!accentGradient && !gradient ? sizeClasses.iconSize : ''}
            ${!accentGradient && !gradient && (
              color === 'primary' ? 'text-primary-500 dark:text-primary-400' :
              color === 'green' ? 'text-green-600 dark:text-green-400' :
              color === 'red' ? 'text-red-600 dark:text-red-400' :
              `text-${color}-500`
            )}
          `}>
            {gradient && !accentGradient ? (
              <div className={`bg-gradient-to-br ${gradient} bg-clip-text text-transparent ${sizeClasses.iconSize}`}>
                {typeof icon === 'string' ? icon : icon}
              </div>
            ) : (
              typeof icon === 'string' ? icon : icon
            )}
          </div>
        )}

        {/* Trend indicator in top-right position */}
        {trendPosition === 'top-right' && renderTrendIndicator()}
      </div>

      {/* Value and unit */}
      <div className="mb-2">
        <span className={`${accentGradient ? 'text-4xl' : sizeClasses.valueSize} font-bold text-gray-900 dark:text-white`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {unit && (
          <span className={`ml-2 ${accentGradient ? 'text-lg' : sizeClasses.labelSize} text-gray-500 dark:text-gray-400`}>
            {unit}
          </span>
        )}
      </div>

      {/* Label */}
      <p className={`${sizeClasses.labelSize} font-medium text-gray-600 dark:text-gray-400`}>
        {label}
      </p>

      {/* Trend indicator in bottom position */}
      {trendPosition === 'bottom' && !accentGradient && (
        <div className="mt-2">
          {renderTrendIndicator()}
        </div>
      )}

      {/* Description overlay on hover */}
      {description && (
        <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-4 rounded-2xl">
          <p className="text-white text-sm text-center">{description}</p>
        </div>
      )}

      {/* Info icon in corner */}
      {showInfoIcon && (
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <Info className="w-4 h-4 text-gray-400" />
        </div>
      )}
    </>
  );

  // Base card classes
  const baseCardClasses = `
    relative overflow-hidden rounded-2xl
    ${accentGradient ? 'bg-white/90 dark:bg-dark-800/90 backdrop-blur-sm border border-gray-200 dark:border-dark-700 shadow-lg hover:shadow-xl' : 'bg-white dark:bg-dark-800 rounded-lg shadow'}
    ${sizeClasses.padding}
    ${onClick ? 'cursor-pointer' : ''}
    ${description || showInfoIcon ? 'group' : ''}
    transition-all duration-300
    ${className}
  `;

  // Render animated or static card
  if (animated) {
    return tooltip ? (
      <Tooltip content={tooltip}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: animationDelay * 0.1 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onClick}
          className={baseCardClasses}
        >
          {cardContent}
        </motion.div>
      </Tooltip>
    ) : (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: animationDelay * 0.1 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className={baseCardClasses}
      >
        {cardContent}
      </motion.div>
    );
  }

  // Static card (non-animated)
  const staticCard = (
    <div
      className={`${baseCardClasses} ${onClick ? 'hover:shadow-lg' : ''}`}
      onClick={onClick}
    >
      {cardContent}
    </div>
  );

  if (tooltip) {
    return (
      <Tooltip content={tooltip}>
        {staticCard}
      </Tooltip>
    );
  }

  return staticCard;
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
