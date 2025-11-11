'use client';

import { useEffect, useState } from 'react';

export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      // Get scroll position
      const scrollTop = window.scrollY;

      // Get total scrollable height (document height - viewport height)
      const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;

      // Calculate progress percentage
      const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;

      setProgress(scrollPercent);
    };

    // Update on mount
    updateProgress();

    // Add scroll listener
    window.addEventListener('scroll', updateProgress, { passive: true });

    // Cleanup
    return () => window.removeEventListener('scroll', updateProgress);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-gray-200 dark:bg-gray-800">
      <div
        className="h-full bg-gradient-to-r from-primary-500 via-japanese-sakura to-japanese-zen transition-all duration-150 ease-out"
        style={{ width: `${progress}%` }}
      >
        <div className="h-full w-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
      </div>
    </div>
  );
}
