'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import DoshiMascot from './DoshiMascot';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  position?: 'left' | 'right' | 'top' | 'bottom';
  size?: 'small' | 'medium' | 'large' | 'full';
  showDoshi?: boolean;
  className?: string;
}

export default function Drawer({
  isOpen,
  onClose,
  children,
  title,
  position = 'bottom',
  size = 'medium',
  showDoshi = false,
  className = '',
}: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startX = useRef(0);
  const currentY = useRef(0);
  const currentX = useRef(0);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle swipe to close for mobile
  useEffect(() => {
    if (!isOpen) return;

    const drawer = drawerRef.current;
    if (!drawer) return;

    let isDragging = false;

    const handleTouchStart = (e: TouchEvent) => {
      isDragging = true;
      if (position === 'bottom' || position === 'top') {
        startY.current = e.touches[0].clientY;
      } else {
        startX.current = e.touches[0].clientX;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      
      if (position === 'bottom' || position === 'top') {
        currentY.current = e.touches[0].clientY;
        const diff = currentY.current - startY.current;
        
        if ((position === 'bottom' && diff > 0) || (position === 'top' && diff < 0)) {
          drawer.style.transform = `translateY(${diff}px)`;
        }
      } else {
        currentX.current = e.touches[0].clientX;
        const diff = currentX.current - startX.current;
        
        if ((position === 'right' && diff > 0) || (position === 'left' && diff < 0)) {
          drawer.style.transform = `translateX(${diff}px)`;
        }
      }
    };

    const handleTouchEnd = () => {
      isDragging = false;
      
      const threshold = 100; // pixels
      let shouldClose = false;
      
      if (position === 'bottom' || position === 'top') {
        const diff = Math.abs(currentY.current - startY.current);
        shouldClose = diff > threshold;
      } else {
        const diff = Math.abs(currentX.current - startX.current);
        shouldClose = diff > threshold;
      }
      
      if (shouldClose) {
        onClose();
      } else {
        drawer.style.transform = '';
      }
    };

    drawer.addEventListener('touchstart', handleTouchStart);
    drawer.addEventListener('touchmove', handleTouchMove);
    drawer.addEventListener('touchend', handleTouchEnd);

    return () => {
      drawer.removeEventListener('touchstart', handleTouchStart);
      drawer.removeEventListener('touchmove', handleTouchMove);
      drawer.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isOpen, onClose, position]);

  const getSizeClasses = () => {
    const sizes = {
      small: position === 'bottom' || position === 'top' ? 'h-1/4' : 'w-64',
      medium: position === 'bottom' || position === 'top' ? 'h-1/2' : 'w-80',
      large: position === 'bottom' || position === 'top' ? 'h-3/4' : 'w-96',
      full: position === 'bottom' || position === 'top' ? 'h-full' : 'w-full',
    };
    return sizes[size];
  };

  const getPositionClasses = () => {
    const positions = {
      left: `left-0 top-0 h-full ${getSizeClasses()} ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`,
      right: `right-0 top-0 h-full ${getSizeClasses()} ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`,
      top: `top-0 left-0 w-full ${getSizeClasses()} ${
        isOpen ? 'translate-y-0' : '-translate-y-full'
      }`,
      bottom: `bottom-0 left-0 w-full ${getSizeClasses()} ${
        isOpen ? 'translate-y-0' : 'translate-y-full'
      }`,
    };
    return positions[position];
  };

  if (!isOpen) return null;

  const drawerContent = (
    <div className="fixed inset-0 z-50 pointer-events-auto">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity opacity-100"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'drawer-title' : undefined}
        className={`
          fixed bg-white dark:bg-gray-800 shadow-xl
          transition-transform duration-300 ease-in-out
          ${getPositionClasses()}
          ${position === 'bottom' || position === 'top' ? 'flex flex-col' : ''}
          ${className}
        `}
      >
        {/* Handle for mobile */}
        {(position === 'bottom' || position === 'top') && (
          <div className="flex justify-center p-2 flex-shrink-0">
            <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
          </div>
        )}

        {/* Header */}
        {(title || showDoshi) && (
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-3">
              {showDoshi && (
                <DoshiMascot size="small" />
              )}
              {title && (
                <h2 id="drawer-title" className="text-lg font-semibold text-gray-900 dark:text-white">
                  {title}
                </h2>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close drawer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Content - with proper scrolling */}
        <div className="flex-1 overflow-y-auto p-4 overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(drawerContent, document.body);
  }

  return null;
}