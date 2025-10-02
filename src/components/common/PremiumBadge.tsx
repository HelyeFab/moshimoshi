import React from 'react';
import Image from 'next/image';

interface PremiumBadgeProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export function PremiumBadge({ size = 'md', className = '' }: PremiumBadgeProps) {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <div
      className={`
        ${sizeClasses[size]}
        filter drop-shadow-lg
        ${className}
      `}
    >
      <Image
        src="/ui/flat-icons/ui/crown.png"
        alt="Premium"
        width={40}
        height={40}
        className="w-full h-full object-contain"
      />
    </div>
  );
}