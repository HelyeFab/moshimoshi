'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import WordExplanationModal from '@/components/word/WordExplanationModal';
import { useWordExplanation } from '@/hooks/useWordExplanation';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { GrammarHighlightedText } from '@/components/reading/GrammarHighlightedText';

export interface TranscriptLine {
  id?: string;
  text: string;
  startTime: number;
  endTime: number;
  words?: string[];
  translation?: string;
}

export interface TranscriptViewerProps {
  segments?: TranscriptLine[]; // Can provide segments directly
  videoId?: string; // Or provide videoId to fetch
  currentTime: number;
  showFullTranscript?: boolean;
  source?: 'raw' | 'ai-enhanced';
  showFurigana?: boolean;
  showGrammar?: boolean;
  grammarMode?: 'none' | 'all' | 'content' | 'grammar';
  isVisible?: boolean;
  className?: string;
  onSeekToTime?: (seconds: number) => void;
  isPlaying?: boolean;
  onPlayPause?: () => void;
  onTranscriptLoaded?: (
    segments: TranscriptLine[],
    info?: {
      title?: string;
      language?: string;
      source?: string;
      cached?: boolean;
      totalSegments?: number;
    }
  ) => void; // Callback when transcript loads
}

interface TranscriptData {
  available: boolean;
  videoId: string;
  title?: string;
  segments?: TranscriptLine[];
  language?: string;
  availableLanguages?: string[];
  source?: 'firebase-cache' | 'youtubei-enhanced' | 'youtubei-standard' | 'supa-api';
  cached?: boolean;
  totalSegments?: number;
  totalDuration?: number;
  message?: string;
  error?: string;
}

/**
 * TranscriptViewer Component for Moshimoshi
 * Displays YouTube transcripts with theme-aware styling and AI word tap
 * Based on moshi-player Caption component with Moshimoshi enhancements
 */
