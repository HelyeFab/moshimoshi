'use client';

import { useState } from 'react';
import Image from 'next/image';
import DoshiMascot from '@/components/ui/DoshiMascot';

interface ArticleImageWithFallbackProps {
  imageUrl?: string;
  title: string;
  className?: string;
  height?: string;
  priority?: boolean;
  useDoshiFallback?: boolean;
}

/**
 * Article image component with automatic Doshi fallback for broken images
 * Handles 401 errors and other image loading failures gracefully
 */
export default function ArticleImageWithFallback({
  imageUrl,
  title,
  className = '',
  height = 'h-48',
  priority = false,
  useDoshiFallback = true
}: ArticleImageWithFallbackProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // No image URL provided - show Doshi immediately
  if (!imageUrl) {
    return useDoshiFallback ? (
      <div className={`relative ${height} bg-gradient-to-br from-primary/20 to-primary/5 overflow-hidden flex items-center justify-center ${className}`}>
        <DoshiMascot
          variant="static"
          size="large"
          alt={`${title} - Doshi reading companion`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
      </div>
    ) : (
      <div className={`relative ${height} bg-gradient-to-br from-primary/20 to-primary/5 ${className}`}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
      </div>
    );
  }

  // Image failed to load - show Doshi fallback
  if (imageError) {
    return useDoshiFallback ? (
      <div className={`relative ${height} bg-gradient-to-br from-primary/20 to-primary/5 overflow-hidden flex items-center justify-center ${className}`}>
        <DoshiMascot
          variant="static"
          size="large"
          alt={`${title} - Image unavailable`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
      </div>
    ) : (
      <div className={`relative ${height} bg-gradient-to-br from-primary/20 to-primary/5 ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-muted-foreground text-sm">Image unavailable</span>
        </div>
      </div>
    );
  }

  // Show image with loading state
  return (
    <div className={`relative ${height} bg-gradient-to-br from-primary/20 to-primary/5 overflow-hidden ${className}`}>
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-pulse">
            <DoshiMascot variant="static" size="medium" alt="Loading..." />
          </div>
        </div>
      )}
      <img
        src={imageUrl}
        alt={title}
        className={`w-full h-full object-cover transition-all duration-300 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setImageLoaded(true)}
        onError={(e) => {
          console.warn(`Failed to load image: ${imageUrl}`);
          setImageError(true);
        }}
        loading={priority ? 'eager' : 'lazy'}
      />
      {/* Gradient overlay for text readability */}
      {imageLoaded && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      )}
    </div>
  );
}
