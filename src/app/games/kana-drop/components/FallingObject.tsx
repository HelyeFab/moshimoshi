'use client';

import { useEffect, useRef } from 'react';
import { FallingObject as FallingObjectType } from '../types';

interface FallingObjectProps {
  object: FallingObjectType;
  fallDuration: number;
  onReachBottom: (objectId: string) => void;
  onClick: (object: FallingObjectType) => void;
}

export default function FallingObject({
  object,
  fallDuration,
  onReachBottom,
  onClick
}: FallingObjectProps) {
  const elementRef = useRef<HTMLDivElement>(null);

  // Set up CSS animation and handle completion
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Start animation after a tiny delay to ensure CSS transition triggers
    requestAnimationFrame(() => {
      element.style.transform = `translateX(-50%) translateY(100vh)`;
    });

    // Handle animation completion
    const handleTransitionEnd = (e: TransitionEvent) => {
      if (e.propertyName === 'transform') {
        console.log('[FallingObject] Animation complete:', object.id);
        onReachBottom(object.id);
      }
    };

    element.addEventListener('transitionend', handleTransitionEnd);

    return () => {
      element.removeEventListener('transitionend', handleTransitionEnd);
    };
  }, [object.id, onReachBottom]);

  const handleClick = () => {
    onClick(object);
  };

  return (
    <div
      ref={elementRef}
      className="absolute cursor-pointer"
      style={{
        left: `${object.x}%`,
        top: '-80px',
        transform: 'translateX(-50%)',
        transition: `transform ${fallDuration / 1000}s linear`,
        zIndex: 10,
      }}
      onClick={handleClick}
      onTouchStart={handleClick}
    >
      {(object.type === 'kana' || object.type === 'wrong-kana') ? (
        <div className="relative group">
          {/* Larger click area for mobile */}
          <div className="absolute -inset-4 rounded-lg" />

          <div className="text-5xl font-bold text-gray-900 dark:text-white select-none p-2 rounded-lg bg-white/90 dark:bg-dark-800/90 backdrop-blur-sm border-2 border-primary-300 dark:border-primary-600 shadow-lg hover:shadow-xl hover:scale-110 transition-all japanese-text">
            {object.content}
          </div>

          {/* Subtle glow effect on hover */}
          <div className="absolute inset-0 rounded-lg bg-primary-200/30 scale-0 group-hover:scale-110 transition-transform" />
        </div>
      ) : (
        <div className="relative w-16 h-16 opacity-80 hover:opacity-100 hover:scale-110 transition-all">
          {/* Larger click area for mobile */}
          <div className="absolute -inset-4 rounded-lg" />

          <img
            src={object.content}
            alt="distractor"
            className="w-full h-full object-contain drop-shadow-md"
            draggable={false}
            onError={(e) => {
              // Hide broken images
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}
    </div>
  );
}
