'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, RotateCw, Volume2, Eye, Sparkles } from 'lucide-react';
import type { FlashcardContent, CardStyle, AnimationSpeed } from '@/types/flashcards';
import { useI18n } from '@/i18n/I18nContext';
import { useTTS } from '@/hooks/useTTS';
import { cn } from '@/lib/utils';

interface FlashcardViewerProps {
  card: FlashcardContent;
  cardStyle?: CardStyle;
  animationSpeed?: AnimationSpeed;
  showHints?: boolean;
  autoPlayAudio?: boolean;
  onNext?: () => void;
  onPrevious?: () => void;
  onFlip?: () => void;
  onResponse?: (correct: boolean, difficulty?: 'again' | 'hard' | 'good' | 'easy') => void;
}

const ANIMATION_SPEEDS = {
  slow: 0.6,
  normal: 0.4,
  fast: 0.2
};

export function FlashcardViewer({
  card,
  cardStyle = 'minimal',
  animationSpeed = 'normal',
  showHints = false,
  autoPlayAudio = false,
  onNext,
  onPrevious,
  onFlip,
  onResponse
}: FlashcardViewerProps) {
  const { t } = useI18n();
  const { play, loading: ttsLoading, preload } = useTTS({ cacheFirst: true });
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);

  const speed = ANIMATION_SPEEDS[animationSpeed];

  // Reset flip state when card changes
  useEffect(() => {
    setIsFlipped(false);
    setShowHint(false);
    setCurrentHintIndex(0);
  }, [card.id]);

  // Auto-play audio if enabled
  useEffect(() => {
    if (autoPlayAudio && card.metadata?.audioUrl) {
      const audio = new Audio(card.metadata.audioUrl);
      audio.play().catch(() => {});
    }
  }, [card.id, autoPlayAudio, card.metadata?.audioUrl]);

  const handleFlip = useCallback(() => {
    setIsFlipped(!isFlipped);
    onFlip?.();
  }, [isFlipped, onFlip]);

  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case ' ':
        e.preventDefault();
        handleFlip();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        onPrevious?.();
        break;
      case 'ArrowRight':
        e.preventDefault();
        onNext?.();
        break;
      case '1':
        onResponse?.(false, 'again');
        break;
      case '2':
        onResponse?.(false, 'hard');
        break;
      case '3':
        onResponse?.(true, 'good');
        break;
      case '4':
        onResponse?.(true, 'easy');
        break;
    }
  }, [handleFlip, onNext, onPrevious, onResponse]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  const playAudio = async () => {
    if (audioPlaying) return;

    // Determine what text to play based on which side is showing
    const textToPlay = isFlipped ? card.back.text : card.front.text;

    if (!textToPlay) return;

    setAudioPlaying(true);

    try {
      // If there's a custom audio URL, use it
      if (card.metadata?.audioUrl) {
        const audio = new Audio(card.metadata.audioUrl);
        await audio.play();
      } else {
        // Detect if text is Japanese (has hiragana, katakana, or kanji)
        const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(textToPlay);

        // Use appropriate voice based on content
        const voice = isJapanese ? 'ja-JP' : 'en-US';

        await play(textToPlay, {
          voice,
          rate: 0.9,  // Slightly slower for learning
          pitch: 1.0
        });
      }
    } catch (error) {
      console.error('Failed to play audio:', error);
      // Silently fail - audio is not critical for flashcard functionality
      // User can still continue studying without audio
    } finally {
      setAudioPlaying(false);
    }
  };

  // Preload audio for both sides when card loads
  useEffect(() => {
    const preloadTexts = async () => {
      try {
        const texts = [];

        if (card.front.text) {
          texts.push(card.front.text);
        }
        if (card.back.text) {
          texts.push(card.back.text);
        }

        if (texts.length > 0) {
          // Check if any text is Japanese
          const hasJapanese = texts.some(text =>
            /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)
          );

          // Preload all texts at once with appropriate voice
          await preload(texts, {
            voice: hasJapanese ? 'ja-JP' : 'en-US',
            rate: 0.9,
            pitch: 1.0
          }).catch(() => {
            // Silently ignore preload errors - not critical
            console.debug('Preload failed for flashcard texts');
          });
        }
      } catch (error) {
        // Ignore preload errors
        console.debug('Preload error:', error);
      }
    };

    preloadTexts();
  }, [card, preload]);

  const getCardStyleClasses = () => {
    switch (cardStyle) {
      case 'decorated':
        return 'bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 border-2 border-primary-200 dark:border-primary-700 shadow-xl';
      case 'themed':
        return 'bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 text-white shadow-2xl';
      case 'minimal':
      default:
        return 'bg-white dark:bg-dark-800 border border-gray-200 dark:border-gray-700 shadow-lg';
    }
  };

  const cardVariants = {
    front: {
      rotateY: 0,
      transition: { duration: speed, type: 'spring', stiffness: 200, damping: 20 }
    },
    back: {
      rotateY: 180,
      transition: { duration: speed, type: 'spring', stiffness: 200, damping: 20 }
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="relative h-96 md:h-[450px] perspective-1000">
        <motion.div
          className="absolute inset-0 w-full h-full cursor-pointer preserve-3d"
          animate={isFlipped ? 'back' : 'front'}
          variants={cardVariants}
          onClick={handleFlip}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {/* Front Side */}
          <div
            className={cn(
              'absolute inset-0 w-full h-full rounded-2xl p-8 flex flex-col items-center justify-center backface-hidden',
              getCardStyleClasses()
            )}
          >
            {card.front.media && card.front.media.type === 'image' && (
              <img
                src={card.front.media.url}
                alt={card.front.media.alt || ''}
                className="max-w-full max-h-32 mb-4 rounded-lg"
              />
            )}

            <h2 className={cn(
              'text-3xl md:text-4xl font-bold text-center mb-4',
              cardStyle === 'themed' ? 'text-white' : 'text-gray-900 dark:text-gray-100'
            )}>
              {card.front.text}
            </h2>

            {card.front.subtext && (
              <p className={cn(
                'text-lg md:text-xl text-center',
                cardStyle === 'themed' ? 'text-white/90' : 'text-gray-600 dark:text-gray-400'
              )}>
                {card.front.subtext}
              </p>
            )}

            <div className="absolute bottom-4 right-4 flex gap-2">
              {(card.metadata?.audioUrl || card.front.text) && (
                <button
                  onClick={(e) => { e.stopPropagation(); playAudio(); }}
                  className="p-2 rounded-full bg-primary-100 dark:bg-primary-900/30 hover:bg-primary-200 dark:hover:bg-primary-800/50 transition-colors"
                  aria-label={t('common.playAudio')}
                >
                  <Volume2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </button>
              )}

              {showHints && !isFlipped && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowHint(!showHint); }}
                  className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-800/50 transition-colors"
                  aria-label={t('common.hint')}
                >
                  <Eye className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </button>
              )}
            </div>

            <div className="absolute top-4 left-4">
              <Sparkles className="w-6 h-6 text-primary-400 animate-pulse" />
            </div>

            {/* Hint Overlay */}
            <AnimatePresence>
              {showHint && !isFlipped && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute inset-4 bg-yellow-50 dark:bg-yellow-900/20 backdrop-blur-sm rounded-xl p-6 flex flex-col items-center justify-center border-2 border-yellow-200 dark:border-yellow-800"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-center">
                    <Eye className="w-8 h-8 text-yellow-600 dark:text-yellow-400 mx-auto mb-3" />
                    <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                      {t('common.hint')}
                    </p>
                    <p className="text-gray-700 dark:text-gray-300">
                      {(() => {
                        // Show custom hints if available
                        if (card.metadata?.hints) {
                          return Array.isArray(card.metadata.hints)
                            ? card.metadata.hints[currentHintIndex]
                            : card.metadata.hints;
                        }
                        // Fallback: show first few characters of the answer
                        const answer = card.back.text;
                        if (answer.length <= 3) {
                          return `${answer.charAt(0)}...`;
                        } else if (answer.length <= 10) {
                          return `${answer.substring(0, 2)}...`;
                        } else {
                          return `${answer.substring(0, 3)}... (${answer.length} characters)`;
                        }
                      })()}
                    </p>
                    {Array.isArray(card.metadata?.hints) && card.metadata.hints.length > 1 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        {currentHintIndex + 1} / {card.metadata.hints.length}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setShowHint(false)}
                    className="mt-4 px-4 py-2 bg-yellow-200 dark:bg-yellow-800 rounded-lg text-yellow-800 dark:text-yellow-200 hover:bg-yellow-300 dark:hover:bg-yellow-700 transition-colors"
                  >
                    {t('common.close')}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Back Side */}
          <div
            className={cn(
              'absolute inset-0 w-full h-full rounded-2xl p-8 flex flex-col items-center justify-center backface-hidden rotate-y-180',
              getCardStyleClasses()
            )}
          >
            {card.back.media && card.back.media.type === 'image' && (
              <img
                src={card.back.media.url}
                alt={card.back.media.alt || ''}
                className="max-w-full max-h-32 mb-4 rounded-lg"
              />
            )}

            <h2 className={cn(
              'text-3xl md:text-4xl font-bold text-center mb-4',
              cardStyle === 'themed' ? 'text-white' : 'text-gray-900 dark:text-gray-100'
            )}>
              {card.back.text}
            </h2>

            {card.back.subtext && (
              <p className={cn(
                'text-lg md:text-xl text-center',
                cardStyle === 'themed' ? 'text-white/90' : 'text-gray-600 dark:text-gray-400'
              )}>
                {card.back.subtext}
              </p>
            )}

            {card.metadata?.notes && (
              <p className={cn(
                'text-sm mt-4 text-center italic',
                cardStyle === 'themed' ? 'text-white/80' : 'text-gray-500 dark:text-gray-500'
              )}>
                {card.metadata.notes}
              </p>
            )}

            <div className="absolute bottom-4 right-4">
              {(card.metadata?.audioUrl || card.back.text) && (
                <button
                  onClick={(e) => { e.stopPropagation(); playAudio(); }}
                  className="p-2 rounded-full bg-primary-100 dark:bg-primary-900/30 hover:bg-primary-200 dark:hover:bg-primary-800/50 transition-colors"
                  aria-label={t('common.playAudio')}
                >
                  <Volume2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mt-8">
        <button
          onClick={onPrevious}
          disabled={!onPrevious}
          className="p-3 rounded-full bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label={t('flashcards.previousCard')}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <button
          onClick={handleFlip}
          className="px-6 py-3 rounded-full bg-primary-500 text-white hover:bg-primary-600 transition-colors flex items-center gap-2 font-medium"
        >
          <RotateCw className="w-5 h-5" />
          {t('flashcards.flipCard')}
        </button>

        <button
          onClick={onNext}
          disabled={!onNext}
          className="p-3 rounded-full bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label={t('flashcards.nextCard')}
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Difficulty Buttons (shown after flip) */}
      <AnimatePresence>
        {isFlipped && onResponse && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex justify-center gap-3 mt-6"
          >
            <button
              onClick={() => onResponse(false, 'again')}
              className="px-4 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors font-medium"
            >
              {t('flashcards.difficulty.again')}
            </button>
            <button
              onClick={() => onResponse(false, 'hard')}
              className="px-4 py-2 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-800/50 transition-colors font-medium"
            >
              {t('flashcards.difficulty.hard')}
            </button>
            <button
              onClick={() => onResponse(true, 'good')}
              className="px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors font-medium"
            >
              {t('flashcards.difficulty.good')}
            </button>
            <button
              onClick={() => onResponse(true, 'easy')}
              className="px-4 py-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors font-medium"
            >
              {t('flashcards.difficulty.easy')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Add required styles to globals.css for 3D transforms
const requiredStyles = `
.perspective-1000 {
  perspective: 1000px;
}

.preserve-3d {
  transform-style: preserve-3d;
}

.backface-hidden {
  backface-visibility: hidden;
}

.rotate-y-180 {
  transform: rotateY(180deg);
}
`;