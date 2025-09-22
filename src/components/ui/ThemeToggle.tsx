'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/lib/theme/ThemeContext';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const themes = [
    { value: 'light' as const, icon: '☀️', label: 'Light theme' },
    { value: 'system' as const, icon: '💻', label: 'System theme' },
    { value: 'dark' as const, icon: '🌙', label: 'Dark theme' },
  ];

  const currentTheme = themes.find(t => t.value === theme) || themes[0];
  const otherThemes = themes.filter(t => t.value !== theme);

  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isExpanded]);

  const handleMainButtonClick = () => {
    setIsExpanded(prev => !prev);
  };

  const selectTheme = (newTheme: 'light' | 'system' | 'dark') => {
    setTheme(newTheme);
    setIsExpanded(false);
  };

  const getButtonStyle = (index: number) => {
    if (isMobile) {
      // Vertical animation on mobile (downward)
      return {
        top: 0,
        right: 0,
        transform: isExpanded 
          ? `translateY(${(index + 1) * 48}px)` 
          : 'translateY(0)',
        opacity: isExpanded ? 1 : 0,
        visibility: isExpanded ? 'visible' as const : 'hidden' as const,
        pointerEvents: isExpanded ? 'auto' as const : 'none' as const,
        transitionDelay: isExpanded 
          ? `${index * 75}ms` 
          : `${(otherThemes.length - index - 1) * 75}ms`,
      };
    } else {
      // Horizontal animation on desktop (leftward)
      return {
        top: 0,
        right: 0,
        transform: isExpanded 
          ? `translateX(-${(index + 1) * 48}px)` 
          : 'translateX(0)',
        opacity: isExpanded ? 1 : 0,
        visibility: isExpanded ? 'visible' as const : 'hidden' as const,
        pointerEvents: isExpanded ? 'auto' as const : 'none' as const,
        transitionDelay: isExpanded 
          ? `${index * 75}ms` 
          : `${(otherThemes.length - index - 1) * 75}ms`,
      };
    }
  };

  return (
    <div ref={containerRef} className="relative z-50">
      <div className="relative flex items-center">
        {/* Main toggle button */}
        <button
          type="button"
          onClick={handleMainButtonClick}
          className="relative z-20 p-2.5 bg-gray-100 dark:bg-dark-800 rounded-full hover:bg-gray-200 dark:hover:bg-dark-700 transition-all duration-300 shadow-sm hover:shadow-md"
          aria-label="Toggle theme selector"
          aria-expanded={isExpanded}
        >
          <span className="text-xl w-6 h-6 flex items-center justify-center">
            {currentTheme.icon}
          </span>
        </button>

        {/* Other theme options */}
        {otherThemes.map((themeOption, index) => (
          <button
            key={themeOption.value}
            type="button"
            onClick={() => selectTheme(themeOption.value)}
            className="absolute p-2.5 rounded-full bg-white dark:bg-dark-700 hover:bg-gray-100 dark:hover:bg-dark-600 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-110"
            aria-label={themeOption.label}
            style={getButtonStyle(index)}
          >
            <span className="text-xl w-6 h-6 flex items-center justify-center">
              {themeOption.icon}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}