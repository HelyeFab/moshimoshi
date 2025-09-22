import React from 'react';
import Image from 'next/image';
import { PremiumBadge } from '@/components/common/PremiumBadge';

interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'square';
  status?: 'online' | 'offline' | 'away' | 'busy';
  badge?: React.ReactNode;
  showPremiumBadge?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Avatar({
  src,
  alt,
  name,
  size = 'md',
  shape = 'circle',
  status,
  badge,
  showPremiumBadge = false,
  onClick,
  className = ''
}: AvatarProps) {
  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl'
  };

  const statusSizes = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
    xl: 'w-4 h-4'
  };

  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-gray-400',
    away: 'bg-yellow-500',
    busy: 'bg-red-500'
  };

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-lg';
  const isClickable = !!onClick;

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div 
      className={`relative inline-block ${className}`}
      onClick={onClick}
    >
      <div
        className={`
          ${sizeClasses[size]} ${shapeClass}
          ${isClickable ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
          overflow-hidden bg-gray-200 dark:bg-dark-700
        `}
      >
        {src ? (
          <Image
            src={src}
            alt={alt || name || 'Avatar'}
            width={64}
            height={64}
            className="w-full h-full object-cover"
          />
        ) : name ? (
          <div className={`
            w-full h-full flex items-center justify-center
            bg-gradient-to-br from-primary-400 to-primary-600
            text-white font-semibold
          `}>
            {getInitials(name)}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-dark-500">
            <svg className="w-3/5 h-3/5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
        )}
      </div>

      {status && (
        <div className={`
          absolute bottom-0 right-0 
          ${statusSizes[size]} ${statusColors[status]}
          border-2 border-white dark:border-dark-800
          ${shapeClass}
        `} />
      )}

      {(badge || showPremiumBadge) && (
        <div className="absolute -top-2 -right-2">
          {showPremiumBadge ? <PremiumBadge size={size === 'xs' ? 'xs' : size === 'sm' ? 'sm' : 'md'} /> : badge}
        </div>
      )}
    </div>
  );
}

// Avatar Group component for showing multiple avatars
interface AvatarGroupProps {
  avatars: Array<{
    src?: string;
    name?: string;
    alt?: string;
  }>;
  max?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function AvatarGroup({
  avatars,
  max = 3,
  size = 'md',
  className = ''
}: AvatarGroupProps) {
  const visibleAvatars = avatars.slice(0, max);
  const remainingCount = Math.max(avatars.length - max, 0);

  const overlapClasses = {
    xs: '-ml-2',
    sm: '-ml-2.5',
    md: '-ml-3',
    lg: '-ml-3.5',
    xl: '-ml-4'
  };

  return (
    <div className={`flex items-center ${className}`}>
      {visibleAvatars.map((avatar, index) => (
        <div
          key={index}
          className={`
            ${index > 0 ? overlapClasses[size] : ''}
            ring-2 ring-white dark:ring-dark-800 rounded-full
          `}
          style={{ zIndex: visibleAvatars.length - index }}
        >
          <Avatar
            src={avatar.src}
            name={avatar.name}
            alt={avatar.alt}
            size={size}
          />
        </div>
      ))}
      
      {remainingCount > 0 && (
        <div
          className={`
            ${overlapClasses[size]}
            ring-2 ring-white dark:ring-dark-800 rounded-full
          `}
        >
          <div className={`
            ${size === 'xs' ? 'w-6 h-6 text-xs' : ''}
            ${size === 'sm' ? 'w-8 h-8 text-sm' : ''}
            ${size === 'md' ? 'w-10 h-10 text-base' : ''}
            ${size === 'lg' ? 'w-12 h-12 text-lg' : ''}
            ${size === 'xl' ? 'w-16 h-16 text-xl' : ''}
            rounded-full bg-gray-300 dark:bg-dark-600
            flex items-center justify-center
            text-gray-700 dark:text-dark-200 font-medium
          `}>
            +{remainingCount}
          </div>
        </div>
      )}
    </div>
  );
}