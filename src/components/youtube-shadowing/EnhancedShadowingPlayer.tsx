'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ShadowingSession, TranscriptLine } from '@/app/tools/youtube-shadowing/YouTubeShadowing';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, Repeat, Settings, 
  ChevronLeft, ChevronRight, Video, AudioLines, ChevronUp, ChevronDown, RotateCcw 
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast/ToastContext';
// TODO: Import or create AIExplanationTrigger
// import { AIExplanationTrigger } from '@/components/AIExplanation';
import { generateFuriganaWithCache } from '@/utils/furigana';
import { motion, AnimatePresence } from 'framer-motion';
import { GrammarHighlightedText, GrammarLegend } from '@/components/reading/GrammarHighlightedText';
import { 
  PrecisionTimeManager, TimeSegment, ABRepeatConfig 
} from '@/utils/precisionTimeManager';
import { cn } from '@/lib/utils';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface EnhancedShadowingPlayerProps {
  session: ShadowingSession;
  onLineChange: (index: number) => void;
  showVideo?: boolean;
  showFurigana?: boolean;
  onToggleFurigana?: () => void;
  showGrammar?: boolean;
  onToggleGrammar?: () => void;
  grammarMode?: 'none' | 'all' | 'content' | 'grammar';
  onGrammarModeChange?: (mode: 'none' | 'all' | 'content' | 'grammar') => void;
  className?: string;
}

