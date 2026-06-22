'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
  disabled?: boolean;
  clickable?: boolean;
}

export default function Tooltip({
  children,
  content,
  position = 'top',
  delay = 200,
  className = '',
  disabled = false,
  clickable = false,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const calculatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    let tooltipRect = tooltipRef.current.getBoundingClientRect();
    const spacing = 8;
    const isMobile = window.innerWidth < 640; // sm breakpoint

    let top = 0;
    let left = 0;
    const padding = 10;

    // On mobile, center horizontally
    if (isMobile) {
      const maxTooltipWidth = window.innerWidth - padding * 2;
      if (tooltipRef.current) {
        tooltipRef.current.style.maxWidth = `${maxTooltipWidth}px`;
        // Re-measure after max width is applied so positioning uses wrapped dimensions.
        tooltipRect = tooltipRef.current.getBoundingClientRect();
      }

      // Prefer below trigger, but flip above if there is no room.
      const hasRoomBelow = triggerRect.bottom + spacing + tooltipRect.height <= window.innerHeight - padding;
      top = hasRoomBelow
        ? triggerRect.bottom + spacing
        : triggerRect.top - tooltipRect.height - spacing;
      left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
    } else {
      switch (position) {
        case 'top':
          top = triggerRect.top - tooltipRect.height - spacing;
          left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
          break;
        case 'bottom':
          top = triggerRect.bottom + spacing;
          left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
          break;
        case 'left':
          top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
          left = triggerRect.left - tooltipRect.width - spacing;
          break;
        case 'right':
          top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
          left = triggerRect.right + spacing;
          break;
      }
    }

    // Adjust if tooltip goes off-screen
    if (left < padding) left = padding;
    if (left + tooltipRect.width > window.innerWidth - padding) {
      left = window.innerWidth - tooltipRect.width - padding;
    }
    if (top < padding) top = padding;
    if (top + tooltipRect.height > window.innerHeight - padding) {
      top = window.innerHeight - tooltipRect.height - padding;
    }

    setCoords({ top, left });
  };

  const handleMouseEnter = () => {
    if (disabled) return;
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        calculatePosition();
      });
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const handleTouchStart = () => {
    if (disabled) return;
    setIsVisible(true);
    requestAnimationFrame(() => {
      calculatePosition();
    });
  };

  const handleTouchEnd = () => {
    setTimeout(() => {
      setIsVisible(false);
    }, 4000); // Auto-hide after 4s on mobile for better readability
  };

  const handleClick = () => {
    if (!clickable || disabled) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const nextVisible = !isVisible;
    setIsVisible(nextVisible);

    if (nextVisible) {
      requestAnimationFrame(() => {
        calculatePosition();
      });
      timeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 4000);
    }
  };

  const getArrowClasses = () => {
    const arrows = {
      top: 'bottom-[-4px] left-1/2 -translate-x-1/2 border-t-gray-900 dark:border-t-gray-700 border-x-transparent border-b-transparent',
      bottom: 'top-[-4px] left-1/2 -translate-x-1/2 border-b-gray-900 dark:border-b-gray-700 border-x-transparent border-t-transparent',
      left: 'right-[-4px] top-1/2 -translate-y-1/2 border-l-gray-900 dark:border-l-gray-700 border-y-transparent border-r-transparent',
      right: 'left-[-4px] top-1/2 -translate-y-1/2 border-r-gray-900 dark:border-r-gray-700 border-y-transparent border-l-transparent',
    };
    return arrows[position];
  };

  const tooltipContent = isVisible && (
    <div
      ref={tooltipRef}
      className={`
        fixed z-50 px-2 py-1 text-xs font-medium text-white
        bg-gray-900 dark:bg-gray-700 rounded-md shadow-lg
        pointer-events-none select-none whitespace-normal break-words
        max-w-[calc(100vw-20px)]
        transition-opacity duration-200
        ${isVisible ? 'opacity-100' : 'opacity-0'}
        ${className}
      `}
      style={{
        top: `${coords.top}px`,
        left: `${coords.left}px`,
      }}
      role="tooltip"
    >
      {content}
      <div
        className={`absolute w-0 h-0 border-4 ${getArrowClasses()}`}
        aria-hidden="true"
      />
    </div>
  );

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClickCapture={clickable ? handleClick : undefined}
        className="inline-block"
      >
        {children}
      </div>
      {typeof document !== 'undefined' && tooltipContent && createPortal(tooltipContent, document.body)}
    </>
  );
}
