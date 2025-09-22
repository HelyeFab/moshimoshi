import React from 'react';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  showPattern?: boolean;
  gradient?: 'default' | 'sakura' | 'mizu' | 'matcha' | 'custom';
  customGradient?: string;
}

/**
 * PageContainer - A consistent page wrapper with gradient backgrounds and optional patterns
 * Used across multiple pages for consistent styling
 */
export default function PageContainer({ 
  children, 
  className = '',
  showPattern = true,
  gradient = 'default',
  customGradient
}: PageContainerProps) {
  const gradients = {
    default: 'from-background-light via-japanese-mizu/10 to-japanese-sakura/10 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800',
    sakura: 'from-japanese-sakura/5 via-background-light to-japanese-sakura/10 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800',
    mizu: 'from-japanese-mizu/5 via-background-light to-japanese-mizu/10 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800',
    matcha: 'from-japanese-matcha/5 via-background-light to-japanese-matcha/10 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800',
    custom: customGradient || ''
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${gradients[gradient]} transition-colors duration-500 ${className}`}>
      {showPattern && (
        <div className="fixed inset-0 opacity-5 dark:opacity-10 pointer-events-none">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ef4444' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>
      )}
      {children}
    </div>
  );
}