export default function TranscriptViewerNew({
  segments: providedSegments,
  videoId,
  currentTime,
  showFullTranscript: initialShowFullTranscript = true,
  source = 'raw',
  showFurigana = true,
  showGrammar = false,
  grammarMode = 'content',
  isVisible = true,
  className = '',
  onSeekToTime,
  isPlaying = false,
  onPlayPause,
  onTranscriptLoaded,
}: TranscriptViewerProps) {
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullTranscript, setShowFullTranscript] = useState(initialShowFullTranscript);
  const { showToast } = useToast();

  // Refs for auto-scroll functionality
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const lastLoggedVideoRef = useRef<string | null>(null);

  // AI Word lookup - Moshimoshi feature
  const [isWordModalOpen, setIsWordModalOpen] = useState(false);
  const {
    explainWord,
    loading: wordLoading,
    error: wordError,
    explanation: wordExplanation,
    currentWord,
    reset: resetWordExplanation,
  } = useWordExplanation({
    onError: (error) => {
      showToast(error, 'error');
    },
  });

  const normalizeSegments = useCallback((rawSegments: any[]): TranscriptLine[] => {
    if (!Array.isArray(rawSegments)) return [];

    return rawSegments.map((segment, index) => {
      const fallbackStart =
        typeof segment.start === 'number'
          ? segment.start
          : typeof segment.startTime === 'number'
            ? segment.startTime
            : 0;
      const fallbackEnd =
        typeof segment.end === 'number'
          ? segment.end
          : typeof segment.endTime === 'number'
            ? segment.endTime
            : fallbackStart;

      const startTime = typeof segment.startTime === 'number' ? segment.startTime : fallbackStart;
      const endTime = typeof segment.endTime === 'number' ? segment.endTime : fallbackEnd;

      return {
        id: segment.id ?? String(index + 1),
        text: segment.text ?? '',
        startTime,
        endTime,
        words: segment.words,
        translation: segment.translation,
      };
    });
  }, []);

  // Use provided segments or fetch from API
  useEffect(() => {
    // If segments are provided directly, use them
    if (providedSegments && providedSegments.length > 0) {
      console.log(`[TranscriptViewer] Using provided segments: ${providedSegments.length}`);
      setTranscript({
        available: true,
        videoId: videoId || '',
        segments: normalizeSegments(providedSegments),
        totalSegments: providedSegments.length,
        source: 'provided',
      });
      setLoading(false);
      setError(null);
      return;
    }

    // Otherwise fetch from API if videoId is available
    if (!videoId) {
      console.log('[TranscriptViewer] No videoId or segments provided');
      setTranscript(null);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchTranscript = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log(`[TranscriptViewer] Fetching transcript for ${videoId}`);
        const response = await fetch(`/api/youtube/transcript/${videoId}`);
        const data: TranscriptData = await response.json();

        if (response.ok && data.available) {
          const normalizedSegments = normalizeSegments(data.segments || []);
          const totalSegments = normalizedSegments.length;

          setTranscript({
            ...data,
            segments: normalizedSegments,
            totalSegments,
          });
          console.log(`[TranscriptViewer] ✅ Loaded transcript: ${totalSegments} segments from ${data.source}`);

          // Notify parent component to cache the transcript
          if (onTranscriptLoaded && normalizedSegments.length > 0) {
            onTranscriptLoaded(normalizedSegments, {
              title: data.title,
              language: data.language,
              source: data.source,
              cached: data.cached,
              totalSegments,
            });
          }
        } else {
          const message = data.message || data.error || 'No transcript available for this video';
          throw new Error(message);
        }
      } catch (err) {
        console.error('[TranscriptViewer] Error fetching transcript:', err);
        setError(err instanceof Error ? err.message : 'Failed to load transcript');
      } finally {
        setLoading(false);
      }
    };

    fetchTranscript();
  }, [providedSegments, videoId, normalizeSegments, onTranscriptLoaded]);

  // Reset timing log when video changes
  useEffect(() => {
    lastLoggedVideoRef.current = null;
  }, [videoId]);

  // Determine which segments to use
  const segments = providedSegments && providedSegments.length > 0
    ? normalizeSegments(providedSegments)
    : transcript?.segments || [];

  // Find current caption segment based on video time
  const currentSegment = useMemo(() => {
    if (!segments || segments.length === 0) return null;
    return segments.find(
      (segment) => currentTime >= segment.startTime && currentTime <= segment.endTime
    );
  }, [segments, currentTime]);

  // Get upcoming segments (next 3)
  const upcomingSegments = useMemo(() => {
    if (!segments || segments.length === 0) return [];
    return segments.filter((segment) => segment.startTime > currentTime).slice(0, 3);
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
        // Smooth scroll to center the active segment
        const scrollPosition = elementTop - containerHeight / 2 + elementHeight / 2;
        container.scrollTo({
          top: scrollPosition,
          behavior: 'smooth',
        });
      }
    }
  }, [currentSegment, showFullTranscript]);

  // AI word tap handler - Moshimoshi feature
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

  // Format time in MM:SS format
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Render segment text with word-level tapping for Japanese
  const renderSegmentText = (segment: TranscriptLine) => {
    const elements: React.ReactNode[] = [];
    const text = segment.text || '';

    // If we have word segmentation, use it for tapping
    if (segment.words && segment.words.length > 0) {
      let cursor = 0;

      segment.words.forEach((word, index) => {
        if (!word) return;
        const safeWord = word.trim();
        if (!safeWord) return;

        const wordIndex = text.indexOf(safeWord, cursor);
        if (wordIndex === -1) {
          cursor = text.length;
          return;
        }

        // Add text before word
        if (wordIndex > cursor) {
          const before = text.slice(cursor, wordIndex);
          elements.push(<span key={`pre-${index}`}>{before}</span>);
        }

        // Add tappable word
        elements.push(
          <span
            key={`word-${index}`}
            className="inline-block cursor-pointer rounded px-0.5 hover:bg-primary-500/20 transition-colors"
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

      // Add remaining text
      if (cursor < text.length) {
        elements.push(<span key="post">{text.slice(cursor)}</span>);
      }

      if (elements.length > 0) {
        return elements;
      }
    }

    // Fallback: Split by whitespace or characters for Japanese
    const tokens = /\s/.test(text) ? text.split(/(\s+)/) : Array.from(text);

    return tokens.map((token, index) => {
      if (token.trim().length === 0) {
        return <span key={`ws-${index}`}>{token}</span>;
      }

      return (
        <span
          key={`char-${index}`}
          className="inline-block cursor-pointer rounded px-0.5 hover:bg-primary-500/20 transition-colors"
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

  // Loading state
  if (loading) {
    return (
      <div className={`caption-component ${className}`}>
        <div className="flex items-center justify-center p-4 bg-dark-800/70 backdrop-blur-sm rounded-lg border border-white/10">
          <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full mr-2"></div>
          <span className="text-dark-50 text-sm">Loading transcript...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error || (transcript && !transcript.available)) {
    return (
      <div className={`caption-component ${className}`}>
        <div className="p-4 bg-dark-800/70 backdrop-blur-sm rounded-lg border border-yellow-500/30 text-center space-y-3">
          <p className="text-yellow-300 text-sm mb-2">⚠️ Transcript not available</p>
          <p className="text-dark-300 text-xs">
            {error || transcript?.message || 'This video does not have transcripts enabled'}
          </p>
        </div>
      </div>
    );
  }

  // Check if we have no segments at all
  if (segments.length === 0 && !loading) {
    return (
      <div className={`caption-component ${className}`}>
        <div className="p-4 bg-dark-800/70 backdrop-blur-sm rounded-lg border border-white/10 text-center space-y-3">
          <p className="text-dark-300 text-sm">📝 No transcript available</p>
        </div>
      </div>
    );
  }

  if (!isVisible) return null;

  // Don't render if we have no segments at all
  if (!transcript && segments.length === 0) {
    return null;
  }

  return (
    <>
      <div className={`caption-component ${className} [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`}>
        {/* Current Caption Display - ALWAYS VISIBLE */}
        <div className="mb-6">
          {currentSegment ? (
            <motion.div
              key={currentSegment.startTime}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 bg-gradient-to-r from-primary-500/20 to-primary-600/20 rounded-xl border-l-4 border-primary-500 shadow-lg"
            >
              <div className="text-dark-50 text-lg leading-relaxed font-medium mb-3">
                <GrammarHighlightedText
                  text={currentSegment.text}
                  highlightMode={showGrammar ? grammarMode : 'none'}
                  showFurigana={showFurigana}
                  className="text-lg"
                />
              </div>
              <div className="flex justify-between items-center text-xs text-dark-300">
                <span>
                  {formatTime(currentSegment.startTime)} - {formatTime(currentSegment.endTime)}
                </span>
                <span className="bg-primary-500 px-2 py-0.5 rounded text-white font-semibold">
                  LIVE
                </span>
              </div>
            </motion.div>
          ) : (
            <div className="p-6 bg-dark-800/50 rounded-xl border border-dark-700/50 text-center">
              <p className="text-dark-400 text-sm">Waiting for next segment...</p>
            </div>
          )}
        </div>

        {/* Upcoming Segments Preview - Only in "Current" mode */}
        {!showFullTranscript && upcomingSegments.length > 0 && (
          <div className="space-y-3">
            <div className="space-y-2">
              <p className="text-dark-300 text-xs font-medium flex items-center gap-2">
                <span>⏭️</span>
                Coming up:
                </p>
                {upcomingSegments.map((segment, index) => (
                  <button
                    key={`upcoming-${segment.startTime}-${index}`}
                    onClick={() => onSeekToTime?.(segment.startTime)}
                    className="w-full text-left p-3 bg-white/5 hover:bg-white/10 rounded-lg text-dark-300 hover:text-dark-50 text-sm transition-all cursor-pointer border border-white/10 hover:border-white/30"
                    title={`Jump to ${formatTime(segment.startTime)}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-dark-400 min-w-[45px] font-mono mt-0.5">
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
          </div>
        )}

        {/* Full Transcript View */}
        {showFullTranscript && (
          <div className="space-y-2">


            {/* Scrollable Transcript Container */}
            <div
              ref={transcriptContainerRef}
              className="max-h-[500px] overflow-y-auto bg-dark-800/40 backdrop-blur-sm rounded-lg p-4 space-y-1 border border-white/10 shadow-inner [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              style={{ scrollBehavior: 'smooth' }}
            >
              {segments.map((segment, index) => {
                const isActive = currentTime >= segment.startTime && currentTime <= segment.endTime;
                const isPast = currentTime > segment.endTime;

                return (
                  <motion.button
                    key={`${segment.startTime}-${index}`}
                    ref={(el) => {
                      const segmentKey = `${segment.startTime}`;
                      segmentRefs.current[segmentKey] = el;
                    }}
                    onClick={(e) => {
                      // Check if clicking on text (for word selection)
                      const target = e.target as HTMLElement;
                      if (target.tagName === 'SPAN' && target.className.includes('cursor-pointer')) {
                        return; // Let word click handler take over
                      }

                      console.log(
                        `Jumping to segment: ${formatTime(segment.startTime)} - "${segment.text.substring(0, 30)}..."`
                      );
                      onSeekToTime?.(segment.startTime);
                    }}
                    className={`w-full text-left p-3 rounded-lg text-sm transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-[#34464d] border-primary-500 text-dark-50 shadow-lg transform scale-[1.02] ring-2 ring-primary-500/50'
                        : isPast
                        ? 'text-dark-400 hover:text-dark-200 border-white/10 hover:border-white/20 hover:bg-white/5'
                        : 'text-dark-200 hover:text-dark-50 border-white/10 hover:border-white/30 hover:bg-white/10'
                    }`}
                    whileHover={{ scale: isActive ? 1.02 : 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    title={`Jump to ${formatTime(segment.startTime)}: ${segment.text.substring(0, 50)}...`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`text-xs min-w-[50px] mt-0.5 font-mono flex-shrink-0 ${
                          isActive ? 'text-primary-300 font-semibold' : 'text-dark-400'
                        }`}
                      >
                        {formatTime(segment.startTime)}
                      </span>

                      <div className="flex-1 min-w-0 leading-relaxed">{renderSegmentText(segment)}</div>

                      {isActive && (
                        <span className="text-xs text-primary-400 mt-0.5">▶</span>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        {/* Transcript Stats - Theme aware */}
        {segments.length > 0 && (
          <div className="mt-2 text-xs text-dark-400 text-center">
            {segments.length} segments
            {segments[segments.length - 1] && (
              <> • {formatTime(segments[segments.length - 1].endTime)} total</>
            )}
            {source && source !== 'raw' && (
              <>
                <br />
                Source: {source}
              </>
            )}
          </div>
        )}
      </div>

      {/* AI Word Explanation Modal - Moshimoshi feature */}
      <WordExplanationModal
        isOpen={isWordModalOpen}
        onClose={handleCloseWordModal}
        word={currentWord || ''}
        explanation={wordExplanation}
        loading={wordLoading}
        error={wordError}
      />
    </>
  );
}
