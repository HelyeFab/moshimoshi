// Hook for Review Engine functionality

import { useEffect, useRef, useCallback } from 'react';
import { ReviewEngineConfig } from '@/lib/review-engine/core/config.types';

interface UseReviewEngineOptions extends ReviewEngineConfig {
  soundEffects?: {
    correct?: string;
    incorrect?: string;
    complete?: string;
    hint?: string;
    audio?: string;
  };
  hapticFeedback?: boolean;
}

export function useReviewEngine(config?: UseReviewEngineOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const soundEffectsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  
  // Preload sound effects
  useEffect(() => {
    if (config?.soundEffects) {
      Object.entries(config.soundEffects).forEach(([key, url]) => {
        const audio = new Audio(url);
        audio.preload = 'auto';
        soundEffectsRef.current.set(key, audio);
      });
    }
    
    return () => {
      // Cleanup audio elements
      soundEffectsRef.current.forEach(audio => {
        audio.pause();
        audio.src = '';
      });
      soundEffectsRef.current.clear();
    };
  }, [config?.soundEffects]);
  
  // Play sound effect
  const playSound = useCallback((type: string) => {
    const audio = soundEffectsRef.current.get(type);
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(error => {
        console.error(`Failed to play sound effect: ${type}`, error);
      });
    }
  }, []);
  
  // Vibrate device (for mobile)
  const vibrate = useCallback((pattern: number | number[]) => {
    if (config?.hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, [config?.hapticFeedback]);
  
  // Play audio content (for listening mode)
  const playAudio = useCallback(async (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      const audio = new Audio(url);
      audioRef.current = audio;
      
      audio.addEventListener('ended', () => {
        resolve();
      });
      
      audio.addEventListener('error', (error) => {
        reject(error);
      });
      
      audio.play().catch(reject);
    });
  }, []);
  
  // Stop audio playback
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);
  
  // Check if offline
  const isOffline = useCallback(() => {
    return !navigator.onLine;
  }, []);
  
  return {
    playSound,
    vibrate,
    playAudio,
    stopAudio,
    isOffline
  };
}