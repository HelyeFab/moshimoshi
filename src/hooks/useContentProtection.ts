'use client'

import { useEffect } from 'react'
import { contentProtection } from '@/utils/contentProtection'

interface UseContentProtectionOptions {
  enabled?: boolean
  excludeSelectors?: string[]
  protectSelectors?: string[]
  allowDevelopment?: boolean
}

/**
 * Hook to enable content protection on a component or page
 * This implements SEO-safe content protection measures
 */
export function useContentProtection(options: UseContentProtectionOptions = {}) {
  const {
    enabled = true,
    excludeSelectors = [],
    protectSelectors = [],
    allowDevelopment = false,
  } = options

  useEffect(() => {
    // Skip in development if not explicitly allowed
    if (process.env.NODE_ENV === 'development' && !allowDevelopment) {
      console.log('Content protection skipped in development mode');
      return;
    }

    // Skip if disabled
    if (!enabled) return;

    // Enable protection
    contentProtection.enable();

    // Exclude specific elements (like forms)
    excludeSelectors.forEach(selector => {
      contentProtection.excludeElement(selector);
    });

    // Add extra protection to specific elements
    protectSelectors.forEach(selector => {
      contentProtection.enableForElement(selector);
    });

    // Cleanup (though event listeners persist)
    return () => {
      // Optionally disable on unmount
      // contentProtection.disable();
    };
  }, [enabled, excludeSelectors, protectSelectors, allowDevelopment]);

  return {
    isProtected: contentProtection.isEnabled(),
    enable: () => contentProtection.enable(),
    disable: () => contentProtection.disable(),
  };
}