'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import('lottie-react'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center">
      <Image
        src="/doshi.png"
        alt="Doshi Loading..."
        width={64}
        height={64}
        className="opacity-50"
      />
    </div>
  )
});

interface DoshiMascotProps {
  variant?: 'static' | 'animated' | 'auto';
  size?: 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge';
  className?: string;
  alt?: string;
  priority?: boolean;
  onClick?: () => void;
  loop?: boolean;
}

const sizeMap = {
  xsmall: 30,
  small: 48,
  medium: 80,
  large: 120,
  xlarge: 200,
};

export default function DoshiMascot({
  variant = 'auto',
  size = 'medium',
  className = '',
  alt = 'Doshi - Your Learning Companion',
  priority = false,
  onClick,
  loop = true,
}: DoshiMascotProps) {
  const [animationData, setAnimationData] = useState<any>(null);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const dimension = sizeMap[size];

  // Determine whether to use animation
  useEffect(() => {
    if (variant === 'static') {
      setShouldAnimate(false);
    } else if (variant === 'animated') {
      setShouldAnimate(true);
    } else {
      // Auto mode: use animation for medium and larger sizes
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const isLargeEnough = size === 'medium' || size === 'large' || size === 'xlarge';
      setShouldAnimate(!prefersReducedMotion && isLargeEnough);
    }
  }, [variant, size]);

  // Load animation data if needed
  useEffect(() => {
    if (shouldAnimate && !animationData && !loadError) {
      fetch('/red-panda/red-panda.json')
        .then(response => {
          if (!response.ok) throw new Error('Failed to load animation');
          return response.json();
        })
        .then(data => setAnimationData(data))
        .catch(error => {
          console.error('Failed to load red panda animation:', error);
          setLoadError(true);
          setShouldAnimate(false);
        });
    }
  }, [shouldAnimate, animationData, loadError]);

  const wrapperProps = {
    className: `relative inline-block transition-transform ${
      onClick ? 'cursor-pointer hover:scale-110' : ''
    } ${className}`,
    onClick,
    style: {
      width: dimension,
      height: dimension,
      // Prevent layout shifts and improve rendering
      contain: 'layout style paint',
      willChange: shouldAnimate ? 'transform' : 'auto',
    },
    role: onClick ? 'button' : undefined,
    tabIndex: onClick ? 0 : undefined,
    'aria-label': onClick ? `${alt} - Click to interact` : alt,
    onKeyDown: onClick
      ? (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }
      : undefined,
  };

  return (
    <div {...wrapperProps}>
      {shouldAnimate && animationData ? (
        <Lottie
          animationData={animationData}
          loop={loop}
          autoplay={true}
          style={{
            width: '100%',
            height: '100%',
            // Prevent tearing with GPU acceleration
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
            perspective: 1000,
          }}
          rendererSettings={{
            preserveAspectRatio: 'xMidYMid meet',
            // Use canvas renderer for better performance
            // SVG can cause tearing on some browsers
            viewBoxOnly: true,
            progressiveLoad: true,
            hideOnTransparent: false,
            className: 'lottie-animation'
          }}
        />
      ) : (
        <Image
          src="/doshi.png"
          alt={alt}
          width={dimension}
          height={dimension}
          priority={priority}
          className="w-full h-full object-contain"
        />
      )}
      
    </div>
  );
}

// Export a simpler loading version for use in loading states
export function DoshiLoading({ size = 'small' }: { size?: DoshiMascotProps['size'] }) {
  const dimension = sizeMap[size];
  
  return (
    <div 
      className="inline-block animate-pulse"
      style={{ width: dimension, height: dimension }}
    >
      <Image
        src="/doshi.png"
        alt="Loading..."
        width={dimension}
        height={dimension}
        className="w-full h-full object-contain opacity-50"
      />
    </div>
  );
}

export { DoshiMascot };