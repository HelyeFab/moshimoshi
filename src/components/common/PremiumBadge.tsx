import React from 'react';
import Image from 'next/image';

interface PremiumBadgeProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export function PremiumBadge({ size = 'md', className = '' }: PremiumBadgeProps) {
  const sizeClasses = {
    xs: 'w-5 h-5',
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
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
        src="/ui/flat-icons/premium.png"
        alt="Premium"
        width={40}
        height={40}
        className="w-full h-full object-contain"
      />
    </div>
  );
}