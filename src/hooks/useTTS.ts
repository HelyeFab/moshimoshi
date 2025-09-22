import { useState, useRef, useCallback, useEffect } from 'react';
import { TTSOptions, TTSResult, TTSError } from '@/lib/tts/types';

interface UseTTSOptions {
  autoPlay?: boolean;
  preloadOnMount?: string[];
  cacheFirst?: boolean;
  onPlay?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
}

interface UseTTSReturn {
  // State
  playing: boolean;
  loading: boolean;
  error: Error | null;
  currentText: string | null;
  
  // Methods
  play: (text: string, options?: TTSOptions) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  preload: (texts: string[], options?: TTSOptions) => Promise<void>;
  queue: (items: Array<{ text: string; delay?: number }>) => void;
  clearQueue: () => void;
  
  // Audio element ref
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

export function useTTS(options: UseTTSOptions = {}): UseTTSReturn {
  const {
    autoPlay = false,
    preloadOnMount = [],
    cacheFirst = true,
    onPlay,
    onEnd,
    onError,
  } = options;

  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentText, setCurrentText] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const queueRef = useRef<Array<{ text: string; delay?: number }>>([]);
  const isProcessingQueue = useRef(false);

  // Preload on mount
  useEffect(() => {
    if (preloadOnMount.length > 0) {
      preload(preloadOnMount);
    }

    // Cleanup on unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  const play = useCallback(async (text: string, ttsOptions?: TTSOptions) => {
    try {
      setLoading(true);
      setError(null);
      setCurrentText(text);

      // Stop current audio if playing (but don't remove it)
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      // Call TTS API
      const response = await fetch('/api/tts/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          language: ttsOptions?.voice === 'ja-JP' ? 'ja' : 'en',
          voice: ttsOptions?.voice,
          speed: ttsOptions?.rate || 1.0,
          pitch: ttsOptions?.pitch || 0
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'TTS synthesis failed');
      }

      const data = await response.json();
      const result: TTSResult = data.data;

      // Log the provider and cache status
      console.log(`TTS Provider: ${result.provider}, Cached: ${result.cached}, Text: "${text.substring(0, 30)}..."`);

      // Create audio element only if it doesn't exist
      if (!audioRef.current) {
        audioRef.current = new Audio();

        // Set up permanent event handlers
        audioRef.current.onplay = () => {
          setPlaying(true);
          onPlay?.();
        };

        audioRef.current.onended = () => {
          setPlaying(false);
          setCurrentText(null);
          onEnd?.();
          processQueue();
        };

        audioRef.current.onerror = (e) => {
          const error = new Error('Audio playback failed');
          console.error('Audio playback error:', e);
          setError(error);
          setPlaying(false);
          setCurrentText(null);
          onError?.(error);
        };
      }

      const audio = audioRef.current;

      // Load and play audio
      console.log('Setting audio source:', result.audioUrl);
      audio.src = result.audioUrl;
      setLoading(false);

      // Wait for audio to be ready before playing
      await new Promise((resolve, reject) => {
        audio.oncanplay = resolve;
        audio.onerror = reject;
        setTimeout(reject, 5000); // 5 second timeout
      });

      // Play the audio
      try {
        await audio.play();
        console.log('Audio playing successfully');
      } catch (playError: any) {
        // Ignore AbortError if it's because we're switching to a new audio
        if (playError.name !== 'AbortError') {
          console.error('Failed to play audio:', playError);
          throw playError;
        }
      }
    } catch (err: any) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setLoading(false);
      setCurrentText(null);
      onError?.(error);
      throw error;
    }
  }, [autoPlay, onPlay, onEnd, onError]);

  const pause = useCallback(() => {
    if (audioRef.current && playing) {
      audioRef.current.pause();
      setPlaying(false);
    }
  }, [playing]);

  const resume = useCallback(() => {
    if (audioRef.current && !playing) {
      audioRef.current.play();
      setPlaying(true);
    }
  }, [playing]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
      setCurrentText(null);
    }
  }, []);

  const preload = useCallback(async (texts: string[], ttsOptions?: TTSOptions) => {
    try {
      const response = await fetch('/api/tts/preload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          texts, 
          options: ttsOptions,
          priority: 'normal',
        }),
      });

      if (!response.ok) {
        throw new Error('Preload failed');
      }
    } catch (err) {
      console.error('Preload error:', err);
    }
  }, []);

  const queue = useCallback((items: Array<{ text: string; delay?: number }>) => {
    queueRef.current = [...queueRef.current, ...items];
    if (!isProcessingQueue.current && !playing) {
      processQueue();
    }
  }, [playing]);

  const clearQueue = useCallback(() => {
    queueRef.current = [];
    isProcessingQueue.current = false;
  }, []);

  const processQueue = useCallback(async () => {
    if (queueRef.current.length === 0 || isProcessingQueue.current) {
      return;
    }

    isProcessingQueue.current = true;
    const item = queueRef.current.shift();
    
    if (item) {
      if (item.delay) {
        await new Promise(resolve => setTimeout(resolve, item.delay));
      }
      
      try {
        await play(item.text);
      } catch (error) {
        console.error('Queue processing error:', error);
        // Continue with next item even if current one fails
        isProcessingQueue.current = false;
        processQueue();
      }
    } else {
      isProcessingQueue.current = false;
    }
  }, [play]);

  return {
    // State
    playing,
    loading,
    error,
    currentText,
    
    // Methods
    play,
    pause,
    resume,
    stop,
    preload,
    queue,
    clearQueue,
    
    // Audio element ref
    audioRef,
  };
}