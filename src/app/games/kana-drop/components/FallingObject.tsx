'use client';

import { motion } from 'framer-motion';
import { FallingObject as FallingObjectType, GAME_CONSTANTS } from '../types';

interface FallingObjectProps {
  object: FallingObjectType;
  fallDuration: number;
  onReachBottom: (object: FallingObjectType) => void;
  onClick: (object: FallingObjectType) => void;
  isClickable: boolean;
  isPaused?: boolean;
}

export default function FallingObject({
  object,
  fallDuration,
  onReachBottom,
  onClick,
  isClickable,
  isPaused = false
}: FallingObjectProps) {
  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (isClickable) {
      onClick(object);
    }
  };

  return (
    <motion.div
      key={object.id}
      initial={{ y: -GAME_CONSTANTS.OBJECT_SIZE, x: `${object.x}%` }}
      animate={{ y: isPaused ? undefined : '100vh' }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{
        duration: fallDuration / 1000, // Convert to seconds
        ease: 'linear'
      }}
      onAnimationComplete={() => !isPaused && onReachBottom(object)}
      className="absolute touch-none"
      style={{
        left: `${object.x}%`,
        transform: 'translateX(-50%)',
        cursor: isClickable ? 'pointer' : 'default',
        zIndex: 10,
        pointerEvents: isClickable ? 'auto' : 'none',
        WebkitTapHighlightColor: 'transparent'
      }}
      onClick={handleClick}
      onTouchStart={handleClick}
      onPointerDown={handleClick}
    >
      {(object.type === 'kana' || object.type === 'wrong-kana') ? (
        <div className="relative group">
          {/* Invisible click area for better mobile tapping */}
          <div className="absolute -inset-4 rounded-lg" />
          <div className="text-5xl font-bold text-gray-900 dark:text-white select-none p-2 rounded-lg bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm border-2 border-primary-400/20 shadow-lg hover:shadow-xl transition-shadow">
            {object.content}
          </div>
          {/* Subtle glow effect on hover */}
          <div className="absolute inset-0 rounded-lg bg-primary-400/20 scale-0 group-hover:scale-110 transition-transform" />
        </div>
      ) : (
        <div className="relative w-16 h-16 opacity-70 hover:opacity-100 transition-opacity">
          {/* Invisible click area for better mobile tapping */}
          <div className="absolute -inset-4 rounded-lg" />
          <img
            src={object.content}
            alt="distractor"
            className="w-full h-full object-contain drop-shadow-md"
            draggable={false}
            onError={(e) => {
              // Hide broken images instead of showing broken icon
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}
    </motion.div>
  );
}