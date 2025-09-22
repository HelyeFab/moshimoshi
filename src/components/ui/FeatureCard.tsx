import React from 'react';
import Image from 'next/image';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  image?: string;
  imageAlt?: string;
  footer?: React.ReactNode;
  variant?: 'default' | 'outlined' | 'elevated' | 'glass';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Card({
  children,
  title,
  subtitle,
  image,
  imageAlt,
  footer,
  variant = 'default',
  padding = 'md',
  hoverable = false,
  onClick,
  className = ''
}: CardProps) {
  const variantClasses = {
    default: 'bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700',
    outlined: 'bg-transparent border-2 border-gray-300 dark:border-dark-600',
    elevated: 'bg-white dark:bg-dark-800 shadow-lg',
    glass: 'bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm border border-gray-200/50 dark:border-dark-700/50'
  };

  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  };

  const hoverClass = hoverable ? 'hover:shadow-xl hover:scale-[1.02] transition-all duration-200' : '';
  const clickableClass = onClick ? 'cursor-pointer' : '';

  return (
    <div
      onClick={onClick}
      className={`
        rounded-lg overflow-hidden
        ${variantClasses[variant]}
        ${hoverClass}
        ${clickableClass}
        ${className}
      `}
    >
      {image && (
        <div className="relative w-full h-48 overflow-hidden">
          <Image
            src={image}
            alt={imageAlt || 'Card image'}
            fill
            className="object-cover"
          />
        </div>
      )}
      
      {(title || subtitle) && (
        <div className={`${image ? 'pt-4' : ''} ${paddingClasses[padding]} ${!children && !footer ? '' : 'pb-2'}`}>
          {title && (
            <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-sm text-gray-600 dark:text-dark-400 mt-1">
              {subtitle}
            </p>
          )}
        </div>
      )}
      
      {children && (
        <div className={`${paddingClasses[padding]} ${title || subtitle ? 'pt-2' : ''} ${footer ? 'pb-2' : ''}`}>
          {children}
        </div>
      )}
      
      {footer && (
        <div className={`
          ${paddingClasses[padding]} 
          ${children || title || subtitle ? 'pt-2' : ''}
          border-t border-gray-200 dark:border-dark-700
          bg-gray-50 dark:bg-dark-850
        `}>
          {footer}
        </div>
      )}
    </div>
  );
}

// Horizontal card variant
interface HorizontalCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  image?: string;
  imageAlt?: string;
  imagePosition?: 'left' | 'right';
  variant?: 'default' | 'outlined' | 'elevated' | 'glass';
  hoverable?: boolean;
  onClick?: () => void;
  className?: string;
}

export function HorizontalCard({
  children,
  title,
  subtitle,
  image,
  imageAlt,
  imagePosition = 'left',
  variant = 'default',
  hoverable = false,
  onClick,
  className = ''
}: HorizontalCardProps) {
  const variantClasses = {
    default: 'bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700',
    outlined: 'bg-transparent border-2 border-gray-300 dark:border-dark-600',
    elevated: 'bg-white dark:bg-dark-800 shadow-lg',
    glass: 'bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm border border-gray-200/50 dark:border-dark-700/50'
  };

  const hoverClass = hoverable ? 'hover:shadow-xl hover:scale-[1.02] transition-all duration-200' : '';
  const clickableClass = onClick ? 'cursor-pointer' : '';

  const imageElement = image && (
    <div className="relative w-48 h-full min-h-[150px]">
      <Image
        src={image}
        alt={imageAlt || 'Card image'}
        fill
        className="object-cover"
      />
    </div>
  );

  return (
    <div
      onClick={onClick}
      className={`
        flex rounded-lg overflow-hidden
        ${variantClasses[variant]}
        ${hoverClass}
        ${clickableClass}
        ${className}
      `}
    >
      {imagePosition === 'left' && imageElement}
      
      <div className="flex-1 p-4">
        {(title || subtitle) && (
          <div className="mb-2">
            {title && (
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-sm text-gray-600 dark:text-dark-400 mt-1">
                {subtitle}
              </p>
            )}
          </div>
        )}
        
        <div className="text-gray-700 dark:text-dark-300">
          {children}
        </div>
      </div>
      
      {imagePosition === 'right' && imageElement}
    </div>
  );
}

// Card skeleton for loading states
interface CardSkeletonProps {
  showImage?: boolean;
  showFooter?: boolean;
  variant?: 'default' | 'horizontal';
  className?: string;
}

export function CardSkeleton({
  showImage = true,
  showFooter = false,
  variant = 'default',
  className = ''
}: CardSkeletonProps) {
  if (variant === 'horizontal') {
    return (
      <div className={`flex rounded-lg overflow-hidden bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 ${className}`}>
        {showImage && (
          <div className="w-48 h-36 bg-gray-200 dark:bg-dark-700 animate-pulse" />
        )}
        <div className="flex-1 p-4 space-y-3">
          <div className="h-5 bg-gray-200 dark:bg-dark-700 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded animate-pulse w-1/2" />
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
            <div className="h-3 bg-gray-200 dark:bg-dark-700 rounded animate-pulse w-5/6" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg overflow-hidden bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 ${className}`}>
      {showImage && (
        <div className="w-full h-48 bg-gray-200 dark:bg-dark-700 animate-pulse" />
      )}
      <div className="p-4 space-y-3">
        <div className="h-5 bg-gray-200 dark:bg-dark-700 rounded animate-pulse w-3/4" />
        <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded animate-pulse w-1/2" />
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
          <div className="h-3 bg-gray-200 dark:bg-dark-700 rounded animate-pulse w-5/6" />
        </div>
      </div>
      {showFooter && (
        <div className="p-4 border-t border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-850">
          <div className="h-8 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
        </div>
      )}
    </div>
  );
}
export default Card;
