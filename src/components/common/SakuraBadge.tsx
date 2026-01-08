import React from 'react';

interface SakuraBadgeProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  animated?: boolean;
}

export function SakuraBadge({ size = 'md', className = '', animated = true }: SakuraBadgeProps) {
  const sizeClasses = {
    xs: 'w-4 h-4',
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div
      className={`
        ${sizeClasses[size]}
        filter drop-shadow-md
        ${animated ? 'animate-pulse-slow' : ''}
        ${className}
      `}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Sakura petals */}
        <g>
          {/* Top petal */}
          <path
            d="M12 2C12 2 10.5 4.5 10.5 6.5C10.5 7.88 11.12 9 12 9C12.88 9 13.5 7.88 13.5 6.5C13.5 4.5 12 2 12 2Z"
            fill="#FF9AA2"
            className="opacity-90"
          />

          {/* Top-right petal */}
          <path
            d="M18.5 6.5C18.5 6.5 16 7.5 14.5 8.5C13.5 9.2 13 10.2 13.5 11C14 11.8 15.2 11.5 16.2 10.8C17.8 9.5 18.5 6.5 18.5 6.5Z"
            fill="#FFB7B2"
            className="opacity-90"
          />

          {/* Bottom-right petal */}
          <path
            d="M18.5 17.5C18.5 17.5 16.5 16 15 14.8C13.8 14 12.8 13.8 12.3 14.5C11.8 15.2 12.5 16.2 13.7 17C15.5 18.2 18.5 17.5 18.5 17.5Z"
            fill="#FFDAC1"
            className="opacity-90"
          />

          {/* Bottom petal */}
          <path
            d="M12 22C12 22 13.5 19.5 13.5 17.5C13.5 16.12 12.88 15 12 15C11.12 15 10.5 16.12 10.5 17.5C10.5 19.5 12 22 12 22Z"
            fill="#FFB7B2"
            className="opacity-90"
          />

          {/* Bottom-left petal */}
          <path
            d="M5.5 17.5C5.5 17.5 7.5 16 9 14.8C10.2 14 11.2 13.8 11.7 14.5C12.2 15.2 11.5 16.2 10.3 17C8.5 18.2 5.5 17.5 5.5 17.5Z"
            fill="#FF9AA2"
            className="opacity-90"
          />

          {/* Top-left petal */}
          <path
            d="M5.5 6.5C5.5 6.5 8 7.5 9.5 8.5C10.5 9.2 11 10.2 10.5 11C10 11.8 8.8 11.5 7.8 10.8C6.2 9.5 5.5 6.5 5.5 6.5Z"
            fill="#FFDAC1"
            className="opacity-90"
          />

          {/* Center */}
          <circle cx="12" cy="12" r="2.5" fill="#EF4444" className="opacity-80" />
          <circle cx="12" cy="12" r="1.5" fill="#FFF" className="opacity-60" />
        </g>
      </svg>
    </div>
  );
}
