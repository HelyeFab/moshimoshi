'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { ShadowingSession, TranscriptLine } from '@/types/youtubeShadowing';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, Repeat, Settings, 
  ChevronLeft, ChevronRight, Video, AudioLines, ChevronUp, ChevronDown, RotateCcw, Sparkles 
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { useYouTubePracticeTracking } from '@/hooks/useYouTubePracticeTracking';
// TODO: Import or create AIExplanationTrigger
// import { AIExplanationTrigger } from '@/components/AIExplanation';
import { generateFuriganaWithCache } from '@/utils/furigana';
import { motion, AnimatePresence } from 'framer-motion';
import { GrammarHighlightedText, GrammarLegend } from '@/components/reading/GrammarHighlightedText';
import {
  PrecisionTimeManager, TimeSegment, ABRepeatConfig
} from '@/utils/precisionTimeManager';
import { cn } from '@/lib/utils';
import FloatingNavbar from './FloatingNavbar';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface EnhancedShadowingPlayerProps {
  session: ShadowingSession;
  onLineChange: (index: number) => void;
  onPlayerReady?: (seekFn: (time: number) => void, playPauseFn?: () => void) => void;  // Expose seek and play/pause functions
  onTimeUpdate?: (time: number) => void;  // Report current time
  onPlayStateChange?: (isPlaying: boolean) => void;  // Report play state changes
  showVideo?: boolean;
  showFurigana?: boolean;
  onToggleFurigana?: () => void;
  showGrammar?: boolean;
  onToggleGrammar?: () => void;
  grammarMode?: 'none' | 'all' | 'content' | 'grammar';
  onGrammarModeChange?: (mode: 'none' | 'all' | 'content' | 'grammar') => void;
  formattedAvailable?: boolean;
  useEnhancedTranscript?: boolean;
  onToggleTranscriptSource?: (useEnhanced: boolean) => void;
  className?: string;
  canRequestAiEnhancement?: boolean;
  onRequestAiEnhancement?: () => void | Promise<void>;
  aiEnhancementStatus?: 'idle' | 'running' | 'completed' | 'error';
  aiEnhancementError?: string | null;
}

