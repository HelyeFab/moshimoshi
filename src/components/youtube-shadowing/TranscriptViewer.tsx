'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause } from 'lucide-react';
import WordExplanationModal from '@/components/word/WordExplanationModal';
import { useWordExplanation } from '@/hooks/useWordExplanation';
import { useToast } from '@/components/ui/Toast/ToastContext';
import Dialog from '@/components/ui/Dialog';

export interface TranscriptLine {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  words?: string[];
  translation?: string;
}

interface TranscriptViewerProps {
  segments: TranscriptLine[];
  currentTime: number;
  onSeekToTime: (time: number) => void;
  showFullTranscript?: boolean;
  source?: 'raw' | 'ai-enhanced';
  showFurigana?: boolean;
  className?: string;
  isPlaying?: boolean;
  onPlayPause?: () => void;
  onClearSession?: () => void;
}

export default function TranscriptViewer({
  segments,
  currentTime,
  onSeekToTime,
  showFullTranscript = true,
  source = 'raw',
  showFurigana = false,
  className = '',
  isPlaying = false,
  onPlayPause,
  onClearSession
}: TranscriptViewerProps) {
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const { showToast } = useToast();

  // State for clear confirmation dialog
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);

  // AI Word lookup
  const [isWordModalOpen, setIsWordModalOpen] = useState(false);
  const {
    explainWord,
    loading: wordLoading,
    error: wordError,
    explanation: wordExplanation,
    currentWord,
    reset: resetWordExplanation
  } = useWordExplanation({
    onError: (error) => {
      showToast(error, 'error');
    }
  });

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

  // Auto-scroll to current segment when it changes
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

  const handleWordClick = async (word: string) => {
    const cleanWord = word.replace(/<[^>]*>/g, '').trim();
    if (!cleanWord || cleanWord.length === 0) return;

    setIsWordModalOpen(true);
    await explainWord(cleanWord);
  };

  const handleCloseWordModal = () => {
    setIsWordModalOpen(false);
    resetWordExplanation();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderSegmentText = (segment: TranscriptLine) => {
    const elements: React.ReactNode[] = [];
    const text = segment.text || '';

    if (segment.words && segment.words.length > 0) {
      let cursor = 0;

      segment.words.forEach((word, index) => {
        if (!word) return;
        const safeWord = word.trim();
        if (!safeWord) return;

        const wordIndex = text.indexOf(safeWord, cursor);

        if (wordIndex === -1) {
          // Fallback: if we can't find the word, skip to generic rendering later
          cursor = text.length;
          return;
        }

        if (wordIndex > cursor) {
          const before = text.slice(cursor, wordIndex);
          elements.push(
            <span key={`${segment.id}-pre-${index}`}>
              {before}
            </span>
          );
        }

        elements.push(
          <span
            key={`${segment.id}-word-${index}`}
            className="word inline-block cursor-pointer rounded px-0.5 hover:bg-primary/20 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              handleWordClick(safeWord);
            }}
          >
            {safeWord}
          </span>
        );

        cursor = wordIndex + safeWord.length;
      });

      if (cursor < text.length) {
        elements.push(
          <span key={`${segment.id}-post`}>
            {text.slice(cursor)}
          </span>
        );
      }

      if (elements.length > 0) {
        return elements;
      }
    }

    const tokens = /\s/.test(text) ? text.split(/(\s+)/) : Array.from(text);

    return tokens.map((token, index) => {
      if (token.trim().length === 0) {
        return (
          <span key={`${segment.id}-ws-${index}`}>
            {token}
          </span>
        );
      }

      return (
        <span
          key={`${segment.id}-char-${index}`}
          className="word inline-block cursor-pointer rounded px-0.5 hover:bg-primary/20 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            handleWordClick(token);
          }}
        >
          {token}
        </span>
      );
    });
  };

  if (!segments || segments.length === 0) {
    return (
      <div className={`caption-display ${className} [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`}>
        <div className="text-center py-8 text-gray-400">
          <p className="text-lg mb-2">📝</p>
          <p>No transcript available</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`caption-display ${className} [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`}>
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
          <div className="space-y-2">
            {/* Header - Outside scrollable area */}
            <div className="bg-black/40 backdrop-blur-sm rounded-lg p-4 border border-white/10">
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
                    // Show confirmation dialog instead of immediately clearing
                    setShowClearConfirmation(true);
                  }}
                  className="text-red-400 text-xs bg-red-500/20 px-2 py-1 rounded hover:bg-red-500/30 transition-colors"
                  title="Clear current video and return to input screen"
                >
                  🗑️ Clear
                </button>
              </div>
            </div>

            {/* Scrollable Transcript Container */}
            <div
              ref={transcriptContainerRef}
              className="max-h-[500px] overflow-y-auto bg-black/40 backdrop-blur-sm rounded-lg p-4 space-y-1 border border-white/10 shadow-inner [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              style={{
                scrollBehavior: 'smooth',
              }}
            >
              {/* Segments */}
              {segments.map((segment, index) => {
              const isActive = currentTime >= segment.startTime && currentTime <= segment.endTime;
              const isPast = currentTime > segment.endTime;

              return (
                <motion.div
                  key={segment.id}
                  ref={(el) => {
                    const segmentKey = `${segment.startTime}`;
                    segmentRefs.current[segmentKey] = el;
                  }}
                  onClick={(e) => {
                    // Check if clicking on text (for word selection)
                    const target = e.target as HTMLElement;
                    if (target.tagName === 'SPAN' && target.classList.contains('word')) {
                      return; // Let word click handler take over
                    }

                    console.log(`Jumping to segment: ${formatTime(segment.startTime)} - "${segment.text.substring(0, 30)}..."`);
                    onSeekToTime(segment.startTime);
                  }}
                  className={`w-full text-left p-3 rounded-lg text-sm transition-all cursor-pointer border ${
                    isActive
                      ? 'bg-red-500/30 border-red-500 text-white shadow-lg transform scale-[1.02] ring-2 ring-red-500/50'
                      : isPast
                      ? 'text-white/50 hover:text-white/80 border-white/10 hover:border-white/20 hover:bg-white/5'
                      : 'text-white/80 hover:text-white border-white/10 hover:border-white/30 hover:bg-white/10'
                  }`}
                  whileHover={{ scale: isActive ? 1.02 : 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  title={`Jump to ${formatTime(segment.startTime)}: ${segment.text.substring(0, 50)}...`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`text-xs min-w-[50px] mt-0.5 font-mono flex-shrink-0 ${
                      isActive ? 'text-red-300 font-semibold' : 'text-white/40'
                    }`}>
                      {formatTime(segment.startTime)}
                    </span>

                    <div className="flex-1 min-w-0 leading-relaxed">
                      {renderSegmentText(segment)}
                      {segment.translation && (
                        <span className="text-xs text-white/50 italic mt-1 block">
                          {segment.translation}
                        </span>
                      )}
                    </div>

                    {isActive && onPlayPause && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlayPause();
                        }}
                        className="text-red-400 hover:text-red-300 transition-colors p-1 hover:bg-red-500/20 rounded-full"
                        title={isPlaying ? 'Pause' : 'Play'}
                      >
                        {isPlaying ? (
                          <Pause className="w-5 h-5" />
                        ) : (
                          <Play className="w-5 h-5" />
                        )}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
            </div>
          </div>
        )}
      </div>

      {/* AI Word Explanation Modal */}
      <WordExplanationModal
        isOpen={isWordModalOpen}
        onClose={handleCloseWordModal}
        word={currentWord || ''}
        explanation={wordExplanation}
        loading={wordLoading}
        error={wordError}
      />

      {/* Clear Confirmation Dialog */}
      <Dialog
        isOpen={showClearConfirmation}
        onClose={() => setShowClearConfirmation(false)}
        onConfirm={() => {
          if (onClearSession) {
            onClearSession();
          }
          setShowClearConfirmation(false);
        }}
        title="Clear Video Session?"
        message="Are you sure you want to clear the current video and return to the input screen? Your progress will be saved locally."
        confirmText="Yes, Clear"
        cancelText="Cancel"
        type="warning"
      />
    </>
  );
}
