import React from 'react';

interface SectionProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
  variant?: 'default' | 'glass' | 'solid' | 'bordered';
  padding?: 'none' | 'small' | 'medium' | 'large';
  icon?: React.ReactNode;
}

/**
 * Section - A consistent section wrapper with various styling options
 * Provides consistent spacing, backgrounds, and optional headers
 */
export default function Section({ 
  children, 
  title,
  description,
  className = '',
  variant = 'glass',
  padding = 'medium',
  icon
}: SectionProps) {
  const variants = {
    default: 'bg-white dark:bg-dark-800',
    glass: 'bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm',
    solid: 'bg-white dark:bg-dark-800',
    bordered: 'bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700'
  };

  const paddings = {
    none: '',
    small: 'p-4',
    medium: 'p-6',
    large: 'p-8'
  };

  return (
    <section className={`${variants[variant]} rounded-xl shadow-lg ${paddings[padding]} ${className}`}>
      {(title || description) && (
        <div className="mb-4">
          {title && (
            <h2 className="text-xl font-bold text-gray-900 dark:text-dark-100 flex items-center gap-2">
              {icon}
              {title}
            </h2>
          )}
          {description && (
            <p className="text-sm text-gray-600 dark:text-dark-400 mt-1">
              {description}
            </p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * SectionGrid - A grid layout for multiple sections
 */
export function SectionGrid({ 
  children, 
  columns = 1,
  gap = 'medium',
  className = '' 
}: {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: 'small' | 'medium' | 'large';
  className?: string;
}) {
  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  };

  const gapClasses = {
    small: 'gap-4',
    medium: 'gap-6',
    large: 'gap-8'
  };

  return (
    <div className={`grid ${columnClasses[columns]} ${gapClasses[gap]} ${className}`}>
      {children}
    </div>
  );
}