export default function EnhancedShadowingPlayer({
  session,
  onLineChange,
  onPlayerReady,
  onTimeUpdate,
  onPlayStateChange,
  showVideo = true,
  showFurigana = true,
  onToggleFurigana,
  showGrammar = false,
  onToggleGrammar,
  grammarMode = 'content',
  onGrammarModeChange,
  formattedAvailable = false,
  useEnhancedTranscript = true,
  onToggleTranscriptSource,
  className,
  canRequestAiEnhancement = false,
  onRequestAiEnhancement,
  aiEnhancementStatus = 'idle',
  aiEnhancementError
}: EnhancedShadowingPlayerProps) {
  const { user } = useAuth();
  const { showToast } = useToast();

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [repeatCount, setRepeatCount] = useState(1); // Changed default from 3 to 1 to avoid conflicts
  const [pauseBetweenRepeats, setPauseBetweenRepeats] = useState(1500);
  const [currentRepeat, setCurrentRepeat] = useState(0);
  const [activeRepeatNumber, setActiveRepeatNumber] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [isYouTubeMode, setIsYouTubeMode] = useState(false);
  const [isYouTubeReady, setIsYouTubeReady] = useState(false);
  const [displayMode, setDisplayMode] = useState<'video' | 'transcript'>('video');
  const [isLocalVideo, setIsLocalVideo] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [currentLineFurigana, setCurrentLineFurigana] = useState<string>('');
  const [isPausingForRepeat, setIsPausingForRepeat] = useState(false);
  const [isInRepeatMode, setIsInRepeatMode] = useState(false);
  const [isHandlingRepeatEnd, setIsHandlingRepeatEnd] = useState(false);
  const [showGrammarLegend, setShowGrammarLegend] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  
  // Precision Time Management
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const [userIsScrolling, setUserIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Store onLineChange in ref to prevent re-subscriptions while keeping latest reference
  const onLineChangeRef = useRef(onLineChange);
  useEffect(() => {
    onLineChangeRef.current = onLineChange;
  }, [onLineChange]);

  // Store onTimeUpdate in ref to prevent re-subscriptions while keeping latest reference
  const onTimeUpdateRef = useRef(onTimeUpdate);
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  // Track previous time to avoid unnecessary updates
  const prevTimeRef = useRef(0);

  // Auto-Repeat State
  const [abRepeat, setAbRepeat] = useState<ABRepeatConfig>({
    startTime: 0,
    endTime: 0,
    currentRepeat: 0,
    totalRepeats: 3,
    pauseDuration: 1500,
    isActive: false
  });
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  
  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const youtubePlayerRef = useRef<any>(null);
  const repeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lineEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const repeatMonitorRef = useRef<NodeJS.Timeout | null>(null);
  const currentRepeatRef = useRef<number>(0);
  const repeatCountRef = useRef<number>(repeatCount);
  const actualPlayingLineIndexRef = useRef<number>(session.currentLineIndex);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  
  // Precision Time Manager
  const timeManagerRef = useRef<PrecisionTimeManager>(new PrecisionTimeManager());

  // Universal seek function that works for all player types
  const seekToTime = useCallback((time: number) => {
    if (isYouTubeMode && youtubePlayerRef.current) {
      youtubePlayerRef.current.seekTo(time, true);
    } else if (localVideoRef.current) {
      localVideoRef.current.currentTime = time;
    } else if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, [isYouTubeMode]);

  // Use a ref to store the play/pause function
  const handlePlayPauseRef = useRef<() => void>();

  // Expose seek and play/pause functions to parent via callback
  useEffect(() => {
    if (onPlayerReady) {
      // Create a wrapper function that calls the ref
      const playPauseWrapper = () => {
        if (handlePlayPauseRef.current) {
          handlePlayPauseRef.current();
        }
      };
      onPlayerReady(seekToTime, playPauseWrapper);
    }
  }, [onPlayerReady, seekToTime]);

  // Determine which transcript to use - ALWAYS prefer formatted when available
  // TypeScript doesn't know about formattedTranscript in videoMetadata, so we use type assertion
  const metadata = session.videoMetadata as any;
  const hasFormattedTranscript = metadata?.formattedTranscript &&
    Array.isArray(metadata.formattedTranscript) &&
    metadata.formattedTranscript.length > 0;

  const canUseFormattedTranscript = formattedAvailable && hasFormattedTranscript;
  const useFormattedTranscript = canUseFormattedTranscript && useEnhancedTranscript;
  
  const activeTranscript = (useFormattedTranscript && hasFormattedTranscript) 
    ? metadata.formattedTranscript 
    : session.transcript;
  const currentLine = activeTranscript[session.currentLineIndex];
  
  // Convert transcript to TimeSegments for PrecisionTimeManager
  const segments: TimeSegment[] = useMemo(() => 
    activeTranscript?.map((line: TranscriptLine) => ({
      id: line.id,
      startTime: line.startTime,
      endTime: line.endTime,
      text: line.text
    })) || [], [activeTranscript]
  );

  // Sync currentRepeat state with ref to avoid closure issues
  useEffect(() => {
    currentRepeatRef.current = currentRepeat;
  }, [currentRepeat]);
  
  // Keep latest repeat count available for async callbacks
  useEffect(() => {
    repeatCountRef.current = repeatCount;
  }, [repeatCount]);

const stopRepeatsEarly = useCallback(() => {
  if (repeatTimeoutRef.current) {
    clearTimeout(repeatTimeoutRef.current);
    repeatTimeoutRef.current = null;
  }
  if (repeatMonitorRef.current) {
    clearInterval(repeatMonitorRef.current);
    repeatMonitorRef.current = null;
  }
  if (lineEndTimeoutRef.current) {
    clearTimeout(lineEndTimeoutRef.current);
    lineEndTimeoutRef.current = null;
  }
  currentRepeatRef.current = 0;
  setCurrentRepeat(0);
  setActiveRepeatNumber(1);
  setIsPausingForRepeat(false);
  setIsInRepeatMode(false);
  if (youtubePlayerRef.current && typeof youtubePlayerRef.current.pauseVideo === 'function') {
    youtubePlayerRef.current.pauseVideo();
  }
  if (localVideoRef.current) {
    localVideoRef.current.pause();
  }
  if (audioRef.current) {
    audioRef.current.pause();
  }
  setIsPlaying(false);
  setAbRepeat(prev => ({
    ...prev,
    currentRepeat: 0,
    isActive: false
  }));
}, []);

  // Helper function to clean romaji from text
  const cleanRomaji = (text: string): string => {
    let cleaned = text;
    
    // Remove standalone romaji words (only Latin characters)
    cleaned = cleaned.replace(/\b[a-zA-Z]+\b/g, (match) => {
      // Keep uppercase abbreviations like "OK", "AI", etc.
      if (match === match.toUpperCase() && match.length <= 3) {
        return match;
      }
      // Remove lowercase romaji
      return '';
    });
    
    // Remove romaji that appears after Japanese characters
    cleaned = cleaned.replace(/([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF])\s*[a-z]+/gi, '$1');
    
    // Remove romaji at the beginning of lines
    cleaned = cleaned.replace(/^[a-z]+\s*/gmi, '');
    
    // Clean up extra spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  };

  // Generate furigana for current line
  useEffect(() => {
    const generateFurigana = async () => {
      if (!currentLine) {
        setCurrentLineFurigana('');
        return;
      }
      
      // Clean romaji from the text first
      const cleanedText = cleanRomaji(currentLine.text);
      
      if (!showFurigana) {
        setCurrentLineFurigana(cleanedText);
        return;
      }

      try {
        const withFurigana = await generateFuriganaWithCache(cleanedText);
        setCurrentLineFurigana(withFurigana);
      } catch (error) {
        setCurrentLineFurigana(cleanedText);
      }
    };

    generateFurigana();
  }, [currentLine, showFurigana]);

  // Extract video ID from YouTube URL
  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/,
      /youtube\.com\/v\/([^&\s]+)/,
      /youtube\.com\/shorts\/([^&\s]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const videoId = session.videoUrl ? extractVideoId(session.videoUrl) : null;

  // Track practice sessions
  const { practiceTime, hasPracticed } = useYouTubePracticeTracking({
    videoId,
    videoUrl: session.videoUrl,
    videoTitle: session.videoTitle || session.videoMetadata?.title || null,
    thumbnailUrl: session.videoMetadata?.thumbnailUrl,
    channelName: session.videoMetadata?.channelTitle,
    duration: duration,
    metadata: session.videoMetadata,
    isPlaying,
    currentTime,
  });

  // Determine if we're in YouTube mode or local video mode
  useEffect(() => {
    const isYT = (session.audioUrl === 'youtube-player' || !session.audioUrl) && videoId;
    const isLocal = session.videoUrl?.startsWith('blob:') || session.videoUrl?.startsWith('data:');
    
    setIsYouTubeMode(!!isYT);
    setIsLocalVideo(!!isLocal);
    
    if ((isYT || isLocal) && showVideo) {
      setDisplayMode('video');
    }
  }, [session.audioUrl, videoId, showVideo, session.videoUrl]);

  // Initialize YouTube player with PrecisionTimeManager
  useEffect(() => {
    if (!isYouTubeMode || !videoId) return;
    
    let mounted = true;
    let apiLoadTimeout: NodeJS.Timeout;
    
    const loadYouTubeAPI = () => {
      if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        
        apiLoadTimeout = setTimeout(() => {
          if (mounted && !window.YT) {
            setIsYouTubeReady(true);
          }
        }, 5000);
        
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
        
        window.onYouTubeIframeAPIReady = () => {
          clearTimeout(apiLoadTimeout);
          if (mounted) {
            initializeYouTubePlayer();
          }
        };
      } else {
        initializeYouTubePlayer();
      }
    };
    
    loadYouTubeAPI();
    
    return () => {
      mounted = false;
      clearTimeout(apiLoadTimeout);
      if (youtubePlayerRef.current) {
        try {
          youtubePlayerRef.current.destroy();
        } catch (e) {
          // Ignore cleanup errors
        }
        youtubePlayerRef.current = null;
      }
      timeManagerRef.current.destroy();
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [isYouTubeMode, videoId]);

  const initializeYouTubePlayer = useCallback(() => {
    const playerElement = document.getElementById('enhanced-youtube-player');
    if (!playerElement || youtubePlayerRef.current || !videoId) return;
    
    try {
      youtubePlayerRef.current = new window.YT.Player('enhanced-youtube-player', {
        videoId: videoId,
        height: '100%',
        width: '100%',
        playerVars: {
          controls: 1,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          origin: window.location.origin,
          cc_load_policy: 1,
          cc_lang_pref: 'ja',
          playsinline: 1,
          disablekb: 0,
          fs: 1,
          iv_load_policy: 3,
          widget_referrer: window.location.origin
        },
        events: {
          onReady: handleYouTubeReady,
          onStateChange: handleYouTubeStateChange
        }
      });
    } catch (error) {
    }
  }, [videoId]);

  const handleYouTubeReady = useCallback((event: any) => {
    setIsYouTubeReady(true);
    setDuration(event.target.getDuration());
    
    if (youtubePlayerRef.current) {
      youtubePlayerRef.current.setPlaybackRate(playbackSpeed);
      youtubePlayerRef.current.setVolume(volume * 100);
    }
    
    // Set up precision time tracking
    timeManagerRef.current.setPlayer(() => 
      youtubePlayerRef.current?.getCurrentTime() || 0
    );
  }, [playbackSpeed, volume]);

  const handleYouTubeStateChange = useCallback((event: any) => {
    if (isHandlingRepeatEnd || (repeatCountRef.current > 1)) {
      return;
    }

    const state = event.data;

    // Handle PLAYING state (1)
    if (state === window.YT.PlayerState.PLAYING) {
      setIsPlaying(true);
      if (onPlayStateChange) onPlayStateChange(true);
      timeManagerRef.current.startSync();
    }
    // Handle PAUSED state (2)
    else if (state === window.YT.PlayerState.PAUSED) {
      setIsPlaying(false);
      if (onPlayStateChange) onPlayStateChange(false);
      timeManagerRef.current.stopSync();
    }
    // Handle BUFFERING state (3) - Critical for sync accuracy
    else if (state === window.YT.PlayerState.BUFFERING) {
      // Stop time sync during buffering to prevent drift
      timeManagerRef.current.stopSync();
      console.log('[YOUTUBE] Buffering - pausing time sync');
    }
    // Handle ENDED state (0)
    else if (state === window.YT.PlayerState.ENDED) {
      setIsPlaying(false);
      if (onPlayStateChange) onPlayStateChange(false);
      timeManagerRef.current.stopSync();
    }
  }, [isHandlingRepeatEnd]);

  // Initialize audio element
  useEffect(() => {
    if (!isYouTubeMode && !isLocalVideo && session.audioUrl && session.audioUrl !== 'youtube-player' && !audioRef.current) {
      const audio = new Audio(session.audioUrl);
      audio.playbackRate = playbackSpeed;
      audio.volume = volume;
      audioRef.current = audio;

      // Set up precision time tracking for audio
      timeManagerRef.current.setPlayer(() => 
        audioRef.current?.currentTime || 0
      );

      const handlePlay = () => {
        setIsPlaying(true);
        if (onPlayStateChange) onPlayStateChange(true);
        timeManagerRef.current.startSync();
      };

      const handlePause = () => {
        setIsPlaying(false);
        if (onPlayStateChange) onPlayStateChange(false);
        timeManagerRef.current.stopSync();
      };

      const handleWaiting = () => {
        console.log('[AUDIO] Buffering/Waiting - pausing time sync');
        timeManagerRef.current.stopSync();
      };

      const handleCanPlay = () => {
        console.log('[AUDIO] Can play - resuming time sync if playing');
        if (!audio.paused) {
          timeManagerRef.current.startSync();
        }
      };

      audio.addEventListener('timeupdate', handleAudioTimeUpdate);
      audio.addEventListener('ended', handleAudioEnded);
      audio.addEventListener('play', handlePlay);
      audio.addEventListener('pause', handlePause);
      audio.addEventListener('waiting', handleWaiting);
      audio.addEventListener('canplay', handleCanPlay);

      return () => {
        audio.removeEventListener('timeupdate', handleAudioTimeUpdate);
        audio.removeEventListener('ended', handleAudioEnded);
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('waiting', handleWaiting);
        audio.removeEventListener('canplay', handleCanPlay);
        audio.pause();
      };
    }
  }, [isYouTubeMode, isLocalVideo, session.audioUrl, playbackSpeed, volume]);

  // Initialize local video element
  useEffect(() => {
    if (isLocalVideo && localVideoRef.current && session.videoUrl) {
      const video = localVideoRef.current;
      video.load();

      // Set up precision time tracking for local video
      timeManagerRef.current.setPlayer(() =>
        localVideoRef.current?.currentTime || 0
      );

      // Handle buffering/waiting states to prevent sync drift
      const handleWaiting = () => {
        console.log('[VIDEO] Buffering/Waiting - pausing time sync');
        timeManagerRef.current.stopSync();
      };

      const handleCanPlay = () => {
        console.log('[VIDEO] Can play - resuming time sync if playing');
        if (!video.paused) {
          timeManagerRef.current.startSync();
        }
      };

      const handlePlaying = () => {
        console.log('[VIDEO] Playing - starting time sync');
        timeManagerRef.current.startSync();
      };

      const handlePause = () => {
        console.log('[VIDEO] Paused - stopping time sync');
        timeManagerRef.current.stopSync();
      };

      // Add event listeners
      video.addEventListener('waiting', handleWaiting);
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('playing', handlePlaying);
      video.addEventListener('pause', handlePause);

      return () => {
        video.removeEventListener('waiting', handleWaiting);
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('playing', handlePlaying);
        video.removeEventListener('pause', handlePause);
      };
    }
  }, [isLocalVideo, session.videoUrl]);

  // Update playback speed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    } else if (youtubePlayerRef.current && youtubePlayerRef.current.setPlaybackRate) {
      youtubePlayerRef.current.setPlaybackRate(playbackSpeed);
    } else if (localVideoRef.current) {
      localVideoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    } else if (youtubePlayerRef.current && youtubePlayerRef.current.setVolume) {
      youtubePlayerRef.current.setVolume(volume * 100);
    } else if (localVideoRef.current) {
      localVideoRef.current.volume = volume;
    }
  }, [volume]);

  // Set up time tracking listener with PrecisionTimeManager
  useEffect(() => {
    if (!isYouTubeReady && !audioRef.current && !localVideoRef.current) return;
    
    let lastSegmentId: string | null = null;

    const unsubscribe = timeManagerRef.current.onTimeUpdate((time) => {
      // Only update if time changed significantly (avoid micro-updates)
      if (Math.abs(time - prevTimeRef.current) >= 0.01) {
        prevTimeRef.current = time;
        setCurrentTime(time);
        onTimeUpdateRef.current?.(time);  // Report to parent using ref
      }
      
      // Update active segment
      const activeSegment = timeManagerRef.current.findActiveSegment(segments, time);
      if (activeSegment) {
        const segmentIndex = segments.findIndex(s => s.id === activeSegment.id);
        
        if (activeSegment.id !== lastSegmentId) {
          lastSegmentId = activeSegment.id;
          setActiveSegmentId(activeSegment.id);
          setCurrentSegmentIndex(segmentIndex);

          // Always update the line change so transcript follows
          onLineChangeRef.current(segmentIndex);

          // Only auto-scroll if user isn't manually scrolling
          if (!userIsScrolling) {
            scrollToActiveSegment(activeSegment.id);
          }
        }
      }
    });
    
    return () => unsubscribe();
  }, [isYouTubeReady, segments, isInRepeatMode, isPausingForRepeat, userIsScrolling]);

  const scrollToActiveSegment = useCallback((segmentId: string) => {
    if (!transcriptContainerRef.current) return;
    
    const element = document.getElementById(`segment-${segmentId}`);
    if (element) {
      const container = transcriptContainerRef.current;
      const elementRect = element.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      const scrollTop = container.scrollTop + elementRect.top - containerRect.top - containerRect.height / 2 + elementRect.height / 2;
      
      container.scrollTo({
        top: scrollTop,
        behavior: 'smooth'
      });
    }
  }, []);

  const handleAudioTimeUpdate = () => {
    if (!audioRef.current || !currentLine || isPausingForRepeat) return;

    const currentTime = audioRef.current.currentTime;
    
    const nextLineIndex = session.currentLineIndex + 1;
    const nextLine = nextLineIndex < activeTranscript.length ? activeTranscript[nextLineIndex] : null;
    let effectiveEndTime = currentLine.endTime;
    
    if (nextLine && Math.abs(nextLine.startTime - currentLine.endTime) < 0.5) {
      effectiveEndTime = nextLine.startTime - 0.05;
    }
    
    if (currentTime >= effectiveEndTime) {
      audioRef.current.pause();
      handleLineComplete();
    }
  };

  const handleVideoTimeUpdate = () => {
    if (!localVideoRef.current || !currentLine || isPausingForRepeat) return;

    const currentTime = localVideoRef.current.currentTime;
    
    if (localVideoRef.current) {
      timeManagerRef.current.startSync();
    }
    
    const nextLineIndex = session.currentLineIndex + 1;
    const nextLine = nextLineIndex < activeTranscript.length ? activeTranscript[nextLineIndex] : null;
    let effectiveEndTime = currentLine.endTime;
    
    if (nextLine && Math.abs(nextLine.startTime - currentLine.endTime) < 0.5) {
      effectiveEndTime = nextLine.startTime - 0.05;
    }
    
    if (currentTime >= effectiveEndTime && repeatCountRef.current > 1) {
      localVideoRef.current.pause();
      handleLineComplete();
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    timeManagerRef.current.stopSync();
  };

  const handleLineComplete = () => {
    const currentRep = currentRepeatRef.current;
    const nextRepeat = currentRep + 1;
    // Use the actual playing line index, not session.currentLineIndex which might have been updated
    const currentLineIndex = actualPlayingLineIndexRef.current;
    const lineToRepeat = activeTranscript[currentLineIndex];

    timeManagerRef.current.stopSync();

    // Use the ref value which is always up-to-date with user changes
    if (nextRepeat < repeatCountRef.current) {
      setCurrentRepeat(nextRepeat);
      setActiveRepeatNumber(nextRepeat + 1);
      setIsPausingForRepeat(true);
      
      repeatTimeoutRef.current = setTimeout(() => {
        const allowedRepeats = repeatCountRef.current;
        const completedRepeats = currentRepeatRef.current;

        if (allowedRepeats <= 1 || completedRepeats >= allowedRepeats) {
          stopRepeatsEarly();
          setIsPlaying(false);
          repeatTimeoutRef.current = null;
          return;
        }

        // Use the specific line for this repeat
        if (lineToRepeat) {
          playSpecificLine(lineToRepeat, currentLineIndex);
        } else {
          playCurrentLine();
        }
        repeatTimeoutRef.current = null;
      }, pauseBetweenRepeats);
    } else {
      // Completed all repeats for this segment
      setCurrentRepeat(0);
      setActiveRepeatNumber(1);
      setIsInRepeatMode(false);
      setIsPlaying(false);

      // Player stops after completing repeats for the current segment
      // User needs to manually advance to next segment
      if (onPlayStateChange) onPlayStateChange(false);
    }
  };

  const handleAutoRepeatSegmentEnd = useCallback((segmentIndex: number) => {
    if (youtubePlayerRef.current) {
      youtubePlayerRef.current.pauseVideo();
    } else if (localVideoRef.current) {
      localVideoRef.current.pause();
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
    
    const currentRep = abRepeat.currentRepeat + 1;
    
    if (currentRep < abRepeat.totalRepeats) {
      setAbRepeat(prev => ({ ...prev, currentRepeat: currentRep }));
      
      if (repeatTimeoutRef.current) {
        clearTimeout(repeatTimeoutRef.current);
      }
      
      repeatTimeoutRef.current = setTimeout(() => {
        if (youtubePlayerRef.current && segments[segmentIndex]) {
          youtubePlayerRef.current.seekTo(segments[segmentIndex].startTime, true);
          setTimeout(() => {
            youtubePlayerRef.current?.playVideo();
          }, 100);
        } else if (localVideoRef.current && segments[segmentIndex]) {
          localVideoRef.current.currentTime = segments[segmentIndex].startTime;
          localVideoRef.current.play();
        } else if (audioRef.current && segments[segmentIndex]) {
          audioRef.current.currentTime = segments[segmentIndex].startTime;
          audioRef.current.play();
        }
      }, abRepeat.pauseDuration);
    } else {
      const nextIndex = segmentIndex + 1;
      
      if (nextIndex < segments.length) {
        setAbRepeat(prev => ({ 
          ...prev, 
          isActive: false, 
          currentRepeat: 0 
        }));
        
        if (repeatTimeoutRef.current) {
          clearTimeout(repeatTimeoutRef.current);
        }
        
        repeatTimeoutRef.current = setTimeout(() => {
          if (youtubePlayerRef.current && segments[nextIndex]) {
            youtubePlayerRef.current.seekTo(segments[nextIndex].startTime, true);
            setTimeout(() => {
              youtubePlayerRef.current?.playVideo();
            }, 100);
          } else if (localVideoRef.current && segments[nextIndex]) {
            localVideoRef.current.currentTime = segments[nextIndex].startTime;
            localVideoRef.current.play();
          } else if (audioRef.current && segments[nextIndex]) {
            audioRef.current.currentTime = segments[nextIndex].startTime;
            audioRef.current.play();
          }
        }, 500);
      } else {
        setAutoRepeatMode(false);
        setAbRepeat(prev => ({ ...prev, isActive: false, currentRepeat: 0 }));
      }
    }
  }, [abRepeat.currentRepeat, abRepeat.totalRepeats, abRepeat.pauseDuration, segments]);

  const playSpecificLine = (lineToPlay: any, lineIndex: number) => {
    if (!lineToPlay) return;

    // Track what line we're actually playing
    actualPlayingLineIndexRef.current = lineIndex;
    setIsPausingForRepeat(false);

    // Update parent component so transcript viewer follows
    if (onLineChangeRef.current) {
      onLineChangeRef.current(lineIndex);
    }

    // Update segment tracking for transcript viewer
    if (segments[lineIndex]) {
      setActiveSegmentId(segments[lineIndex].id);
      setCurrentSegmentIndex(lineIndex);
    }

    if (repeatCountRef.current > 1) {
      setIsInRepeatMode(true);
    }

    if (isYouTubeMode && youtubePlayerRef.current && isYouTubeReady) {
      youtubePlayerRef.current.seekTo(lineToPlay.startTime, true);
      youtubePlayerRef.current.playVideo();
      setIsPlaying(true);
      if (onPlayStateChange) onPlayStateChange(true);

      if (repeatCountRef.current > 1) {
        if (repeatMonitorRef.current) {
          clearInterval(repeatMonitorRef.current);
        }
        
        const checkInterval = setInterval(() => {
          if (!youtubePlayerRef.current || !isYouTubeReady || !lineToPlay) {
            clearInterval(checkInterval);
            repeatMonitorRef.current = null;
            return;
          }
          
          try {
            const currentTime = youtubePlayerRef.current.getCurrentTime();
            const nextLineIndex = lineIndex + 1;
            const nextLine = activeTranscript[nextLineIndex];
            
            let effectiveEndTime = lineToPlay.endTime;
            
            if (nextLine && Math.abs(nextLine.startTime - lineToPlay.endTime) < 0.5) {
              effectiveEndTime = nextLine.startTime - 0.05;
            }
            
            if (currentTime >= effectiveEndTime) {
              youtubePlayerRef.current.pauseVideo();
              clearInterval(checkInterval);
              repeatMonitorRef.current = null;
              handleLineComplete();
            }
          } catch (e) {
            clearInterval(checkInterval);
            repeatMonitorRef.current = null;
          }
        }, 100);
        
        repeatMonitorRef.current = checkInterval;
      }
    } else if (localVideoRef.current) {
      localVideoRef.current.currentTime = lineToPlay.startTime;
      localVideoRef.current.play();
      setIsPlaying(true);
      if (onPlayStateChange) onPlayStateChange(true);
    } else if (audioRef.current) {
      audioRef.current.currentTime = lineToPlay.startTime;
      audioRef.current.play();
      setIsPlaying(true);
      if (onPlayStateChange) onPlayStateChange(true);
    }
  };

  const playCurrentLine = () => {
    if (!currentLine) return;
    playSpecificLine(currentLine, session.currentLineIndex);
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      if (lineEndTimeoutRef.current) {
        clearTimeout(lineEndTimeoutRef.current);
        lineEndTimeoutRef.current = null;
      }

      if (isYouTubeMode && youtubePlayerRef.current) {
        youtubePlayerRef.current.pauseVideo();
      } else if (isLocalVideo && localVideoRef.current) {
        localVideoRef.current.pause();
      } else if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      if (onPlayStateChange) onPlayStateChange(false);
      timeManagerRef.current.stopSync();
    } else {
      playCurrentLine();
    }
  };

  // Store the function in the ref so it can be called from the parent
  handlePlayPauseRef.current = handlePlayPause;

  // Handle repeat count changes with Miraa-style logic
  const handleRepeatCountChange = useCallback((newCount: number) => {
    const oldCount = repeatCount;
    const currentRep = currentRepeatRef.current;

    console.log(`[RepeatCount] Changing from ${oldCount} to ${newCount}, currently on repeat ${currentRep + 1}`);

    // Always update the repeat count and ref
    setRepeatCount(newCount);
    repeatCountRef.current = newCount;

    // Update AB repeat config
    setAbRepeat(prev => ({ ...prev, totalRepeats: newCount }));

    // Handle changes during active playback or pausing
    if ((isPlaying || isPausingForRepeat) && isInRepeatMode) {
      if (newCount > oldCount) {
        // INCREASE: Continue current segment with more repeats
        console.log(`[RepeatCount] Increasing repeats - will play ${newCount - currentRep} more times`);
        // No need to stop or restart, just update the count

      } else if (newCount < oldCount) {
        // DECREASE: Check if we should advance
        if (currentRep >= newCount) {
          // Already past the new limit, advance to next segment
          console.log(`[RepeatCount] Current repeat (${currentRep + 1}) exceeds new count (${newCount}), advancing to next segment`);

          // Stop current repeat cycle
          stopRepeatsEarly();

          // Advance to next segment if not at the last one
          if (actualPlayingLineIndexRef.current < activeTranscript.length - 1) {
            const nextIndex = actualPlayingLineIndexRef.current + 1;
            const nextLine = activeTranscript[nextIndex];

            if (nextLine) {
              onLineChangeRef.current(nextIndex);
              actualPlayingLineIndexRef.current = nextIndex;

              // Reset repeat tracking for new segment
              currentRepeatRef.current = 0;
              setCurrentRepeat(0);
              setActiveRepeatNumber(1);

              // Update segment tracking
              if (segments[nextIndex]) {
                setActiveSegmentId(segments[nextIndex].id);
                setCurrentSegmentIndex(nextIndex);
                if (!userIsScrolling) {
                  scrollToActiveSegment(segments[nextIndex].id);
                }
              }

              // Start playing the next segment
              setTimeout(() => {
                playSpecificLine(nextLine, nextIndex);
              }, 100);
            }
          } else {
            // Stop playback if at last segment
            setIsPlaying(false);
            if (onPlayStateChange) onPlayStateChange(false);
          }
        } else {
          // Haven't reached new limit yet, just update the cap
          console.log(`[RepeatCount] Continuing with reduced count, will stop at repeat ${newCount}`);
        }
      }
    } else if (!isPlaying) {
      // Not currently playing, reset current repeat counter
      currentRepeatRef.current = 0;
      setCurrentRepeat(0);
      setActiveRepeatNumber(1);
    }

    // Show visual feedback with more context
    if (showToast && oldCount !== newCount) {
      let message = `Repeat count: ${newCount}`;
      if (isPlaying && isInRepeatMode) {
        if (newCount > oldCount) {
          const remaining = newCount - currentRep;
          message = `Repeat count increased to ${newCount} (${remaining} more to go)`;
        } else if (newCount < oldCount && currentRep >= newCount) {
          message = `Advancing to next segment (repeat count: ${newCount})`;
        } else {
          message = `Repeat count reduced to ${newCount}`;
        }
      }
      showToast(message, 'info');
    }
  }, [repeatCount, isPlaying, isInRepeatMode, isPausingForRepeat, activeTranscript,
      stopRepeatsEarly, onLineChange, segments, userIsScrolling, scrollToActiveSegment,
      playSpecificLine, onPlayStateChange, showToast]);

  const handlePrevious = () => {
    if (session.currentLineIndex > 0) {
      if (repeatTimeoutRef.current) {
        clearTimeout(repeatTimeoutRef.current);
        repeatTimeoutRef.current = null;
      }
      if (lineEndTimeoutRef.current) {
        clearTimeout(lineEndTimeoutRef.current);
        lineEndTimeoutRef.current = null;
      }
      if (repeatMonitorRef.current) {
        clearInterval(repeatMonitorRef.current);
        repeatMonitorRef.current = null;
      }
      timeManagerRef.current.stopSync();
      setIsPausingForRepeat(false);
      setIsInRepeatMode(false);
      const prevIndex = session.currentLineIndex - 1;
      onLineChangeRef.current(prevIndex);
      actualPlayingLineIndexRef.current = prevIndex;
      // Reset repeat tracking for the new line
      currentRepeatRef.current = 0;
      setCurrentRepeat(0);
      setActiveRepeatNumber(1);
      // Update the active segment to match the new line
      if (segments[prevIndex]) {
        setActiveSegmentId(segments[prevIndex].id);
        setCurrentSegmentIndex(prevIndex);
        if (!userIsScrolling) {
          scrollToActiveSegment(segments[prevIndex].id);
        }
      }
      setIsPlaying(false);
    }
  };

  const handleNext = () => {
    if (session.currentLineIndex < activeTranscript.length - 1) {
      if (repeatTimeoutRef.current) {
        clearTimeout(repeatTimeoutRef.current);
        repeatTimeoutRef.current = null;
      }
      if (lineEndTimeoutRef.current) {
        clearTimeout(lineEndTimeoutRef.current);
        lineEndTimeoutRef.current = null;
      }
      if (repeatMonitorRef.current) {
        clearInterval(repeatMonitorRef.current);
        repeatMonitorRef.current = null;
      }
      timeManagerRef.current.stopSync();
      setIsPausingForRepeat(false);
      setIsInRepeatMode(false);
      const nextIndex = session.currentLineIndex + 1;
      if (onLineChangeRef.current) {
        onLineChangeRef.current(nextIndex);
      }
      actualPlayingLineIndexRef.current = nextIndex;
      // Reset repeat tracking for the new line
      currentRepeatRef.current = 0;
      setCurrentRepeat(0);
      setActiveRepeatNumber(1);
      // Update the active segment to match the new line
      if (segments[nextIndex]) {
        setActiveSegmentId(segments[nextIndex].id);
        setCurrentSegmentIndex(nextIndex);
        if (!userIsScrolling) {
          scrollToActiveSegment(segments[nextIndex].id);
        }
      }
      setIsPlaying(false);
    }
  };

  const handleLineClick = (index: number) => {
    if (repeatTimeoutRef.current) {
      clearTimeout(repeatTimeoutRef.current);
      repeatTimeoutRef.current = null;
    }
    if (lineEndTimeoutRef.current) {
      clearTimeout(lineEndTimeoutRef.current);
      lineEndTimeoutRef.current = null;
    }
    if (repeatMonitorRef.current) {
      clearInterval(repeatMonitorRef.current);
      repeatMonitorRef.current = null;
    }
    
    timeManagerRef.current.stopSync();
    setIsPausingForRepeat(false);
    setIsInRepeatMode(false);
    if (onLineChangeRef.current) {
      onLineChangeRef.current(index);
    }
    actualPlayingLineIndexRef.current = index;
    setCurrentRepeat(0);
    setActiveRepeatNumber(1);
    setIsPlaying(false);
    
    if (isYouTubeMode && youtubePlayerRef.current && activeTranscript[index]) {
      if (typeof youtubePlayerRef.current.seekTo === 'function') {
        youtubePlayerRef.current.seekTo(activeTranscript[index].startTime, true);
      }
    } else if (isLocalVideo && localVideoRef.current && activeTranscript[index]) {
      localVideoRef.current.currentTime = activeTranscript[index].startTime;
    } else if (audioRef.current && activeTranscript[index]) {
      audioRef.current.currentTime = activeTranscript[index].startTime;
    }
  };

  const seekTo = useCallback((time: number) => {
    if (youtubePlayerRef.current) {
      youtubePlayerRef.current.seekTo(time, true);
    } else if (localVideoRef.current) {
      localVideoRef.current.currentTime = time;
    } else if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, []);

  const handleSegmentClick = useCallback((segment: TimeSegment, index: number) => {
    seekTo(segment.startTime);
    setActiveSegmentId(segment.id);
    if (onLineChangeRef.current) {
      onLineChangeRef.current(index);
    }
  }, [seekTo]);

  if (!session || !session.transcript || session.transcript.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No transcript available
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Video Title Bar - Hidden on mobile (shown in PageHeader collapsible) */}
      {(session.videoTitle || session.videoMetadata?.title) && (
        <div className="hidden sm:block bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4 shadow-sm border border-primary-200/50 dark:border-primary-700/30">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎬</span>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {session.videoTitle || session.videoMetadata?.title || 'Loading...'}
            </h2>
          </div>
        </div>
      )}

      {/* Video/Audio Display */}
      {isYouTubeMode && showVideo && displayMode === 'video' && (
        <div className="bg-card rounded-lg shadow-sm border border-gray-300/50 dark:border-dark-700/50 p-4">
          <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
            <div id="enhanced-youtube-player" className="absolute inset-0" />
            {!isYouTubeReady && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-white">Loading YouTube player...</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Local Video Display */}
      {isLocalVideo && showVideo && displayMode === 'video' && session.videoUrl && session.videoUrl.startsWith('blob:') && !videoError && (
        <div className="bg-card rounded-lg shadow-sm border border-gray-300/50 dark:border-dark-700/50 p-4">
          <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
            <video
              ref={localVideoRef}
              className="w-full h-full object-contain"
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={handleAudioEnded}
              onPlay={() => {
                setIsPlaying(true);
                if (onPlayStateChange) onPlayStateChange(true);
                timeManagerRef.current.startSync();
              }}
              onPause={() => {
                setIsPlaying(false);
                if (onPlayStateChange) onPlayStateChange(false);
                timeManagerRef.current.stopSync();
              }}
              onError={() => {
                setVideoError(true);
                showToast(
                  'Video format not supported. Showing fallback player with controls.',
                  'warning'
                );
              }}
              onLoadedMetadata={() => {
                setVideoError(false);
              }}
              controls={false}
              playsInline
              preload="metadata"
            >
              <source src={session.videoUrl} type="video/mp4" />
              <source src={session.videoUrl} type="video/webm" />
              <source src={session.videoUrl} type="video/mov" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      )}

      {/* Fallback Video Player with Native Controls */}
      {isLocalVideo && showVideo && displayMode === 'video' && session.videoUrl && session.videoUrl.startsWith('blob:') && videoError && (
        <div className="bg-card rounded-lg shadow-sm border border-gray-300/50 dark:border-dark-700/50 p-4">
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 mb-4">
            <p className="text-sm text-warning-foreground">
              Using browser's native video player. Some shadowing features may be limited.
            </p>
          </div>
          <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
            <video
              src={session.videoUrl}
              className="w-full h-full object-contain"
              controls
              playsInline
            />
          </div>
        </div>
      )}

      {/* Playback Controls - Immediately after video */}
      <div
        className="rounded-lg shadow-md border-2 border-primary-200 dark:border-primary-800 p-3 sm:p-4 backdrop-blur-sm"
        style={{ backgroundColor: '#38455c' }}
      >
        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-3 sm:mb-4">
          <button
            onClick={handlePrevious}
            disabled={session.currentLineIndex === 0}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-500/50 text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous line"
          >
            <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button
            onClick={handlePlayPause}
            className="p-2 sm:p-3 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-colors shadow-lg"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>

          <button
            onClick={handleNext}
            disabled={session.currentLineIndex === activeTranscript.length - 1}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-500/50 text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Next line"
          >
            <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-0.5 sm:space-y-1">
          <div className="flex justify-between text-[10px] sm:text-xs text-gray-100">
            <span>{timeManagerRef.current.formatTime(currentTime)}</span>
            <span>{timeManagerRef.current.formatTime(duration)}</span>
          </div>
          <div className="relative h-1.5 sm:h-2 bg-[#282a36] rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-orange-500 transition-all duration-100"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Settings Button - Desktop Only */}
      <div className="hidden sm:flex justify-end mb-2 relative">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all group"
          aria-label="Settings"
          title="Click for playback settings and AI transcript toggle"
        >
          <Settings className="w-4 h-4 text-foreground group-hover:rotate-45 transition-transform" />
          <span className="text-sm font-medium text-foreground">Settings</span>
        </button>

        {/* Settings Dropdown Modal */}
        {showSettings && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/20"
              onClick={() => setShowSettings(false)}
            />

            <div className="absolute right-0 top-full mt-2 w-80 bg-gray-50 dark:bg-dark-800 rounded-lg shadow-xl border border-gray-300/30 dark:border-dark-700/30 p-4 z-50 max-h-[80vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </h3>

              <div className="space-y-4">
                {/* Repeat Count */}
                <div>
                  <label className="text-sm font-medium text-gray-900 dark:text-gray-100 block mb-2">
                    Repeat Count: {repeatCount}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={repeatCount}
                    onChange={(e) => {
                      const newCount = parseInt(e.target.value);
                      handleRepeatCountChange(newCount);
                    }}
                    className="w-full"
                  />
                </div>

                {/* Pause Between Repeats */}
                <div>
                  <label className="text-sm font-medium text-gray-900 dark:text-gray-100 block mb-2">
                    Pause Between Repeats: {pauseBetweenRepeats / 1000}s
                  </label>
                  <input
                    type="range"
                    min="500"
                    max="5000"
                    step="500"
                    value={pauseBetweenRepeats}
                    onChange={(e) => {
                      const newPause = parseInt(e.target.value);
                      setPauseBetweenRepeats(newPause);
                      setAbRepeat(prev => ({ ...prev, pauseDuration: newPause }));
                    }}
                    className="w-full"
                  />
                </div>

                {/* Divider */}
                <div className="border-t border-gray-300/30 dark:border-dark-700/30 pt-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Display Options</h4>
                  
                  {/* Furigana Toggle */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1 pr-3">
                      <label className="text-sm font-medium text-gray-900 dark:text-gray-100 block">Furigana</label>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Show reading hints above kanji
                      </p>
                    </div>
                    <button
                      onClick={() => onToggleFurigana?.()}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        showFurigana ? 'bg-primary-500' : 'bg-gray-300 dark:bg-dark-600'
                      }`}
                      role="switch"
                      aria-checked={showFurigana}
                      aria-label="Toggle furigana"
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          showFurigana ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Grammar Highlighting Toggle */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1 pr-3">
                      <label className="text-sm font-medium text-gray-900 dark:text-gray-100 block">Grammar Colors</label>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Highlight parts of speech with colors
                      </p>
                    </div>
                    <button
                      onClick={() => onToggleGrammar?.()}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        showGrammar ? 'bg-primary-500 dark:bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                      role="switch"
                      aria-checked={showGrammar}
                      aria-label="Toggle grammar highlighting"
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          showGrammar ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Grammar Mode Selection */}
                  {showGrammar && (
                    <div className="mb-3 pl-3">
                      <label className="text-xs text-muted-foreground block mb-2">Highlight Mode:</label>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          onClick={() => onGrammarModeChange?.('all')}
                          className={`px-2 py-1 rounded text-xs ${
                            grammarMode === 'all'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          All Words
                        </button>
                        <button
                          onClick={() => onGrammarModeChange?.('content')}
                          className={`px-2 py-1 rounded text-xs ${
                            grammarMode === 'content'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          Content Words
                        </button>
                        <button
                          onClick={() => onGrammarModeChange?.('grammar')}
                          className={`px-2 py-1 rounded text-xs ${
                            grammarMode === 'grammar'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          Grammar Only
                        </button>
                        <button
                          onClick={() => setShowGrammarLegend(!showGrammarLegend)}
                          className={`px-2 py-1 rounded text-xs col-span-2 ${
                            showGrammarLegend
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          {showGrammarLegend ? 'Hide' : 'Show'} Legend
                        </button>
                      </div>
                      {showGrammarLegend && (
                        <div className="mt-3 p-2 bg-muted/30 rounded">
                          <GrammarLegend />
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* AI-Formatted Transcript Toggle - Always visible when available */}
                  {canUseFormattedTranscript && (
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1 pr-3">
                        <label className="text-sm font-medium text-gray-900 dark:text-gray-100 block">
                          {useFormattedTranscript ? '✨ AI-Optimized' : '📝 Raw Transcript'}
                        </label>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {useFormattedTranscript
                            ? 'Using AI-improved line breaks'
                            : 'Using original YouTube captions'}
                        </p>
                      </div>
                      <button
                        onClick={() => onToggleTranscriptSource?.(!useEnhancedTranscript)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          useFormattedTranscript ? 'bg-primary-500 dark:bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                        role="switch"
                        aria-checked={useFormattedTranscript}
                        aria-label="Toggle between AI-formatted and raw transcript"
                        title={useFormattedTranscript ? 'Switch to raw transcript' : 'Switch to AI-optimized'}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            useFormattedTranscript ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  )}

                  {!canUseFormattedTranscript && !formattedAvailable && canRequestAiEnhancement && onRequestAiEnhancement && (
                    <div className="mb-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 dark:border-primary/40 dark:bg-primary/10">
                      <div className="flex items-start gap-2">
                        <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-primary-600 dark:text-primary-200">
                            Enhance with AI
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Kick off a one-time AI pass to improve line breaks and translations for this video.
                          </p>
                          <button
                            onClick={() => onRequestAiEnhancement()}
                            disabled={aiEnhancementStatus === 'running'}
                            className="mt-3 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {aiEnhancementStatus === 'running' ? (
                              <>
                                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-primary-foreground" />
                                Enhancing…
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4" />
                                Start AI enhancement
                              </>
                            )}
                          </button>
                          {aiEnhancementStatus === 'completed' && (
                            <p className="mt-2 text-xs text-primary-600 dark:text-primary-200">
                              Enhancement requested. Switch to the AI tab once processing finishes.
                            </p>
                          )}
                          {aiEnhancementStatus === 'error' && aiEnhancementError && (
                            <p className="mt-2 text-xs text-destructive">
                              {aiEnhancementError}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Display Mode Toggle */}
                  {(isYouTubeMode || isLocalVideo) && showVideo && (
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-foreground block mb-1">Display Mode</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (displayMode !== 'video') {
                              setDisplayMode('video');
                              setIsPlaying(false);
                            }
                          }}
                          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                            displayMode === 'video'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          Video
                        </button>
                        <button
                          onClick={() => {
                            if (displayMode !== 'transcript') {
                              setDisplayMode('transcript');
                              setIsPlaying(false);
                              if (youtubePlayerRef.current) {
                                youtubePlayerRef.current.pauseVideo();
                              }
                            }
                          }}
                          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                            displayMode === 'transcript'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          Transcript
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Current Line Display */}
      <div
        className="rounded-lg shadow-md border-2 border-primary-200 dark:border-primary-800 p-3 sm:p-6 backdrop-blur-sm"
        style={{ backgroundColor: '#38455c' }}
      >
        {/* AI Icon row - TODO: Add AI explanation feature when available */}
        {/* {currentLine?.text && (
          <div className="flex justify-start mb-4">
            <AIExplanationTrigger
              text={cleanRomaji(currentLine.text)}
              contextType="sentence"
              size="lg"
            />
          </div>
        )} */}

        <div className="text-center">
          <div className="py-4 px-2 sm:py-8 sm:px-4">
            {showGrammar ? (
              <div className="text-lg sm:text-2xl font-medium text-gray-100 leading-relaxed">
                <GrammarHighlightedText
                  text={cleanRomaji(currentLine?.text || '')}
                  highlightMode={grammarMode}
                  showFurigana={showFurigana}
                  className="text-lg sm:text-2xl"
                />
              </div>
            ) : (
              <p
                className="text-lg sm:text-2xl font-medium text-gray-100 japanese-text leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: showFurigana
                    ? currentLineFurigana
                    : cleanRomaji(currentLine?.text || '')
                }}
              />
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-300">
            Line {session.currentLineIndex + 1} of {activeTranscript.length}
          </p>
          {repeatCount > 1 && (
            <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/20 border border-primary/30">
              <span className="text-xs sm:text-sm text-primary font-medium">
                {activeRepeatNumber}/{repeatCount}
              </span>
              {isPausingForRepeat && (
                <span className="text-xs text-primary/70 ml-1">
                  (pausing...)
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Floating Navbar - Mobile Only */}
      <div className="sm:hidden">
        <FloatingNavbar
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          onRepeatCountChange={handleRepeatCountChange}
          repeatCount={repeatCount}
          showFurigana={showFurigana}
          onToggleFurigana={onToggleFurigana}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
          showVideo={showVideo}
          isYouTubeMode={isYouTubeMode}
          isLocalVideo={isLocalVideo}
          grammarSentence={currentLine?.text || ''}
          grammarContext={
            session.videoTitle && session.videoMetadata?.description
              ? `${session.videoTitle} — ${session.videoMetadata.description.slice(0, 240)}`
              : session.videoTitle || undefined
          }
          grammarSurrounding={[
            ...(activeTranscript.slice(Math.max(0, session.currentLineIndex - 2), session.currentLineIndex).map((line: TranscriptLine) => line?.text).filter(Boolean)),
            ...(activeTranscript.slice(session.currentLineIndex + 1, session.currentLineIndex + 3).map((line: TranscriptLine) => line?.text).filter(Boolean))
          ]}
          grammarTitle={session.videoTitle}
          showGrammar={showGrammar}
          onToggleGrammar={onToggleGrammar}
          grammarMode={grammarMode}
          onGrammarModeChange={onGrammarModeChange}
          formattedAvailable={canUseFormattedTranscript}
          useEnhancedTranscript={useEnhancedTranscript}
          onToggleTranscriptSource={onToggleTranscriptSource}
        />
      </div>
    </div>
  );
}
