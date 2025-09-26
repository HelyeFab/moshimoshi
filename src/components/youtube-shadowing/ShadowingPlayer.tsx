'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { motion } from 'framer-motion';

export interface TranscriptLine {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  words?: string[];
}

interface SimplePlayerProps {
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
}

export default function SimplePlayer({
  videoUrl,
  audioUrl,
  transcript,
  videoTitle,
  isYouTube = false,
  fileInfo
}: SimplePlayerProps) {
  const { t, strings } = useI18n();

  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);

  // Refs
  const playerRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const currentLineRef = useRef<HTMLDivElement>(null);

  // Update current line based on time
  const updateCurrentLine = useCallback((time: number) => {
    const lineIndex = transcript.findIndex((line, index) => {
      const nextLine = transcript[index + 1];
      return time >= line.startTime && (!nextLine || time < nextLine.startTime);
    });

    if (lineIndex !== -1 && lineIndex !== currentLineIndex) {
      setCurrentLineIndex(lineIndex);

      // Auto-scroll to current line
      if (currentLineRef.current) {
        currentLineRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [transcript, currentLineIndex]);

  // Media player event handlers
  const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLMediaElement>) => {
    const time = e.currentTarget.currentTime;
    setCurrentTime(time);
    updateCurrentLine(time);
  }, [updateCurrentLine]);

  const handleLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLMediaElement>) => {
    setDuration(e.currentTarget.duration);
  }, []);

  const handlePlay = useCallback(() => setIsPlaying(true), []);
  const handlePause = useCallback(() => setIsPlaying(false), []);

  // Player controls
  const togglePlayPause = useCallback(() => {
    if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.pause();
      } else {
        playerRef.current.play();
      }
    }
  }, [isPlaying]);

  const seekTo = useCallback((time: number) => {
    if (playerRef.current) {
      playerRef.current.currentTime = time;
    }
    setCurrentTime(time);
  }, []);

  const jumpToLine = useCallback((lineIndex: number) => {
    if (lineIndex >= 0 && lineIndex < transcript.length) {
      const line = transcript[lineIndex];
      seekTo(line.startTime);
      setCurrentLineIndex(lineIndex);
    }
  }, [transcript, seekTo]);

  // Format time display
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return (
    <div className="bg-gray-50 dark:bg-dark-800 rounded-xl shadow-lg border border-gray-200 dark:border-dark-700 overflow-hidden">
      {/* Video Title */}
      {videoTitle && (
        <div className="p-4 bg-primary-50 dark:bg-primary-900/20 border-b border-gray-200 dark:border-dark-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
            {videoTitle}
          </h3>
        </div>
      )}

      {/* Media Player */}
      <div className="p-4">
        {isYouTube ? (
          // YouTube Embed (Simple iframe)
          <div className="relative w-full aspect-video mb-4">
            <iframe
              src={`https://www.youtube.com/embed/${extractYouTubeVideoId(videoUrl)}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
              className="w-full h-full rounded-lg"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          // HTML5 Video/Audio Player
          <div className="mb-4">
            {fileInfo?.type.startsWith('video/') ? (
              <video
                ref={playerRef as React.RefObject<HTMLVideoElement>}
                src={audioUrl}
                className="w-full rounded-lg"
                controls
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={handlePlay}
                onPause={handlePause}
              />
            ) : (
              <div className="bg-gray-100 dark:bg-dark-700 rounded-lg p-8">
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">🎵</div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {videoTitle || fileInfo?.name || t('youtubeShadowing.audioFile')}
                  </h4>
                </div>
                <audio
                  ref={playerRef as React.RefObject<HTMLAudioElement>}
                  src={audioUrl}
                  className="w-full"
                  controls
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onPlay={handlePlay}
                  onPause={handlePause}
                />
              </div>
            )}
          </div>
        )}

        {/* Simple Controls */}
        {!isYouTube && (
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={togglePlayPause}
              className="w-10 h-10 bg-primary-500 hover:bg-primary-600 text-white rounded-full
                       flex items-center justify-center transition-colors"
            >
              {isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>

            <div className="text-sm text-gray-600 dark:text-gray-400 font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>

            <div className="flex-1">
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
          </div>
        )}

        {/* Current Line Display */}
        {transcript.length > 0 && (
          <div className="mb-4 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {t('youtubeShadowing.player.currentLine')} {currentLineIndex + 1} / {transcript.length}
              </p>
              <p className="text-lg text-gray-900 dark:text-gray-100 font-medium leading-relaxed">
                {transcript[currentLineIndex]?.text || t('youtubeShadowing.player.noTranscript')}
              </p>
              <p className="text-xs text-gray-400 mt-2 font-mono">
                {transcript[currentLineIndex] && formatTime(transcript[currentLineIndex].startTime)}
              </p>
            </div>
          </div>
        )}

        {/* Transcript List */}
        {transcript.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t('youtubeShadowing.transcript.title')}
            </h4>

            <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 dark:border-dark-600 rounded-lg p-3">
              {transcript.map((line, index) => (
                <motion.div
                  key={line.id}
                  ref={index === currentLineIndex ? currentLineRef : null}
                  onClick={() => jumpToLine(index)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className={`p-2 rounded cursor-pointer transition-all ${
                    index === currentLineIndex
                      ? 'bg-primary-100 dark:bg-primary-900/30 border-l-3 border-primary-500'
                      : 'bg-gray-50 dark:bg-dark-700 hover:bg-gray-100 dark:hover:bg-dark-600'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-gray-400 font-mono mt-0.5 flex-shrink-0 min-w-[3rem]">
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
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* No transcript message */}
        {transcript.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              {t('youtubeShadowing.transcript.noTranscript')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to extract YouTube video ID
function extractYouTubeVideoId(url: string): string | null {
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
}