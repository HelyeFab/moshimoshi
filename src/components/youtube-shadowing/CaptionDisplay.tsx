/**
 * Caption Display Component
 * Ported from moshi-player with superior UX patterns:
 * - Smart auto-scroll with 100px buffer zones
 * - Current/Full transcript toggle
 * - Click-to-jump with instant seek
 * - Visual hierarchy (Active/Past/Future)
 * - Coming up preview
 */

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TranscriptLine } from '@/types/youtubeShadowing';
import { cn } from '@/lib/utils';

interface CaptionDisplayProps {
  segments: TranscriptLine[];
  currentTime: number;
  onSeekToTime: (time: number) => void;
  showFullTranscript?: boolean;
  source?: 'raw' | 'ai-enhanced';
  showFurigana?: boolean;
  className?: string;
}

export function CaptionDisplay({
  segments,
  currentTime,
  onSeekToTime,
  showFullTranscript = true,
  source = 'raw',
  showFurigana = false,
  className = ''
}: CaptionDisplayProps) {
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  // Find current segment based on video time
  const currentSegment = useMemo(() => {
    return segments.find(seg =>
      currentTime >= seg.startTime && currentTime <= seg.endTime
    );
  }, [segments, currentTime]);

  // Get upcoming segments (next 3)
  const upcomingSegments = useMemo(() => {
    return segments
      .filter(seg => seg.startTime > currentTime)
      .slice(0, 3);
  }, [segments, currentTime]);

  // ═══════════════════════════════════════════════════════
  // SMART AUTO-SCROLL (from moshi-player)
  // ═══════════════════════════════════════════════════════
  useEffect(() => {
    if (!currentSegment || !showFullTranscript) return;

    const segmentKey = `${currentSegment.startTime}`;
    const segmentElement = segmentRefs.current[segmentKey];

    if (segmentElement && transcriptContainerRef.current) {
      const container = transcriptContainerRef.current;
      const elementTop = segmentElement.offsetTop;
      const elementHeight = segmentElement.offsetHeight;
      const containerHeight = container.offsetHeight;
      const containerScrollTop = container.scrollTop;

      // Check if element is not fully visible (100px buffer zones)
      const isElementAboveViewport = elementTop < containerScrollTop + 100;
      const isElementBelowViewport = elementTop + elementHeight > containerScrollTop + containerHeight - 100;

      if (isElementAboveViewport || isElementBelowViewport) {
        // Smooth scroll to CENTER the active segment
        const scrollPosition = elementTop - containerHeight / 2 + elementHeight / 2;
        container.scrollTo({
          top: scrollPosition,
          behavior: 'smooth'
        });
      }
    }
  }, [currentSegment, showFullTranscript]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!segments || segments.length === 0) {
    return (
      <div className={cn('caption-display', className)}>
        <div className="text-center py-8 text-gray-400">
          <p className="text-lg mb-2">📝</p>
          <p>No transcript available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('caption-display', className)}>
      {/* Source Indicator */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {source === 'ai-enhanced' ? (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded-full">
              <span>✨</span>
              AI-Enhanced
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-gray-500/20 text-gray-300 rounded-full">
              <span>📝</span>
              Raw Transcript
            </span>
          )}
          <span className="text-xs text-gray-500">
            {segments.length} segments
          </span>
        </div>
      </div>

      {/* Current + Coming Up View */}
      {!showFullTranscript && (
        <div className="space-y-3">
          {/* Active Caption */}
          {currentSegment ? (
            <motion.div
              key={currentSegment.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-gradient-to-r from-red-500/20 to-red-600/20 rounded-lg border-l-4 border-red-500 shadow-lg"
            >
              <p className="text-white text-base leading-relaxed font-medium">
                {currentSegment.text}
              </p>
              {currentSegment.translation && (
                <p className="text-gray-300 text-sm mt-2 italic">
                  {currentSegment.translation}
                </p>
              )}
              <div className="flex justify-between items-center mt-3 text-xs text-white/60">
                <span>
                  {formatTime(currentSegment.startTime)} - {formatTime(currentSegment.endTime)}
                </span>
                <span className="bg-red-500 px-2 py-0.5 rounded text-white font-semibold">
                  LIVE
                </span>
              </div>
            </motion.div>
          ) : (
            <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700/50 text-center">
              <p className="text-gray-400 text-sm">Waiting for next segment...</p>
            </div>
          )}

          {/* Coming Up Preview */}
          {upcomingSegments.length > 0 && (
            <div className="space-y-2">
              <p className="text-white/60 text-xs font-medium flex items-center gap-2">
                <span>⏭️</span>
                Coming up:
              </p>
              {upcomingSegments.map((segment, index) => (
                <button
                  key={`upcoming-${segment.id}`}
                  onClick={() => onSeekToTime(segment.startTime)}
                  className="w-full text-left p-3 bg-white/5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white text-sm transition-all cursor-pointer border border-white/10 hover:border-white/30"
                  title={`Jump to ${formatTime(segment.startTime)}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-white/40 min-w-[45px] font-mono mt-0.5">
                      {formatTime(segment.startTime)}
                    </span>
                    <span className="flex-1">
                      {segment.text.substring(0, 80)}
                      {segment.text.length > 80 && '...'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Full Transcript View */}
      {showFullTranscript && (
        <div
          ref={transcriptContainerRef}
          className="max-h-[500px] overflow-y-auto bg-black/40 backdrop-blur-sm rounded-lg p-4 space-y-1 border border-white/10 shadow-inner [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          style={{
            scrollBehavior: 'smooth',
          }}
        >
          {/* Header */}
          <div className="mb-3 pb-2 border-b border-white/10 sticky top-0 bg-black/80 backdrop-blur-sm z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/70 text-sm font-medium">
                Full Transcript ({segments.length} segments)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-400 text-xs bg-blue-500/20 px-2 py-1 rounded">
                👆 Click to jump
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Clear video from localStorage
                  const videoId = localStorage.getItem('youtube-shadowing-current-video-id');
                  if (videoId) {
                    localStorage.removeItem(`youtube-transcript-${videoId}`);
                    localStorage.removeItem('youtube-shadowing-current-video-id');
                    localStorage.removeItem('youtube-shadowing-current-video-url');
                    // Reload the page to clear the video
                    window.location.reload();
                  }
                }}
                className="text-red-400 text-xs bg-red-500/20 px-2 py-1 rounded hover:bg-red-500/30 transition-colors"
              >
                🗑️ Clear
              </button>
            </div>
          </div>

          {/* Segments */}
          {segments.map((segment, index) => {
            const isActive = currentTime >= segment.startTime && currentTime <= segment.endTime;
            const isPast = currentTime > segment.endTime;

            return (
              <motion.button
                key={segment.id}
                ref={(el) => {
                  const segmentKey = `${segment.startTime}`;
                  segmentRefs.current[segmentKey] = el;
                }}
                onClick={() => {
                  console.log(`Jumping to segment: ${formatTime(segment.startTime)} - "${segment.text.substring(0, 30)}..."`);
                  onSeekToTime(segment.startTime);
                }}
                className={cn(
                  'w-full text-left p-3 rounded-lg text-sm transition-all cursor-pointer border',
                  isActive
                    ? 'bg-red-500/30 border-red-500 text-white shadow-lg transform scale-[1.02] ring-2 ring-red-500/50'
                    : isPast
                    ? 'text-white/50 hover:text-white/80 border-white/10 hover:border-white/20 hover:bg-white/5'
                    : 'text-white/80 hover:text-white border-white/10 hover:border-white/30 hover:bg-white/10'
                )}
                whileHover={{ scale: isActive ? 1.02 : 1.01 }}
                whileTap={{ scale: 0.99 }}
                title={`Jump to ${formatTime(segment.startTime)}: ${segment.text.substring(0, 50)}...`}
              >
                <div className="flex items-start gap-3">
                  <span className={cn(
                    'text-xs min-w-[50px] mt-0.5 font-mono flex-shrink-0',
                    isActive ? 'text-red-300 font-semibold' : 'text-white/40'
                  )}>
                    {formatTime(segment.startTime)}
                  </span>

                  <div className="flex-1 min-w-0">
                    <span className="leading-relaxed block">
                      {segment.text}
                    </span>
                    {segment.translation && (
                      <span className="text-xs text-white/50 italic mt-1 block">
                        {segment.translation}
                      </span>
                    )}
                  </div>

                  {isActive && (
                    <span className="text-sm text-red-400 mt-0.5 flex-shrink-0 animate-pulse">
                      ▶
                    </span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Toggle button for Current/Full transcript view
 */
interface TranscriptToggleProps {
  showFullTranscript: boolean;
  onToggle: () => void;
  className?: string;
}

export function TranscriptToggle({ showFullTranscript, onToggle, className = '' }: TranscriptToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
        'bg-gray-700 hover:bg-gray-600 text-white border border-gray-600',
        'hover:scale-105 active:scale-95',
        className
      )}
      title={showFullTranscript ? 'Show current segment only' : 'Show full transcript'}
    >
      <span>{showFullTranscript ? '📍' : '📜'}</span>
      <span>{showFullTranscript ? 'Current Only' : 'Full Transcript'}</span>
    </button>
  );
}
