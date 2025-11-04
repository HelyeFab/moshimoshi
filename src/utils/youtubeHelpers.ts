/**
 * Utility functions for YouTube player operations
 * Copied from moshi-player
 */

/**
 * Extracts YouTube video ID from various URL formats
 * Supports: youtube.com/watch?v=, youtu.be/, youtube.com/embed/,
 *           youtube.com/v/, m.youtube.com, shorts, and direct video IDs
 */
export function extractVideoId(url: string): string | null {
  // If input is already a valid video ID, return it
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) {
    return url.trim();
  }

  // Comprehensive regex patterns for various YouTube URL formats
  const patterns = [
    // Standard watch URLs
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    // Mobile URLs
    /(?:https?:\/\/)?(?:m\.)?youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    // Short URLs
    /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
    // Embed URLs
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    // Old style URLs
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    // YouTube Music URLs
    /(?:https?:\/\/)?music\.youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    // Gaming URLs
    /(?:https?:\/\/)?gaming\.youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    // YouTube Shorts
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    // Direct video ID (fallback)
    /^([a-zA-Z0-9_-]{11})$/
  ];

  const trimmedUrl = url.trim();

  for (const pattern of patterns) {
    const match = trimmedUrl.match(pattern);
    if (match && match[1]) {
      // Validate that the extracted ID is exactly 11 characters
      const videoId = match[1];
      if (videoId.length === 11) {
        return videoId;
      }
    }
  }

  return null;
}

/**
 * Validates YouTube video ID format
 */
export function isValidVideoId(videoId: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}

/**
 * Formats seconds to MM:SS or HH:MM:SS format
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Converts MM:SS or HH:MM:SS format to seconds
 */
export function parseTime(timeString: string): number {
  const parts = timeString.split(':').map(Number);

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  } else if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }

  return 0;
}

/**
 * Gets YouTube thumbnail URL for a video ID
 */
export function getThumbnailUrl(
  videoId: string,
  quality: 'default' | 'medium' | 'high' | 'standard' | 'maxres' = 'high'
): string {
  return `https://img.youtube.com/vi/${videoId}/${quality}default.jpg`;
}

/**
 * Generates YouTube embed URL with parameters
 */
export function generateEmbedUrl(videoId: string, params: Record<string, any> = {}): string {
  const baseUrl = `https://www.youtube.com/embed/${videoId}`;
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  });

  return searchParams.toString() ? `${baseUrl}?${searchParams.toString()}` : baseUrl;
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  };
}

/**
 * Checks if the device supports fullscreen API
 */
export function supportsFullscreen(): boolean {
  return !!(
    document.fullscreenEnabled ||
    (document as any).webkitFullscreenEnabled ||
    (document as any).mozFullScreenEnabled ||
    (document as any).msFullscreenEnabled
  );
}

/**
 * Requests fullscreen on an element
 */
export function requestFullscreen(element: HTMLElement): void {
  if (element.requestFullscreen) {
    element.requestFullscreen();
  } else if ((element as any).webkitRequestFullscreen) {
    (element as any).webkitRequestFullscreen();
  } else if ((element as any).mozRequestFullScreen) {
    (element as any).mozRequestFullScreen();
  } else if ((element as any).msRequestFullscreen) {
    (element as any).msRequestFullscreen();
  }
}

/**
 * Exits fullscreen mode
 */
export function exitFullscreen(): void {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if ((document as any).webkitExitFullscreen) {
    (document as any).webkitExitFullscreen();
  } else if ((document as any).mozCancelFullScreen) {
    (document as any).mozCancelFullScreen();
  } else if ((document as any).msExitFullscreen) {
    (document as any).msExitFullscreen();
  }
}

/**
 * Checks if currently in fullscreen mode
 */
export function isFullscreen(): boolean {
  return !!(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement
  );
}

/**
 * Gets video quality display name
 */
export function getQualityDisplayName(quality: string): string {
  const qualityMap: Record<string, string> = {
    'small': '240p',
    'medium': '360p',
    'large': '480p',
    'hd720': '720p',
    'hd1080': '1080p',
    'highres': '1440p+',
    'auto': 'Auto'
  };

  return qualityMap[quality] || quality;
}

/**
 * Loads YouTube IFrame API script
 */
export function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if ((window as any).YT && (window as any).YT.Player) {
      resolve();
      return;
    }

    const existingScript = document.getElementById('youtube-api');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      return;
    }

    const script = document.createElement('script');
    script.id = 'youtube-api';
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;

    (window as any).onYouTubeIframeAPIReady = () => {
      resolve();
    };

    document.head.appendChild(script);
  });
}
