'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import('lottie-react'), {
  ssr: false,
  loading: () => null
});

interface MoshimoshiLogoProps {
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  animated?: boolean;
  className?: string;
  variant?: 'inline' | 'stacked';
}

const sizeConfig = {
  small: {
    fontSize: '1.5rem',
    doshiSize: 24,
    gap: '0.125rem',
  },
  medium: {
    fontSize: '2.5rem',
    doshiSize: 40,
    gap: '0.25rem',
  },
  large: {
    fontSize: '4rem',
    doshiSize: 64,
    gap: '0.375rem',
  },
  xlarge: {
    fontSize: '6rem',
    doshiSize: 96,
    gap: '0.5rem',
  },
};

export default function MoshimoshiLogo({
  size = 'medium',
  animated = false,
  className = '',
  variant = 'inline',
}: MoshimoshiLogoProps) {
  const [animationData, setAnimationData] = useState<any>(null);
  const config = sizeConfig[size];

  // Load animation data if needed
  useEffect(() => {
    if (animated) {
      fetch('/red-panda/red-panda.json')
        .then(response => response.json())
        .then(data => setAnimationData(data))
        .catch(error => console.error('Failed to load animation:', error));
    }
  }, [animated]);

  const DoshiO = () => {
    if (animated && animationData) {
      return (
        <span 
          className="inline-block align-middle"
          style={{ 
            width: config.doshiSize, 
            height: config.doshiSize,
            margin: `0 ${config.gap}`,
          }}
        >
          <Lottie
            animationData={animationData}
            loop={true}
            autoplay={true}
            style={{ width: '100%', height: '100%' }}
            rendererSettings={{
              preserveAspectRatio: 'xMidYMid meet'
            }}
          />
        </span>
      );
    }

    return (
      <span 
        className="inline-block align-middle transition-transform hover:scale-110"
        style={{ 
          width: config.doshiSize, 
          height: config.doshiSize,
          margin: `0 ${config.gap}`,
        }}
      >
        <Image
          src="/doshi.png"
          alt="o"
          width={config.doshiSize}
          height={config.doshiSize}
          className="w-full h-full object-contain"
        />
      </span>
    );
  };

  if (variant === 'stacked') {
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <div 
          className="font-japanese font-bold text-primary-500 dark:text-primary-400 flex items-center"
          style={{ fontSize: config.fontSize }}
        >
          <span>M</span>
          <DoshiO />
          <span>shi</span>
        </div>
        <div 
          className="font-japanese font-bold text-primary-500 dark:text-primary-400 flex items-center"
          style={{ fontSize: config.fontSize }}
        >
          <span>M</span>
          <DoshiO />
          <span>shi</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`font-japanese font-bold text-primary-500 dark:text-primary-400 inline-flex items-center ${className}`}
      style={{ fontSize: config.fontSize }}
    >
      <span>M</span>
      <DoshiO />
      <span>shim</span>
      <DoshiO />
      <span>shi</span>
    </div>
  );
}

// Alternative version with text shadow for more impact
export function MoshimoshiLogoHero({
  animated = true,
  className = '',
}: {
  animated?: boolean;
  className?: string;
}) {
  const [animationData, setAnimationData] = useState<any>(null);

  useEffect(() => {
    if (animated) {
      fetch('/red-panda/red-panda.json')
        .then(response => response.json())
        .then(data => setAnimationData(data))
        .catch(error => console.error('Failed to load animation:', error));
    }
  }, [animated]);

  const DoshiO = ({ delay = 0 }: { delay?: number }) => {
    if (animated && animationData) {
      return (
        <span 
          className="inline-block align-middle animate-bounce"
          style={{ 
            width: 80, 
            height: 80,
            margin: '0 0.5rem',
            animationDelay: `${delay}ms`,
          }}
        >
          <Lottie
            animationData={animationData}
            loop={true}
            autoplay={true}
            style={{ width: '100%', height: '100%' }}
            rendererSettings={{
              preserveAspectRatio: 'xMidYMid meet'
            }}
          />
        </span>
      );
    }

    return (
      <span 
        className="inline-block align-middle animate-bounce"
        style={{ 
          width: 80, 
          height: 80,
          margin: '0 0.5rem',
          animationDelay: `${delay}ms`,
        }}
      >
        <Image
          src="/doshi.png"
          alt="o"
          width={80}
          height={80}
          className="w-full h-full object-contain"
        />
      </span>
    );
  };

  return (
    <h1 
      className={`font-japanese font-black text-6xl lg:text-8xl bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent inline-flex items-center ${className}`}
      style={{
        filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))',
      }}
    >
      <span className="animate-fade-in">M</span>
      <DoshiO delay={100} />
      <span className="animate-fade-in" style={{ animationDelay: '200ms' }}>shim</span>
      <DoshiO delay={300} />
      <span className="animate-fade-in" style={{ animationDelay: '400ms' }}>shi</span>
    </h1>
  );
}

export { MoshimoshiLogo };