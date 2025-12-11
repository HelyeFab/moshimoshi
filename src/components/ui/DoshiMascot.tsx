'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useIsTablet, usePrefersReducedMotion } from '@/hooks/useMediaQuery';

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(
  () => import('lottie-react').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center">
        <Image
          src="/doshi.png"
          alt="Doshi Loading..."
          width={64}
          height={64}
          priority
          className="opacity-50"
        />
      </div>
    )
  }
);

// Mood types for semantic usage - currently mapped to variant behavior
// Future: could support different animations/images per mood
export type DoshiMood = 'happy' | 'excited' | 'thinking' | 'curious' | 'sleepy' | 'sad' | 'celebrating' | 'studying' | 'loading';

export interface DoshiMascotProps {
  variant?: 'static' | 'animated' | 'auto';
  size?: 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge';
  className?: string;
  alt?: string;
  priority?: boolean;
  onClick?: () => void;
  loop?: boolean;
  /** Semantic mood indicator. Currently decorative - future versions may show different animations per mood */
  mood?: DoshiMood;
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
  mood: _mood, // Currently unused - reserved for future mood-specific animations
}: DoshiMascotProps) {
  const [animationData, setAnimationData] = useState<any>(null);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // SSR-safe hooks - return undefined during SSR, boolean after hydration
  const isMobileQuery = useIsTablet(); // md breakpoint (768px)
  const prefersReducedMotion = usePrefersReducedMotion();

  // During SSR (undefined), default to desktop behavior (false)
  const isMobile = isMobileQuery === true;

  const dimension = sizeMap[size];

  // Determine whether to use animation
  // Wait for hydration before deciding (isMobileQuery !== undefined)
  useEffect(() => {
    if (isMobileQuery === undefined || prefersReducedMotion === undefined) {
      return; // Wait for hydration
    }

    if (variant === 'static') {
      setShouldAnimate(false);
    } else if (variant === 'animated') {
      // On mobile, only animate for larger sizes to prevent performance issues
      setShouldAnimate(!isMobile || (size === 'large' || size === 'xlarge'));
    } else {
      // Auto mode: use animation for medium and larger sizes, but be more conservative on mobile
      const isLargeEnough = isMobile
        ? (size === 'large' || size === 'xlarge')
        : (size === 'medium' || size === 'large' || size === 'xlarge');
      setShouldAnimate(!prefersReducedMotion && isLargeEnough);
    }
  }, [variant, size, isMobile, isMobileQuery, prefersReducedMotion]);

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

  const wrapperProps: React.HTMLAttributes<HTMLDivElement> & { style: React.CSSProperties } = {
    className: `relative inline-block transition-transform ${
      onClick ? 'cursor-pointer hover:scale-110' : ''
    } ${className}`,
    onClick,
    style: {
      width: dimension,
      height: dimension,
      // Prevent layout shifts and improve rendering
      contain: 'layout style paint',
      willChange: shouldAnimate && !isMobile ? 'transform' : 'auto',
      // Mobile-specific optimizations
      ...(isMobile && shouldAnimate ? {
        WebkitTransform: 'translate3d(0,0,0)',
        transform: 'translate3d(0,0,0)',
        WebkitBackfaceVisibility: 'hidden' as const,
        backfaceVisibility: 'hidden' as const,
      } : {}),
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
            // Mobile-optimized styles to prevent tearing
            transform: isMobile ? 'translate3d(0,0,0)' : 'translateZ(0)',
            backfaceVisibility: 'hidden',
            perspective: 1000,
            WebkitTransform: 'translate3d(0,0,0)',
            WebkitBackfaceVisibility: 'hidden',
            // Disable pointer events to improve performance
            pointerEvents: onClick ? 'auto' : 'none',
          }}
          // lottie-react passes these to lottie-web but types are incomplete
          {...{
            renderer: isMobile ? 'canvas' : 'svg',
            rendererSettings: {
              preserveAspectRatio: 'xMidYMid meet',
              // Force canvas renderer on mobile for better performance
              // Canvas renderer prevents the tearing issues on mobile
              ...(isMobile ? {
                context: undefined,
                clearCanvas: false,
                progressiveLoad: false,
                hideOnTransparent: true,
              } : {
                viewBoxOnly: true,
                progressiveLoad: true,
                hideOnTransparent: false,
                className: 'lottie-animation'
              })
            }
          } as Record<string, unknown>}
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
export function DoshiLoading({ size = 'small', priority = false }: { size?: DoshiMascotProps['size']; priority?: boolean }) {
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
        priority={priority}
        className="w-full h-full object-contain opacity-50"
      />
    </div>
  );
}

export { DoshiMascot };