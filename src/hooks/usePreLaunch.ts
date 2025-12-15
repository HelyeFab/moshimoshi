'use client';

import { useState, useEffect } from 'react';
import { LAUNCH_DATE } from '@/lib/prelaunch/config';

// Check if lock is disabled via env var (client-side)
const isLockDisabled = process.env.NEXT_PUBLIC_PRELAUNCH_LOCK_ENABLED === 'false';

/**
 * Hook to check if the app is in pre-launch mode
 * Updates every minute to handle the transition at launch time
 *
 * Lock can be disabled by setting NEXT_PUBLIC_PRELAUNCH_LOCK_ENABLED=false
 * Launch date is configured via NEXT_PUBLIC_LAUNCH_DATE env var
 */
export function usePreLaunch() {
  const [isPreLaunch, setIsPreLaunch] = useState(!isLockDisabled);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // If lock is disabled, always return false
    if (isLockDisabled) {
      setIsPreLaunch(false);
      return;
    }

    const checkLaunchStatus = () => {
      const now = new Date();
      setIsPreLaunch(now < LAUNCH_DATE);
    };

    // Initial check
    checkLaunchStatus();

    // Check every minute (in case user is on page during launch)
    const interval = setInterval(checkLaunchStatus, 60000);

    return () => clearInterval(interval);
  }, []);

  return {
    isPreLaunch: mounted ? isPreLaunch : !isLockDisabled, // Default based on lock status
    launchDate: LAUNCH_DATE,
    mounted,
    isLockDisabled,
  };
}
