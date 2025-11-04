import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useToast } from '@/components/ui/Toast/ToastContext';

interface PracticeSession {
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  thumbnailUrl?: string;
  channelName?: string;
  duration?: number;
  metadata?: any;
  startTime: number;
  lastSaveTime: number;
  accumulatedTime: number;
  hasSentInitialPractice: boolean;
}

interface UseYouTubePracticeTrackingProps {
  videoId: string | null;
  videoUrl: string | null;
  videoTitle: string | null;
  thumbnailUrl?: string;
  channelName?: string;
  duration?: number;
  metadata?: any;
  isPlaying: boolean;
  currentTime: number;
}

// Constants
const INITIAL_PRACTICE_THRESHOLD = 30; // 30 seconds to count as practice
const PERIODIC_SAVE_INTERVAL = 300; // Save every 5 minutes
const MIN_SAVE_INTERVAL = 10; // Don't save more often than every 10 seconds

export function useYouTubePracticeTracking({
  videoId,
  videoUrl,
  videoTitle,
  thumbnailUrl,
  channelName,
  duration,
  metadata,
  isPlaying,
  currentTime,
}: UseYouTubePracticeTrackingProps) {
  const { user, isGuest } = useAuth();
  const { showToast } = useToast();
  const [session, setSession] = useState<PracticeSession | null>(null);
  const sessionRef = useRef<PracticeSession | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPlayTimeRef = useRef<number>(0);

  // Track practice time to the API
  const trackPractice = useCallback(async (practiceTime: number) => {
    if (!session || !user || isGuest) return;

    try {
      const response = await fetch('/api/practice/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: session.videoId,
          videoUrl: session.videoUrl,
          videoTitle: session.videoTitle,
          thumbnailUrl: session.thumbnailUrl,
          channelName: session.channelName,
          duration: session.duration,
          practiceTime: Math.round(practiceTime),
          metadata: session.metadata,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to track practice');
      }

      console.log(`[Practice Tracking] Saved ${Math.round(practiceTime)}s of practice for video ${session.videoId}`);

      // Update session to reflect that we've sent the initial practice
      if (practiceTime >= INITIAL_PRACTICE_THRESHOLD && !session.hasSentInitialPractice) {
        const updatedSession = { ...session, hasSentInitialPractice: true, lastSaveTime: Date.now() };
        setSession(updatedSession);
        sessionRef.current = updatedSession;
      } else {
        const updatedSession = { ...session, lastSaveTime: Date.now() };
        setSession(updatedSession);
        sessionRef.current = updatedSession;
      }
    } catch (error) {
      console.error('[Practice Tracking] Error tracking practice:', error);
    }
  }, [session, user, isGuest]);

  // Initialize session when video changes
  useEffect(() => {
    if (!videoId || !videoUrl || !videoTitle || !user || isGuest) {
      setSession(null);
      sessionRef.current = null;
      return;
    }

    // Create new session
    const newSession: PracticeSession = {
      videoId,
      videoUrl,
      videoTitle,
      thumbnailUrl,
      channelName,
      duration,
      metadata,
      startTime: Date.now(),
      lastSaveTime: 0,
      accumulatedTime: 0,
      hasSentInitialPractice: false,
    };

    setSession(newSession);
    sessionRef.current = newSession;
    lastPlayTimeRef.current = currentTime;

    console.log(`[Practice Tracking] Started new session for video ${videoId}`);

    // Cleanup function
    return () => {
      // Save any remaining practice time when component unmounts
      if (sessionRef.current && sessionRef.current.accumulatedTime > 0) {
        const finalPracticeTime = sessionRef.current.accumulatedTime;
        if (finalPracticeTime >= MIN_SAVE_INTERVAL) {
          console.log(`[Practice Tracking] Saving final practice time: ${finalPracticeTime}s`);
          // Use beacon API for reliable cleanup save
          const data = {
            videoId: sessionRef.current.videoId,
            videoUrl: sessionRef.current.videoUrl,
            videoTitle: sessionRef.current.videoTitle,
            thumbnailUrl: sessionRef.current.thumbnailUrl,
            channelName: sessionRef.current.channelName,
            duration: sessionRef.current.duration,
            practiceTime: Math.round(finalPracticeTime),
            metadata: sessionRef.current.metadata,
          };

          // Try to use beacon API if available
          if (navigator.sendBeacon) {
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            navigator.sendBeacon('/api/practice/track', blob);
          } else {
            // Fallback to regular fetch
            fetch('/api/practice/track', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
              keepalive: true, // Helps ensure the request completes
            }).catch(console.error);
          }
        }
      }

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [videoId, videoUrl, videoTitle, thumbnailUrl, channelName, duration, metadata, user, isGuest]);

  // Track accumulated time when playing
  useEffect(() => {
    if (!session || !isPlaying) {
      lastPlayTimeRef.current = currentTime;
      return;
    }

    // Calculate time difference
    const timeDiff = Math.abs(currentTime - lastPlayTimeRef.current);

    // Only accumulate reasonable time differences (less than 5 seconds)
    // This prevents large jumps from seeking
    if (timeDiff > 0 && timeDiff < 5) {
      const updatedSession = {
        ...session,
        accumulatedTime: session.accumulatedTime + timeDiff,
      };
      setSession(updatedSession);
      sessionRef.current = updatedSession;

      // Check if we should save
      const shouldSaveInitial =
        !session.hasSentInitialPractice &&
        updatedSession.accumulatedTime >= INITIAL_PRACTICE_THRESHOLD;

      const timeSinceLastSave = Date.now() - session.lastSaveTime;
      const shouldSavePeriodic =
        session.hasSentInitialPractice &&
        updatedSession.accumulatedTime >= PERIODIC_SAVE_INTERVAL &&
        timeSinceLastSave >= MIN_SAVE_INTERVAL * 1000;

      if (shouldSaveInitial) {
        console.log(`[Practice Tracking] Reached ${INITIAL_PRACTICE_THRESHOLD}s threshold, saving initial practice`);
        trackPractice(updatedSession.accumulatedTime);
      } else if (shouldSavePeriodic) {
        console.log(`[Practice Tracking] Periodic save after ${PERIODIC_SAVE_INTERVAL}s`);
        trackPractice(updatedSession.accumulatedTime);
      }
    }

    lastPlayTimeRef.current = currentTime;
  }, [currentTime, isPlaying, session, trackPractice]);

  // Handle page unload
  useEffect(() => {
    const handleUnload = (e: BeforeUnloadEvent) => {
      if (sessionRef.current && sessionRef.current.accumulatedTime >= MIN_SAVE_INTERVAL) {
        // Try to save practice time before page unloads
        const data = {
          videoId: sessionRef.current.videoId,
          videoUrl: sessionRef.current.videoUrl,
          videoTitle: sessionRef.current.videoTitle,
          thumbnailUrl: sessionRef.current.thumbnailUrl,
          channelName: sessionRef.current.channelName,
          duration: sessionRef.current.duration,
          practiceTime: Math.round(sessionRef.current.accumulatedTime),
          metadata: sessionRef.current.metadata,
        };

        if (navigator.sendBeacon) {
          const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
          navigator.sendBeacon('/api/practice/track', blob);
        }
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, []);

  return {
    practiceTime: session?.accumulatedTime || 0,
    hasPracticed: session?.hasSentInitialPractice || false,
  };
}