'use client';

/**
 * Help Icon Component
 *
 * Displays a clickable emoji icon that shows help content.
 * - Tooltip on hover (brief preview)
 * - Click opens full modal (via context)
 * - Supports multiple sizes and positions
 */

import React from 'react';
import { HelpCircle } from 'lucide-react';
import Tooltip from '@/components/ui/Tooltip';
import { useConjugationHelp } from '@/contexts/ConjugationHelpContext';
import type { HelpContent } from '@/data/conjugation-help/help-content';

interface HelpIconProps {
  /** The help content to display when clicked */
  help: HelpContent;

  /** Size variant */
  size?: 'sm' | 'md' | 'lg';

  /** Custom className */
  className?: string;

  /** Disable the icon */
  disabled?: boolean;

  /** Show tooltip on hover */
  showTooltip?: boolean;

  /** Tooltip position */
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right';
}

const sizeClasses = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

const containerSizeClasses = {
  sm: 'p-0.5',
  md: 'p-1',
  lg: 'p-1.5',
};

export function HelpIcon({
  help,
  size = 'md',
  className = '',
  disabled = false,
  showTooltip = true,
  tooltipPosition = 'top',
}: HelpIconProps) {
  const { showHelp } = useConjugationHelp();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    if (!disabled) {
      showHelp(help, 'manual');
    }
  };

  const iconButton = (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center
        ${containerSizeClasses[size]}
        rounded-full
        transition-all duration-200
        ${disabled
          ? 'opacity-40 cursor-not-allowed'
          : 'hover:bg-primary-100 dark:hover:bg-primary-900/30 active:scale-95 cursor-pointer'
        }
        ${className}
      `}
      aria-label={`Help: ${help.title}`}
      aria-describedby={showTooltip ? `help-tooltip-${help.id}` : undefined}
    >
      <span className="text-lg" role="img" aria-label={help.title}>
        {help.emoji}
      </span>
    </button>
  );

  // Return with tooltip if enabled
  if (showTooltip && !disabled) {
    return (
      <Tooltip
        content={
          <div id={`help-tooltip-${help.id}`} className="max-w-xs">
            <div className="font-medium mb-1">{help.title}</div>
            <div className="text-xs opacity-90">{help.tooltip}</div>
          </div>
        }
        position={tooltipPosition}
        delay={300}
      >
        {iconButton}
      </Tooltip>
    );
  }

  return iconButton;
}

/**
 * Text-based help trigger (for contexts where emoji might not fit)
 */
export function HelpLink({
  help,
  label = 'Help',
  className = '',
  disabled = false,
}: {
  help: HelpContent;
  label?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { showHelp } = useConjugationHelp();

  return (
    <button
      type="button"
      onClick={() => showHelp(help, 'manual')}
      disabled={disabled}
      className={`
        inline-flex items-center gap-1.5
        text-sm text-primary-600 dark:text-primary-400
        hover:text-primary-700 dark:hover:text-primary-300
        hover:underline
        transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      aria-label={`Help: ${help.title}`}
    >
      <HelpCircle className="w-3.5 h-3.5" />
      <span>{label}</span>
    </button>
  );
}
