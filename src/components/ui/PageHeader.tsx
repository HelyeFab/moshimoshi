import React from 'react';
import DoshiMascot from './DoshiMascot';

interface PageHeaderProps {
  title: string;
  description?: string;
  showDoshi?: boolean;
  doshiMood?: 'happy' | 'sad' | 'excited' | 'thinking' | 'sleeping' | 'waving';
  doshiSize?: 'xsmall' | 'small' | 'medium' | 'large';
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  className?: string;
}

/**
 * PageHeader - A consistent page header component with optional Doshi mascot
 * Provides uniform page titles across the application
 */
export default function PageHeader({
  title,
  description,
  showDoshi = false,
  doshiMood = 'happy',
  doshiSize = 'medium',
  actions,
  breadcrumb,
  className = ''
}: PageHeaderProps) {
  return (
    <div className={`mb-8 ${className}`}>
      {breadcrumb && (
        <div className="mb-4">
          {breadcrumb}
        </div>
      )}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {showDoshi && (
            <DoshiMascot 
              size={doshiSize}
              variant="animated"
            />
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-100">
              {title}
            </h1>
            {description && (
              <p className="text-sm text-gray-600 dark:text-dark-400 mt-1">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Breadcrumb - A simple breadcrumb component for navigation
 */
export function Breadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600 dark:text-dark-400">
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span>/</span>}
          {item.href ? (
            <a href={item.href} className="hover:text-primary-500 dark:hover:text-primary-400 transition-colors">
              {item.label}
            </a>
          ) : (
            <span className="text-gray-900 dark:text-dark-100">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}