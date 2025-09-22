'use client';

import React from 'react';
import SpeakerIcon from './SpeakerIcon';
import { TTSOptions } from '@/lib/tts/types';

interface TTSTextProps {
  children: string;
  showIcon?: boolean;
  iconPosition?: 'left' | 'right';
  autoPlay?: boolean;
  highlightOnPlay?: boolean;
  className?: string;
  iconSize?: 'xs' | 'sm' | 'md' | 'lg';
  options?: TTSOptions;
}

export default function TTSText({
  children,
  showIcon = true,
  iconPosition = 'right',
  autoPlay = false,
  highlightOnPlay = false,
  className = '',
  iconSize = 'sm',
  options,
}: TTSTextProps) {
  const [isPlaying, setIsPlaying] = React.useState(false);

  const handlePlay = () => setIsPlaying(true);
  const handleEnd = () => setIsPlaying(false);

  const textClasses = `
    inline-flex items-center gap-1
    ${highlightOnPlay && isPlaying ? 'text-primary-600 dark:text-primary-400' : ''}
    ${className}
  `;

  if (!showIcon) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span className={textClasses}>
      {iconPosition === 'left' && (
        <SpeakerIcon
          text={children}
          size={iconSize}
          onPlay={handlePlay}
          onEnd={handleEnd}
          options={options}
        />
      )}
      <span>{children}</span>
      {iconPosition === 'right' && (
        <SpeakerIcon
          text={children}
          size={iconSize}
          onPlay={handlePlay}
          onEnd={handleEnd}
          options={options}
        />
      )}
    </span>
  );
}