export default function EnhancedShadowingPlayer({ 
  session, 
  onLineChange,
  showVideo = true,
  showFurigana = true,
  onToggleFurigana,
  showGrammar = false,
  onToggleGrammar,
  grammarMode = 'content',
  onGrammarModeChange,
  className 
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
  const [continuousPlay, setContinuousPlay] = useState(false);
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
  const [useFormattedTranscript, setUseFormattedTranscript] = useState(true); // Always prefer AI transcripts
  const [showGrammarLegend, setShowGrammarLegend] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  
  // Precision Time Management
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const [userIsScrolling, setUserIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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
  
  // Debug logging - moved after all state declarations
  useEffect(() => {
    console.log('[PLAYER_DEBUG] Component mounted/updated', {
      sessionLineIndex: session.currentLineIndex,
      isPlaying,
      repeatCount,
      currentRepeat,
      isInRepeatMode,
      isPausingForRepeat
    });
  }, [session.currentLineIndex, isPlaying, repeatCount, currentRepeat, isInRepeatMode, isPausingForRepeat]);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const youtubePlayerRef = useRef<any>(null);
  const repeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lineEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const repeatMonitorRef = useRef<NodeJS.Timeout | null>(null);
  const currentRepeatRef = useRef<number>(0);
  const actualPlayingLineIndexRef = useRef<number>(session.currentLineIndex);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  
  // Precision Time Manager
  const timeManagerRef = useRef<PrecisionTimeManager>(new PrecisionTimeManager());

  // Determine which transcript to use - ALWAYS prefer formatted when available
  // TypeScript doesn't know about formattedTranscript in videoMetadata, so we use type assertion
  const metadata = session.videoMetadata as any;
  const hasFormattedTranscript = metadata?.formattedTranscript && 
                                  Array.isArray(metadata.formattedTranscript) &&
                                  metadata.formattedTranscript.length > 0;
  
  // Auto-enable formatted transcript when available
  useEffect(() => {
    if (hasFormattedTranscript && !useFormattedTranscript) {
      console.log('[TRANSCRIPT] AI-formatted transcript available, enabling automatically');
      setUseFormattedTranscript(true);
    }
  }, [hasFormattedTranscript]);
  
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
        console.error('Failed to generate furigana:', error);
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
            console.warn('[PLAYER] YouTube API load timeout - using fallback player');
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
      console.error('Failed to initialize YouTube player:', error);
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
    if (isHandlingRepeatEnd || (repeatCount > 1)) {
      return;
    }
    
    if (event.data === window.YT.PlayerState.PLAYING) {
      setIsPlaying(true);
      timeManagerRef.current.startSync();
    } else {
      setIsPlaying(false);
      if (event.data === window.YT.PlayerState.PAUSED) {
        timeManagerRef.current.stopSync();
      }
    }
  }, [isHandlingRepeatEnd, repeatCount]);

  // Initialize audio element
  useEffect(() => {
    if (!isYouTubeMode && !isLocalVideo && session.audioUrl && !audioRef.current) {
      const audio = new Audio(session.audioUrl);
      audio.playbackRate = playbackSpeed;
      audio.volume = volume;
      audioRef.current = audio;

      // Set up precision time tracking for audio
      timeManagerRef.current.setPlayer(() => 
        audioRef.current?.currentTime || 0
      );

      audio.addEventListener('timeupdate', handleAudioTimeUpdate);
      audio.addEventListener('ended', handleAudioEnded);
      audio.addEventListener('play', () => {
        setIsPlaying(true);
        timeManagerRef.current.startSync();
      });
      audio.addEventListener('pause', () => {
        setIsPlaying(false);
        timeManagerRef.current.stopSync();
      });

      return () => {
        audio.removeEventListener('timeupdate', handleAudioTimeUpdate);
        audio.removeEventListener('ended', handleAudioEnded);
        audio.pause();
      };
    }
  }, [isYouTubeMode, isLocalVideo, session.audioUrl, playbackSpeed, volume]);

  // Initialize local video element
  useEffect(() => {
    if (isLocalVideo && localVideoRef.current && session.videoUrl) {
      localVideoRef.current.load();
      
      // Set up precision time tracking for local video
      timeManagerRef.current.setPlayer(() => 
        localVideoRef.current?.currentTime || 0
      );
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
      setCurrentTime(time);
      
      // Update active segment
      const activeSegment = timeManagerRef.current.findActiveSegment(segments, time);
      if (activeSegment) {
        const segmentIndex = segments.findIndex(s => s.id === activeSegment.id);
        
        if (activeSegment.id !== lastSegmentId) {
          console.log('[PLAYER_DEBUG] Segment changed', {
            oldSegmentId: lastSegmentId,
            newSegmentId: activeSegment.id,
            segmentIndex,
            isInRepeatMode,
            isPausingForRepeat
          });
          
          lastSegmentId = activeSegment.id;
          setActiveSegmentId(activeSegment.id);
          setCurrentSegmentIndex(segmentIndex);
          
          if (!isInRepeatMode && !isPausingForRepeat) {
            onLineChange(segmentIndex);
          }
          
          // Only auto-scroll if user isn't manually scrolling
          if (!userIsScrolling) {
            scrollToActiveSegment(activeSegment.id);
          }
        }
      }
    });
    
    return () => unsubscribe();
  }, [isYouTubeReady, segments, abRepeat, isInRepeatMode, isPausingForRepeat, onLineChange, userIsScrolling]);

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
    
    if (currentTime >= effectiveEndTime && repeatCount > 1) {
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

    console.log('[PLAYER_DEBUG] handleLineComplete called', {
      currentRep,
      nextRepeat,
      repeatCount,
      currentLineIndex,
      sessionLineIndex: session.currentLineIndex,
      actualPlayingLineIndex: actualPlayingLineIndexRef.current,
      lineText: lineToRepeat?.text?.substring(0, 30),
      totalLines: activeTranscript.length
    });

    timeManagerRef.current.stopSync();
    
    if (nextRepeat < repeatCount) {
      console.log('[PLAYER_DEBUG] Continuing repeats', { 
        nextRepeat, 
        repeatCount,
        lineIndex: currentLineIndex,
        lineText: lineToRepeat?.text?.substring(0, 30)
      });
      setCurrentRepeat(nextRepeat);
      setActiveRepeatNumber(nextRepeat + 1);
      setIsPausingForRepeat(true);
      
      repeatTimeoutRef.current = setTimeout(() => {
        // Use the specific line for this repeat
        if (lineToRepeat) {
          playSpecificLine(lineToRepeat, currentLineIndex);
        } else {
          console.error('[PLAYER_DEBUG] Line to repeat not found!');
          playCurrentLine();
        }
      }, pauseBetweenRepeats);
    } else {
      console.log('[PLAYER_DEBUG] Completed all repeats');
      setCurrentRepeat(0);
      setActiveRepeatNumber(1);
      setIsInRepeatMode(false);
      
      // Check if continuous play is enabled and we're not at the last line
      if (continuousPlay && actualPlayingLineIndexRef.current < activeTranscript.length - 1) {
        console.log('[PLAYER_DEBUG] Continuous play enabled - advancing to next line');
        setTimeout(() => {
          const nextIndex = actualPlayingLineIndexRef.current + 1;
          const nextLine = activeTranscript[nextIndex];
          
          if (!nextLine) {
            console.log('[PLAYER_DEBUG] Next line not found, stopping');
            setIsPlaying(false);
            return;
          }
          
          onLineChange(nextIndex);
          // Reset repeat tracking for the new line
          currentRepeatRef.current = 0;
          // Update the active segment to match the new line
          if (segments[nextIndex]) {
            setActiveSegmentId(segments[nextIndex].id);
            setCurrentSegmentIndex(nextIndex);
            // Scroll to the new segment if not manually scrolling
            if (!userIsScrolling) {
              scrollToActiveSegment(segments[nextIndex].id);
            }
          }
          // Play the next line with its specific data
          setTimeout(() => {
            playSpecificLine(nextLine, nextIndex);
          }, 500);
        }, 1000);
      } else {
        setIsPlaying(false);
        console.log('[PLAYER_DEBUG] Stopping playback - continuous play disabled or last line reached');
      }
    }
  };

  const handleAutoRepeatSegmentEnd = useCallback((segmentIndex: number) => {
    console.log('[PLAYER_DEBUG] handleAutoRepeatSegmentEnd called', {
      segmentIndex,
      abRepeat,
      segmentCount: segments.length
    });

    if (youtubePlayerRef.current) {
      youtubePlayerRef.current.pauseVideo();
    } else if (localVideoRef.current) {
      localVideoRef.current.pause();
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
    
    const currentRep = abRepeat.currentRepeat + 1;
    
    if (currentRep < abRepeat.totalRepeats) {
      console.log('[PLAYER_DEBUG] Auto-repeat: continuing segment repeat', { 
        currentRep, 
        totalRepeats: abRepeat.totalRepeats 
      });
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
      console.log('[PLAYER_DEBUG] Auto-repeat: segment complete, moving to next', { 
        nextIndex, 
        hasNext: nextIndex < segments.length 
      });
      
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
        console.log('[PLAYER_DEBUG] Auto-repeat: completed all segments, disabling');
        setAutoRepeatMode(false);
        setAbRepeat(prev => ({ ...prev, isActive: false, currentRepeat: 0 }));
      }
    }
  }, [abRepeat.currentRepeat, abRepeat.totalRepeats, abRepeat.pauseDuration, segments]);

  const playSpecificLine = (lineToPlay: any, lineIndex: number) => {
    if (!lineToPlay) return;

    const repeatNum = currentRepeatRef.current + 1;
    console.log('[PLAYER_DEBUG] playSpecificLine called', {
      lineIndex,
      lineStartTime: lineToPlay.startTime,
      lineText: lineToPlay.text?.substring(0, 30),
      repeatNum,
      repeatCount,
      isInRepeatMode,
      sessionLineIndex: session.currentLineIndex,
      actualPlayingLineIndex: actualPlayingLineIndexRef.current
    });
    
    // Track what line we're actually playing
    actualPlayingLineIndexRef.current = lineIndex;
    setIsPausingForRepeat(false);
    
    if (repeatCount > 1) {
      console.log('[PLAYER_DEBUG] Setting isInRepeatMode = true (repeatCount > 1)');
      setIsInRepeatMode(true);
    }

    if (isYouTubeMode && youtubePlayerRef.current && isYouTubeReady) {
      youtubePlayerRef.current.seekTo(lineToPlay.startTime, true);
      youtubePlayerRef.current.playVideo();
      setIsPlaying(true);
      
      if (repeatCount > 1) {
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
              console.log('[PLAYER_DEBUG] YouTube reached line end', {
                currentTime,
                effectiveEndTime,
                currentRepeat: currentRepeatRef.current,
                repeatCount
              });
              
              youtubePlayerRef.current.pauseVideo();
              clearInterval(checkInterval);
              repeatMonitorRef.current = null;
              handleLineComplete();
            }
          } catch (e) {
            console.error('[PLAYER_DEBUG] Error checking YouTube time:', e);
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
    } else if (audioRef.current) {
      audioRef.current.currentTime = lineToPlay.startTime;
      audioRef.current.play();
      setIsPlaying(true);
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
      timeManagerRef.current.stopSync();
    } else {
      playCurrentLine();
    }
  };

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
      onLineChange(prevIndex);
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
      onLineChange(nextIndex);
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
    onLineChange(index);
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
    onLineChange(index);
  }, [seekTo, onLineChange]);

  if (!session || !session.transcript || session.transcript.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No transcript available
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Video/Audio Display */}
      {isYouTubeMode && showVideo && displayMode === 'video' && (
        <div className="bg-card rounded-lg shadow-sm border border-border p-4">
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
        <div className="bg-card rounded-lg shadow-sm border border-border p-4">
          <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
            <video
              ref={localVideoRef}
              className="w-full h-full object-contain"
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={handleAudioEnded}
              onPlay={() => {
                setIsPlaying(true);
                timeManagerRef.current.startSync();
              }}
              onPause={() => {
                setIsPlaying(false);
                timeManagerRef.current.stopSync();
              }}
              onError={(e) => {
                console.error('Video playback error:', e);
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
        <div className="bg-card rounded-lg shadow-sm border border-border p-4">
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

      {/* Settings Button */}
      <div className="flex justify-end mb-2 relative">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-all group"
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
              className="fixed inset-0 z-40" 
              onClick={() => setShowSettings(false)}
            />
            
            <div className="absolute right-0 top-full mt-2 w-80 bg-card rounded-lg shadow-lg border border-border p-4 z-50 max-h-[80vh] overflow-y-auto">
              <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </h3>
              
              <div className="space-y-4">
                {/* Repeat Count */}
                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">
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
                      setRepeatCount(newCount);
                      setAbRepeat(prev => ({ ...prev, totalRepeats: newCount }));
                    }}
                    className="w-full"
                  />
                </div>

                {/* Pause Between Repeats */}
                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">
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

                {/* Continuous Play Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-3">
                    <label className="text-sm font-medium text-foreground block">Continuous Play</label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Auto-advance after completing repeats
                    </p>
                  </div>
                  <button
                    onClick={() => setContinuousPlay(!continuousPlay)}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      continuousPlay ? "bg-primary" : "bg-muted"
                    )}
                    role="switch"
                    aria-checked={continuousPlay}
                    aria-label="Toggle continuous play"
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      continuousPlay ? "translate-x-6" : "translate-x-1"
                    )} />
                  </button>
                </div>

                {/* Divider */}
                <div className="border-t border-border pt-4">
                  <h4 className="text-sm font-medium text-foreground mb-3">Display Options</h4>
                  
                  {/* Furigana Toggle */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1 pr-3">
                      <label className="text-sm font-medium text-foreground block">Furigana</label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Show reading hints above kanji
                      </p>
                    </div>
                    <button
                      onClick={() => onToggleFurigana?.()}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        showFurigana ? 'bg-primary' : 'bg-muted'
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
                      <label className="text-sm font-medium text-foreground block">Grammar Colors</label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Highlight parts of speech with colors
                      </p>
                    </div>
                    <button
                      onClick={() => onToggleGrammar?.()}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        showGrammar ? 'bg-primary' : 'bg-muted'
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
                  {hasFormattedTranscript && (
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1 pr-3">
                        <label className="text-sm font-medium text-foreground block">
                          {useFormattedTranscript ? '✨ AI-Optimized' : '📝 Raw Transcript'}
                        </label>
                        <p className="text-xs text-muted-foreground mt-1">
                          {useFormattedTranscript 
                            ? 'Using AI-improved line breaks' 
                            : 'Using original YouTube captions'}
                        </p>
                      </div>
                      <button
                        onClick={() => setUseFormattedTranscript(!useFormattedTranscript)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          useFormattedTranscript ? 'bg-primary' : 'bg-muted'
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
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        {/* AI Icon row */}
        {currentLine?.text && (
          <div className="flex justify-start mb-4">
            <AIExplanationTrigger
              text={cleanRomaji(currentLine.text)}
              contextType="sentence"
              size="lg"
            />
          </div>
        )}
        
        <div className="text-center mb-6">
          <div className="py-8 px-4">
            {showGrammar ? (
              <div className="text-2xl font-medium text-foreground">
                <GrammarHighlightedText
                  text={cleanRomaji(currentLine?.text || '')}
                  highlightMode={grammarMode}
                  showFurigana={showFurigana}
                  className="text-2xl"
                />
              </div>
            ) : (
              <p 
                className="text-2xl font-medium text-foreground japanese-text"
                dangerouslySetInnerHTML={{ 
                  __html: showFurigana 
                    ? currentLineFurigana 
                    : cleanRomaji(currentLine?.text || '')
                }}
              />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Line {session.currentLineIndex + 1} of {activeTranscript.length}
          </p>
          {hasFormattedTranscript && (
            <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-opacity-20"
                 style={{ 
                   backgroundColor: useFormattedTranscript ? 'rgb(168 85 247 / 0.1)' : 'rgb(251 191 36 / 0.1)',
                   color: useFormattedTranscript ? 'rgb(168 85 247)' : 'rgb(245 158 11)'
                 }}>
              {useFormattedTranscript ? '✨ AI-Optimized' : '📝 Raw Transcript'}
            </div>
          )}
          {repeatCount > 1 && (
            <p className="text-sm text-primary mt-2">
              Repeat {activeRepeatNumber} of {repeatCount}
            </p>
          )}
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            onClick={handlePrevious}
            disabled={session.currentLineIndex === 0}
            className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous line"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          <button
            onClick={handlePlayPause}
            className="p-3 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          </button>

          <button
            onClick={handleNext}
            disabled={session.currentLineIndex === activeTranscript.length - 1}
            className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Next line"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1 mb-4">
          <div className="flex justify-between text-xs text-gray-500">
            <span>{timeManagerRef.current.formatTime(currentTime)}</span>
            <span>{timeManagerRef.current.formatTime(duration)}</span>
          </div>
          <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-100"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
        </div>

      </div>

      {/* Transcript List */}
      <div className="bg-card rounded-lg shadow-sm border border-border">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Full Transcript</h3>
          {userIsScrolling && (
            <span className="text-xs text-muted-foreground bg-yellow-100 px-2 py-1 rounded">
              Auto-scroll paused
            </span>
          )}
        </div>
        
        <div 
          ref={transcriptContainerRef}
          className="max-h-96 overflow-y-auto p-4 space-y-2"
          onScroll={() => {
            // User is manually scrolling
            setUserIsScrolling(true);
            
            // Clear any existing timeout
            if (scrollTimeoutRef.current) {
              clearTimeout(scrollTimeoutRef.current);
            }
            
            // Re-enable auto-scroll after 3 seconds of no scrolling
            scrollTimeoutRef.current = setTimeout(() => {
              setUserIsScrolling(false);
            }, 3000);
          }}
        >
          {segments.map((segment, index) => (
            <motion.div
              key={segment.id}
              id={`segment-${segment.id}`}
              onClick={() => handleSegmentClick(segment, index)}
              className={cn(
                "p-3 rounded-lg cursor-pointer transition-all",
                activeSegmentId === segment.id 
                  ? "bg-blue-50 border-l-4 border-blue-500" 
                  : "hover:bg-gray-50"
              )}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-start gap-3">
                <span className="text-xs text-gray-500 mt-1">
                  {timeManagerRef.current.formatTime(segment.startTime)}
                </span>
                <div className={cn(
                  "flex-1 leading-relaxed transition-all",
                  activeSegmentId === segment.id ? "text-gray-900 font-medium" : "text-gray-700"
                )}>
                  {showGrammar ? (
                    <GrammarHighlightedText
                      text={cleanRomaji(segment.text)}
                      highlightMode={grammarMode}
                      showFurigana={showFurigana}
                      className="text-base"
                    />
                  ) : (
                    <p>{cleanRomaji(segment.text)}</p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        
      </div>
    </div>
  );
}