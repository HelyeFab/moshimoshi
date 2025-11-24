'use client';

import { useState } from 'react';
import { useTheme } from '@/lib/theme/ThemeContext';

interface NewsArticleFallbackImageProps {
  imageUrl?: string;
  title: string;
  source: string;
  category?: string;
  difficulty?: string;
  className?: string;
  height?: string;
  priority?: boolean;
}

/**
 * Professional news article image with source-based fallback
 * Shows source icon with category-colored gradient when image fails
 */
export default function NewsArticleFallbackImage({
  imageUrl,
  title,
  source,
  category = 'news',
  difficulty = 'N3',
  className = '',
  height = 'h-48',
  priority = false
}: NewsArticleFallbackImageProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const { resolvedTheme } = useTheme();

  // Source icons mapping
  const getSourceIcon = (source: string): string => {
    const icons: Record<string, string> = {
      'NHK Easy': '📺',
      'Todaii': '📚',
      'Watanoc': '🌸',
      'Mainichi News': '📰',
      'Mainichi Shogakusei': '🎒',
      'Mainichi Elementary': '🎒'
    };
    return icons[source] || '📄';
  };

  // Category-based colors (using inline styles for reliability)
  const getCategoryColor = (category: string): { bg: string; border: string } => {
    const colors: Record<string, { bg: string; border: string }> = {
      'news': { bg: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(79, 70, 229, 0.15))', border: '#93c5fd' },
      'culture': { bg: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(236, 72, 153, 0.15))', border: '#d8b4fe' },
      'sports': { bg: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(16, 185, 129, 0.15))', border: '#86efac' },
      'technology': { bg: 'linear-gradient(135deg, rgba(249, 115, 22, 0.15), rgba(239, 68, 68, 0.15))', border: '#fdba74' },
      'science': { bg: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(59, 130, 246, 0.15))', border: '#67e8f9' },
      'politics': { bg: 'linear-gradient(135deg, rgba(107, 114, 128, 0.15), rgba(71, 85, 105, 0.15))', border: '#d1d5db' },
      'economy': { bg: 'linear-gradient(135deg, rgba(234, 179, 8, 0.15), rgba(245, 158, 11, 0.15))', border: '#fde047' },
      'society': { bg: 'linear-gradient(135deg, rgba(20, 184, 166, 0.15), rgba(6, 182, 212, 0.15))', border: '#5eead4' },
      'international': { bg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15))', border: '#c4b5fd' },
      'entertainment': { bg: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15), rgba(244, 63, 94, 0.15))', border: '#fbcfe8' },
      'weather': { bg: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15), rgba(59, 130, 246, 0.15))', border: '#7dd3fc' },
      'health': { bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(34, 197, 94, 0.15))', border: '#6ee7b7' }
    };
    return colors[category.toLowerCase()] || colors['news'];
  };

  // No image URL or image failed - show simple fallback with source icon using theme primary color
  if (!imageUrl || imageError) {
    const icon = getSourceIcon(source);
    const bgGradient = resolvedTheme === 'dark'
      ? 'linear-gradient(135deg, rgb(var(--palette-primary-950) / 0.4), rgb(var(--palette-primary-900) / 0.3))'
      : 'linear-gradient(135deg, rgb(var(--palette-primary-50)), rgb(var(--palette-primary-100)))';

    return (
      <div
        className={`relative ${height} overflow-hidden ${className}`}
        style={{
          background: bgGradient,
          borderRadius: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div style={{
          fontSize: '2.5rem',
          opacity: 0.3
        }}>
          {icon}
        </div>
      </div>
    );
  }

  // Try to load the actual image
  const bgGradient = resolvedTheme === 'dark'
    ? 'linear-gradient(135deg, rgb(var(--palette-primary-950) / 0.4), rgb(var(--palette-primary-900) / 0.3))'
    : 'linear-gradient(135deg, rgb(var(--palette-primary-50)), rgb(var(--palette-primary-100)))';

  return (
    <div className={`relative ${height} overflow-hidden ${className}`} style={{ background: bgGradient }}>
      {/* Loading state */}
      {!imageLoaded && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            fontSize: '2.5rem',
            opacity: 0.3,
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
          }}>
            {getSourceIcon(source)}
          </div>
        </div>
      )}

      {/* Actual image */}
      <img
        src={imageUrl}
        alt={title}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transition: 'opacity 0.3s',
          opacity: imageLoaded ? 1 : 0
        }}
        onLoad={() => setImageLoaded(true)}
        onError={() => {
          console.warn(`Failed to load news image: ${imageUrl}`);
          setImageError(true);
        }}
        loading={priority ? 'eager' : 'lazy'}
      />

      {/* Gradient overlay for text readability */}
      {imageLoaded && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)',
          pointerEvents: 'none'
        }} />
      )}
    </div>
  );
}
