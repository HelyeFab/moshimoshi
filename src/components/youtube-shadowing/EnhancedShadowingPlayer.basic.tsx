'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useTTS } from '@/hooks/useTTS';

export interface TranscriptLine {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  words?: string[];
}

interface EnhancedShadowingPlayerProps {
  videoUrl: string;
  audioUrl: string;
  transcript: TranscriptLine[];
  videoTitle?: string;
  isYouTube?: boolean;
  fileInfo?: {
    name: string;
    size: number;
    type: string;
  };
  onTimeUpdate?: (currentTime: number) => void;
  onLineChange?: (lineIndex: number) => void;
}

export default function EnhancedShadowingPlayer({
  videoUrl,
  audioUrl,
  transcript,
  videoTitle,
  isYouTube = false,
  fileInfo,
  onTimeUpdate,
  onLineChange
}: EnhancedShadowingPlayerProps) {
  const { t, strings } = useI18n();
  const { play: playTTS } = useTTS({ cacheFirst: true });

  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [isLooping, setIsLooping] = useState(false);
  const [repeatCount, setRepeatCount] = useState(0);

  // UI state
  const [showTranscript, setShowTranscript] = useState(true);
  const [showFurigana, setShowFurigana] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);

  // Refs
  const playerRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const youtubePlayerRef = useRef<any>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const currentLineRef = useRef<HTMLDivElement>(null);

  // YouTube Player API setup
  useEffect(() => {
    if (isYouTube && !window.YT) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(script);

      (window as any).onYouTubeIframeAPIReady = () => {
        initYouTubePlayer();
      };
    } else if (isYouTube && window.YT) {
      initYouTubePlayer();
    }
  }, [isYouTube, videoUrl]);

  const initYouTubePlayer = useCallback(() => {
    if (!window.YT || !window.YT.Player) return;

    const videoId = extractYouTubeVideoId(videoUrl);
    if (!videoId) return;

    youtubePlayerRef.current = new window.YT.Player('youtube-player', {
      height: '360',
      width: '640',
      videoId: videoId,
      playerVars: {
        enablejsapi: 1,
        origin: window.location.origin,
        rel: 0,
        showinfo: 0,
      },
      events: {
        onReady: onYouTubePlayerReady,
        onStateChange: onYouTubePlayerStateChange,
      },
    });
  }, [videoUrl]);

  const onYouTubePlayerReady = useCallback((event: any) => {
    setDuration(event.target.getDuration());

    // Set up time update interval for YouTube
    const interval = setInterval(() => {
      if (youtubePlayerRef.current && youtubePlayerRef.current.getCurrentTime) {
        const time = youtubePlayerRef.current.getCurrentTime();
        setCurrentTime(time);
        onTimeUpdate?.(time);
        updateCurrentLine(time);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [onTimeUpdate]);

  const onYouTubePlayerStateChange = useCallback((event: any) => {
    const state = event.data;
    setIsPlaying(state === window.YT.PlayerState.PLAYING);
  }, []);

  const extractYouTubeVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/,
      /youtube\.com\/v\/([^&\s]+)/,
      /youtube\.com\/shorts\/([^&\s]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  // Update current line based on time
  const updateCurrentLine = useCallback((time: number) => {
    const lineIndex = transcript.findIndex((line, index) => {
      const nextLine = transcript[index + 1];
      return time >= line.startTime && (!nextLine || time < nextLine.startTime);
    });

    if (lineIndex !== -1 && lineIndex !== currentLineIndex) {
      setCurrentLineIndex(lineIndex);
      onLineChange?.(lineIndex);

      // Auto-scroll to current line
      if (autoScroll && currentLineRef.current) {
        currentLineRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [transcript, currentLineIndex, autoScroll, onLineChange]);

  // Media player event handlers
  const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLMediaElement>) => {
    const time = e.currentTarget.currentTime;
    setCurrentTime(time);
    onTimeUpdate?.(time);
    updateCurrentLine(time);
  }, [onTimeUpdate, updateCurrentLine]);

  const handleLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLMediaElement>) => {
    setDuration(e.currentTarget.duration);
  }, []);

  const handlePlay = useCallback(() => setIsPlaying(true), []);
  const handlePause = useCallback(() => setIsPlaying(false), []);

  // Player controls
  const togglePlayPause = useCallback(() => {
    if (isYouTube && youtubePlayerRef.current) {
      if (isPlaying) {
        youtubePlayerRef.current.pauseVideo();
      } else {
        youtubePlayerRef.current.playVideo();
      }
    } else if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.pause();
      } else {
        playerRef.current.play();
      }
    }
  }, [isPlaying, isYouTube]);

  const seekTo = useCallback((time: number) => {
    if (isYouTube && youtubePlayerRef.current) {
      youtubePlayerRef.current.seekTo(time, true);
    } else if (playerRef.current) {
      playerRef.current.currentTime = time;
    }
    setCurrentTime(time);
  }, [isYouTube]);

  const jumpToLine = useCallback((lineIndex: number) => {
    if (lineIndex >= 0 && lineIndex < transcript.length) {
      const line = transcript[lineIndex];
      seekTo(line.startTime);
      setCurrentLineIndex(lineIndex);
    }
  }, [transcript, seekTo]);

  const changePlaybackRate = useCallback((rate: number) => {
    setPlaybackRate(rate);
    if (isYouTube && youtubePlayerRef.current) {
      youtubePlayerRef.current.setPlaybackRate(rate);
    } else if (playerRef.current) {
      playerRef.current.playbackRate = rate;
    }
  }, [isYouTube]);

  const changeVolume = useCallback((vol: number) => {
    setVolume(vol);
    if (isYouTube && youtubePlayerRef.current) {
      youtubePlayerRef.current.setVolume(vol * 100);
    } else if (playerRef.current) {
      playerRef.current.volume = vol;
    }
  }, [isYouTube]);

  const repeatCurrentLine = useCallback(() => {
    const currentLine = transcript[currentLineIndex];
    if (currentLine) {
      seekTo(currentLine.startTime);
      setRepeatCount(prev => prev + 1);
    }
  }, [transcript, currentLineIndex, seekTo]);

  const playCurrentLineTTS = useCallback(async () => {
    const currentLine = transcript[currentLineIndex];
    if (currentLine) {
      try {
        await playTTS(currentLine.text, { voice: 'ja-JP', rate: playbackRate });
      } catch (error) {
        console.error('TTS playback failed:', error);
      }
    }
  }, [transcript, currentLineIndex, playTTS, playbackRate]);

  // Format time display
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return (
    <div className="bg-gray-50 dark:bg-dark-800 rounded-xl shadow-lg border border-gray-200 dark:border-dark-700 overflow-hidden">
      {/* Video/Audio Player */}
      <div className="relative bg-gray-900">
        {isYouTube ? (
          <div className="w-full aspect-video flex items-center justify-center">
            <div id="youtube-player" className="w-full h-full" />
          </div>
        ) : (
          <div className="w-full aspect-video flex items-center justify-center">
            {fileInfo?.type.startsWith('video/') ? (
              <video
                ref={playerRef as React.RefObject<HTMLVideoElement>}
                src={audioUrl}
                className="w-full h-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={handlePlay}
                onPause={handlePause}
                controls
              />
            ) : (
              <audio
                ref={playerRef as React.RefObject<HTMLAudioElement>}
                src={audioUrl}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={handlePlay}
                onPause={handlePause}
                className="w-full"
              />
            )}
          </div>
        )}

        {/* Audio-only visualization */}
        {!isYouTube && !fileInfo?.type.startsWith('video/') && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">🎵</div>
              <h3 className="text-white text-xl font-medium">{videoTitle || fileInfo?.name}</h3>
            </div>
          </div>
        )}
      </div>

      {/* Player Controls */}
      <div className="p-4 bg-gray-50 dark:bg-dark-750 border-b border-gray-200 dark:border-dark-700">
        <div className="flex items-center gap-4 mb-4">
          {/* Play/Pause Button */}
          <button
            onClick={togglePlayPause}
            className="w-12 h-12 bg-primary-500 hover:bg-primary-600 text-white rounded-full
                     flex items-center justify-center transition-colors"
          >
            {isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>

          {/* Time Display */}
          <div className="text-sm text-gray-600 dark:text-gray-400 font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>

          {/* Progress Bar */}
          <div className="flex-1 mx-4">
            <div className="relative">
              <div className="w-full h-2 bg-gray-200 dark:bg-dark-600 rounded-full">
                <div
                  className="h-2 bg-primary-500 rounded-full transition-all duration-100"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={duration}
                value={currentTime}
                onChange={(e) => seekTo(Number(e.target.value))}
                className="absolute inset-0 w-full h-2 opacity-0 cursor-pointer"
              />
            </div>
          </div>

          {/* Speed Control */}
          <select
            value={playbackRate}
            onChange={(e) => changePlaybackRate(Number(e.target.value))}
            className="px-2 py-1 bg-gray-100 dark:bg-dark-700 border border-gray-300 dark:border-dark-600
                     rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value={0.5}>0.5x</option>
            <option value={0.75}>0.75x</option>
            <option value={1}>1x</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
          </select>

          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              className="w-16"
            />
          </div>
        </div>

        {/* Secondary Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={repeatCurrentLine}
            className="px-3 py-1.5 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600
                     text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {t('youtubeShadowing.player.repeatLine')}
          </button>

          <button
            onClick={playCurrentLineTTS}
            className="px-3 py-1.5 bg-primary-100 dark:bg-primary-900/30 hover:bg-primary-200
                     dark:hover:bg-primary-900/50 text-primary-700 dark:text-primary-300
                     text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
            </svg>
            {t('youtubeShadowing.player.playTTS')}
          </button>

          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              showTranscript
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600'
            }`}
          >
            {t('youtubeShadowing.player.toggleTranscript')}
          </button>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              autoScroll
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600'
            }`}
          >
            {t('youtubeShadowing.player.autoScroll')}
          </button>
        </div>
      </div>

      {/* Transcript Display */}
      <AnimatePresence>
        {showTranscript && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="max-h-96 overflow-y-auto"
          >
            <div
              ref={transcriptContainerRef}
              className="p-4 space-y-2"
            >
              {transcript.map((line, index) => (
                <div
                  key={line.id}
                  ref={index === currentLineIndex ? currentLineRef : null}
                  onClick={() => jumpToLine(index)}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    index === currentLineIndex
                      ? 'bg-primary-100 dark:bg-primary-900/30 border-l-4 border-primary-500'
                      : 'bg-gray-50 dark:bg-dark-700 hover:bg-gray-100 dark:hover:bg-dark-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xs text-gray-400 font-mono mt-1 flex-shrink-0">
                      {formatTime(line.startTime)}
                    </span>
                    <p className={`flex-1 text-sm leading-relaxed ${
                      index === currentLineIndex
                        ? 'text-gray-900 dark:text-gray-100 font-medium'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {line.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current Line Display (when transcript is hidden) */}
      {!showTranscript && transcript.length > 0 && (
        <div className="p-4 bg-primary-50 dark:bg-primary-900/20 border-t border-gray-200 dark:border-dark-700">
          <div className="text-center">
            <p className="text-lg text-gray-900 dark:text-gray-100 font-medium leading-relaxed">
              {transcript[currentLineIndex]?.text || ''}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {t('youtubeShadowing.player.currentLine')} {currentLineIndex + 1} / {transcript.length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}