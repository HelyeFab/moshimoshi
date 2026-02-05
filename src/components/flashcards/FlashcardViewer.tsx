'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, RotateCw, Trash2, Volume2 } from 'lucide-react';
import type { FlashcardContent, CardStyle, AnimationSpeed } from '@/types/flashcards';
import { useI18n } from '@/i18n/I18nContext';
import { useTTS } from '@/hooks/useTTS';
import { cn } from '@/lib/utils';
import { useMediaHydration } from '@/hooks/useMediaHydration';
import { stripFurigana } from '@/lib/flashcards/furiganaUtils';

interface FlashcardViewerProps {
  card: FlashcardContent;
  cardStyle?: CardStyle;
  animationSpeed?: AnimationSpeed;
  showHints?: boolean;
  autoPlayAudio?: boolean;
  isGraded?: boolean;
  initialIsFlipped?: boolean;
  furiganaSettings?: {
    enabled: boolean;
    showOnFront: boolean;
    showOnBack: boolean;
  };
  onDelete?: () => void;
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
  isGraded = false,
  initialIsFlipped = false,
  furiganaSettings,
  onDelete,
  onNext,
  onPrevious,
  onFlip,
  onResponse
}: FlashcardViewerProps) {
  const { t } = useI18n();
  const { play, preload } = useTTS({ cacheFirst: true });

  // Lazy hydration: Load media on-demand as card is displayed
  const hydratedCard = useMediaHydration(card);

  // Check if this is a JlabNote card
  const jlabFields = (hydratedCard as any).jlabFields;
  const isJlabCard = !!jlabFields;

  // Handle both string format (Anki cards) and object format (regular cards)
  const resolvedFrontText =
    (typeof hydratedCard.front === 'string' ? hydratedCard.front : hydratedCard.front?.text) ||
    (hydratedCard as { expression?: string }).expression ||
    hydratedCard.metadata?.expression ||
    (hydratedCard as { sentence?: string }).sentence ||
    hydratedCard.metadata?.sentence ||
    '';
  const resolvedBackText =
    (typeof hydratedCard.back === 'string' ? hydratedCard.back : hydratedCard.back?.text) ||
    (hydratedCard as { meaning?: string }).meaning ||
    hydratedCard.metadata?.meaning ||
    '';


  const resolvedFuriganaFront =
    hydratedCard.metadata?.furiganaFront ||
    (hydratedCard as { furiganaFront?: string }).furiganaFront;
  const resolvedFuriganaBack =
    hydratedCard.metadata?.furiganaBack ||
    (hydratedCard as { furiganaBack?: string }).furiganaBack;
  const resolvedAudioUrl =
    hydratedCard.metadata?.audioUrl ||
    (hydratedCard as { audioUrl?: string }).audioUrl;

  const [isFlipped, setIsFlipped] = useState(initialIsFlipped);
  const [hasGraded, setHasGraded] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const hasAutoPlayedListen = useRef(false);
  const autoPlayTimeoutRef = useRef<number | null>(null);
  const contentSectionRef = useRef<HTMLDivElement>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const pointerMovedRef = useRef(false);

  const speed = ANIMATION_SPEEDS[animationSpeed];

  // Desktop detection for keyboard shortcuts (same as kanji mastery)
  const isDesktopShortcutsEnabled = useCallback(() => {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia) {
      return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    }
    return window.innerWidth >= 768;
  }, []);

  // Debug scrolling
  useEffect(() => {
    if (contentSectionRef.current) {
      const el = contentSectionRef.current;
      console.log('Content Section Debug:', {
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
        offsetHeight: el.offsetHeight,
        isScrollable: el.scrollHeight > el.clientHeight,
        computedStyle: {
          overflow: window.getComputedStyle(el).overflow,
          overflowY: window.getComputedStyle(el).overflowY,
          height: window.getComputedStyle(el).height,
          minHeight: window.getComputedStyle(el).minHeight,
        }
      });
    }
  }, [card.id, isFlipped]);

  // Reset state when card changes
  useEffect(() => {
    setIsFlipped(initialIsFlipped);
    setHasGraded(isGraded);
    hasAutoPlayedListen.current = false;
  }, [card.id, initialIsFlipped, isGraded]);
  useEffect(() => {
    setHasGraded(isGraded);
  }, [isGraded]);

  // Helper function to detect if text contains Japanese characters
  const isJapaneseText = useCallback((text: string): boolean => {
    const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
    return japaneseRegex.test(text);
  }, []);

  const effectiveFurigana = furiganaSettings ?? {
    enabled: true,
    showOnFront: true,
    showOnBack: true,
  };

  const applyAnkiCloze = useCallback((html: string, mode: 'front' | 'back'): string => {
    const withCloze = html.replace(/\{\{c\d+::([\s\S]*?)(::([\s\S]*?))?\}\}/g, (_match, text, _hintPart, hint) => {
      if (mode === 'front') {
        const display = hint && String(hint).trim().length > 0 ? hint : '…'
        return `<span class="anki-cloze">[${display}]</span>`
      }
      return text
    })
    return withCloze.replace(/\{\{cloze:([\s\S]*?)\}\}/g, '$1')
  }, [])

  const enhanceAnkiHtml = useCallback((html: string): string => {
    let updated = html

    // Language Reactor templates use dc-* classes. Add a callout style for the grammar/notes block.
    if (updated.includes('dc-card')) {
      updated = updated.replace(
        /<div>\s*(<ruby[\s\S]*?<\/ruby>)/g,
        '<div class="anki-grammar-notes">$1'
      )
    }

    // Wrap romaji text (Latin text before <br> and Japanese) with a styled span
    // Pattern: [Latin text]<br>[Japanese text with possible ruby tags]
    updated = updated.replace(
      /^([a-zA-Z][a-zA-Z\s]*?)(<br>)/,
      '<span class="anki-romaji-label">romaji: <span class="anki-romaji-text">$1</span></span>$2'
    )

    return updated
  }, [])

  const isAnkiCard = hydratedCard?.metadata?.source === 'anki';

  const resolvedFrontHtmlRaw = effectiveFurigana.enabled && effectiveFurigana.showOnFront
    ? (resolvedFuriganaFront || resolvedFrontText)
    : stripFurigana(resolvedFrontText);

  const resolvedBackHtmlRaw = effectiveFurigana.enabled && effectiveFurigana.showOnBack
    ? (resolvedFuriganaBack || resolvedBackText)
    : stripFurigana(resolvedBackText);

  const resolvedFrontHtml = isAnkiCard
    ? enhanceAnkiHtml(applyAnkiCloze(resolvedFrontHtmlRaw, 'front'))
    : resolvedFrontHtmlRaw;

  const resolvedBackHtml = isAnkiCard
    ? enhanceAnkiHtml(applyAnkiCloze(resolvedBackHtmlRaw, 'back'))
    : resolvedBackHtmlRaw;

  // Auto-play audio only on front cards that say "Listen" (or "Listen.")
  useEffect(() => {
    const trimmedFront = resolvedFrontText
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .trim();
    const hasAnkiAudioFilename = Boolean(
      hydratedCard.metadata?.audioFilename || (hydratedCard as { audioFilename?: string }).audioFilename
    );
    const shouldAutoPlay =
      !isFlipped &&
      /^listen\.?$/i.test(trimmedFront) &&
      !hasAutoPlayedListen.current;

    if (shouldAutoPlay) {
      if (!resolvedAudioUrl && hasAnkiAudioFilename) {
        return;
      }
      hasAutoPlayedListen.current = true;
      if (autoPlayTimeoutRef.current) {
        return;
      }
      autoPlayTimeoutRef.current = window.setTimeout(() => {
        if (resolvedAudioUrl) {
          const audio = new Audio(resolvedAudioUrl);
          audio.play().catch(() => {});
        } else {
          void play('Listen.', {
            voice: 'en-US',
            rate: 0.9,
            pitch: 1.0
          });
        }
        autoPlayTimeoutRef.current = null;
      }, 150);
    }
  }, [card.id, hydratedCard, isFlipped, play, resolvedAudioUrl, resolvedFrontText]);

  useEffect(() => {
    return () => {
      if (autoPlayTimeoutRef.current) {
        window.clearTimeout(autoPlayTimeoutRef.current);
        autoPlayTimeoutRef.current = null;
      }
    };
  }, [card.id]);

  // Preload audio for both sides when card loads
  useEffect(() => {
    const preloadTexts = async () => {
      try {
        const texts = [];

        if (resolvedFrontText) {
          texts.push(resolvedFrontText);
        }
        if (resolvedBackText) {
          texts.push(resolvedBackText);
        }

        if (texts.length > 0) {
          const hasJapanese = texts.some(text =>
            /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)
          );

          await preload(texts, {
            voice: hasJapanese ? 'ja-JP' : 'en-US',
            rate: 0.9,
            pitch: 1.0
          }).catch(() => {
            console.debug('Preload failed for flashcard texts');
          });
        }
      } catch (error) {
        console.debug('Preload error:', error);
      }
    };

    preloadTexts();
  }, [card.id, preload, resolvedFrontText, resolvedBackText]);

  const handleFlip = useCallback(() => {
    setIsFlipped(!isFlipped);
    onFlip?.();
  }, [isFlipped, onFlip]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button')) return;
    pointerMovedRef.current = false;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerStartRef.current) return;
    const dx = Math.abs(event.clientX - pointerStartRef.current.x);
    const dy = Math.abs(event.clientY - pointerStartRef.current.y);
    if (dx + dy > 6) {
      pointerMovedRef.current = true;
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    if (pointerStartRef.current && !pointerMovedRef.current) {
      handleFlip();
    }
    pointerStartRef.current = null;
    pointerMovedRef.current = false;
  }, [handleFlip]);

  const handlePointerCancel = useCallback(() => {
    pointerStartRef.current = null;
    pointerMovedRef.current = false;
  }, []);

  const handleGrade = useCallback((correct: boolean, difficulty: 'again' | 'hard' | 'good' | 'easy') => {
    setHasGraded(true);
    onResponse?.(correct, difficulty);
  }, [onResponse]);

  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    // Desktop only shortcuts (same as kanji mastery)
    if (!isDesktopShortcutsEnabled()) return;

    // Ignore shortcuts if user is typing in an input or textarea
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }

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
        // Only allow next if graded (when grading is required)
        if (hasGraded || !onResponse) {
          onNext?.();
        }
        break;
      case '1':
        e.preventDefault();
        handleGrade(false, 'again');
        break;
      case '2':
        e.preventDefault();
        handleGrade(false, 'hard');
        break;
      case '3':
        e.preventDefault();
        handleGrade(true, 'good');
        break;
      case '4':
        e.preventDefault();
        handleGrade(true, 'easy');
        break;
    }
  }, [handleFlip, onNext, onPrevious, handleGrade, hasGraded, onResponse, isDesktopShortcutsEnabled]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  const playAudio = async () => {
    if (audioPlaying) return;

    // Determine what text to play based on which side is showing
    const textToPlay = isFlipped ? resolvedBackText : resolvedFrontText;
    const audioUrl = resolvedAudioUrl;

    if (!textToPlay && !audioUrl) return;

    setAudioPlaying(true);

    try {
      // If there's a custom audio URL, try to use it
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        await audio.play();
      } else {
        // Otherwise use TTS
        const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(textToPlay);
        const voice = isJapanese ? 'ja-JP' : 'en-US';
        await play(textToPlay, {
          voice,
          rate: 0.9,
          pitch: 1.0
        });
      }
    } catch (error) {
      console.error('Failed to play audio:', error);
    } finally {
      setAudioPlaying(false);
    }
  };

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
      transition: { duration: speed, type: 'spring' as const, stiffness: 200, damping: 20 }
    },
    back: {
      rotateY: 180,
      transition: { duration: speed, type: 'spring' as const, stiffness: 200, damping: 20 }
    }
  };

  // Extract image from HTML content OR CardSide media
  const extractImageFromHtml = useCallback((html: string): { imageUrl: string | null; htmlWithoutImage: string } => {
    if (typeof window === 'undefined') {
      return { imageUrl: null, htmlWithoutImage: html };
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const img = tempDiv.querySelector('img');

    if (img && img.src) {
      const imageUrl = img.src;
      img.remove();
      return { imageUrl, htmlWithoutImage: tempDiv.innerHTML };
    }

    return { imageUrl: null, htmlWithoutImage: html };
  }, []);

  // Extract images from front and back - check both HTML and CardSide media
  const frontContent = useMemo(() => {
    // First check if front is a CardSide object with media
    if (typeof hydratedCard.front === 'object' && hydratedCard.front?.media?.url) {
      return {
        imageUrl: hydratedCard.front.media.url,
        htmlWithoutImage: resolvedFrontHtml
      };
    }
    // Otherwise extract from HTML (Anki cards)
    return extractImageFromHtml(resolvedFrontHtml);
  }, [hydratedCard.front, resolvedFrontHtml, extractImageFromHtml, isAnkiCard]);

  const backContent = useMemo(() => {
    // First check if back is a CardSide object with media
    if (typeof hydratedCard.back === 'object' && hydratedCard.back?.media?.url) {
      return {
        imageUrl: hydratedCard.back.media.url,
        htmlWithoutImage: resolvedBackHtml
      };
    }
    // Otherwise extract from HTML (Anki cards)
    return extractImageFromHtml(resolvedBackHtml);
  }, [hydratedCard.back, resolvedBackHtml, extractImageFromHtml]);

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="relative min-h-[270px] md:min-h-[400px] perspective-1000">
        <motion.div
          className="absolute inset-0 w-full h-full preserve-3d"
          animate={isFlipped ? 'back' : 'front'}
          variants={cardVariants}
        >
          {/* Front Side */}
          <div
            className={cn(
              'absolute inset-0 w-full h-full rounded-2xl overflow-hidden backface-hidden flex flex-col cursor-pointer',
              getCardStyleClasses()
            )}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
          >
            {/* Delete button - Top Left */}
            <div className="absolute top-4 left-4 z-20">
              {onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="p-2 rounded-full bg-white/90 dark:bg-dark-800/90 backdrop-blur-sm hover:bg-white dark:hover:bg-dark-700 transition-all shadow-lg"
                  aria-label={t('flashcards.deleteCard')}
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              )}
            </div>

            {/* Audio button - Top Right */}
            <div className="absolute top-4 right-4 z-20">
              {(resolvedAudioUrl || resolvedFrontText) &&
               (resolvedAudioUrl || isJapaneseText(resolvedFrontText)) && (
                <button
                  onClick={(e) => { e.stopPropagation(); playAudio(); }}
                  className="p-2 rounded-full bg-white/90 dark:bg-dark-800/90 backdrop-blur-sm hover:bg-white dark:hover:bg-dark-700 transition-all shadow-lg"
                  aria-label={t('common.playAudio')}
                >
                  <Volume2 className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                </button>
              )}
            </div>

            {/* Hero Section - Top Half */}
            <div
              className={cn(
                "relative flex items-center justify-center overflow-hidden cursor-pointer",
                frontContent.imageUrl ? "h-1/2 min-h-[108px] md:min-h-[162px]" : "h-0"
              )}
              style={{
                backgroundImage: frontContent.imageUrl ? `url(${frontContent.imageUrl})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundColor: frontContent.imageUrl ? undefined : 'rgba(0, 0, 0, 0.05)'
              }}
            >
              {/* Overlay for better text/icon visibility when there's an image */}
              {frontContent.imageUrl && (
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-transparent" />
              )}
            </div>

            {/* Content Section - Bottom Half */}
            <div
              ref={contentSectionRef}
              className={cn(
                "relative flex-1 flashcard-content-scroll",
                frontContent.imageUrl ? "py-4" : "pt-6 pb-4"
              )}
              style={{
                minHeight: 0,
                overflow: 'auto',
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain'
              }}
            >
              <div
                className={cn(
                  'px-8',
                  !frontContent.imageUrl && 'min-h-full flex items-center justify-center'
                )}
              >
                <div
                  className={cn(
                    'anki-card-content w-full mx-auto',
                    cardStyle === 'themed' ? 'text-white' : 'text-gray-100'
                  )}
                  dangerouslySetInnerHTML={{ __html: frontContent.htmlWithoutImage }}
                />
              </div>
            </div>
          </div>

          {/* Back Side */}
          <div
            className={cn(
              'absolute inset-0 w-full h-full rounded-2xl overflow-hidden backface-hidden rotate-y-180 flex flex-col cursor-pointer',
              getCardStyleClasses()
            )}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
          >
            {/* Delete button - Top Left (visually, but right-4 due to rotate-y-180) */}
            <div className="absolute top-4 right-4 z-20">
              {onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="p-2 rounded-full bg-white/90 dark:bg-dark-800/90 backdrop-blur-sm hover:bg-white dark:hover:bg-dark-700 transition-all shadow-lg"
                  aria-label={t('flashcards.deleteCard')}
                >
                  <Trash2 className="w-4 h-4 text-red-500" style={{ transform: 'scaleX(-1)' }} />
                </button>
              )}
            </div>

            {/* Audio button - Top Right (visually, but left-4 due to rotate-y-180) */}
            <div className="absolute top-4 left-4 z-20">
              {(resolvedAudioUrl || resolvedBackText) &&
               (resolvedAudioUrl || isJapaneseText(resolvedBackText)) && (
                <button
                  onClick={(e) => { e.stopPropagation(); playAudio(); }}
                  className="p-2 rounded-full bg-white/90 dark:bg-dark-800/90 backdrop-blur-sm hover:bg-white dark:hover:bg-dark-700 transition-all shadow-lg"
                  aria-label={t('common.playAudio')}
                >
                  <Volume2 className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                </button>
              )}
            </div>

            {/* Flip button - Bottom Right */}
            <div className="absolute bottom-4 right-4 z-20">
              <button
                onClick={(e) => { e.stopPropagation(); handleFlip(); }}
                className="p-2 rounded-full bg-white/90 dark:bg-dark-800/90 backdrop-blur-sm hover:bg-white dark:hover:bg-dark-700 transition-all shadow-lg text-gray-600 dark:text-gray-400"
                aria-label={t('flashcards.flipCard')}
              >
                <RotateCw className="w-4 h-4" style={{ transform: 'scaleX(-1)' }} />
              </button>
            </div>

            {/* Hero Section - Top Half */}
            <div
              className={cn(
                "relative flex items-center justify-center overflow-hidden cursor-pointer",
                backContent.imageUrl ? "h-1/2 min-h-[108px] md:min-h-[162px]" : "h-0"
              )}
              style={{
                backgroundImage: backContent.imageUrl ? `url(${backContent.imageUrl})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundColor: backContent.imageUrl ? undefined : 'rgba(0, 0, 0, 0.05)'
              }}
            >
              {/* Overlay for better text/icon visibility when there's an image */}
              {backContent.imageUrl && (
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-transparent" />
              )}
            </div>

            {/* Content Section - Bottom Half */}
            <div
              className={cn(
                "relative flex-1 flashcard-content-scroll",
                backContent.imageUrl ? "py-4" : "pt-6 pb-4"
              )}
              style={{
                minHeight: 0,
                overflow: 'auto',
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain'
              }}
            >
              <div
                className={cn(
                  'px-8',
                  !backContent.imageUrl && 'min-h-full flex items-center justify-center'
                )}
              >
                <div
                  className={cn(
                    'anki-card-content w-full mx-auto',
                    cardStyle === 'themed' ? 'text-white' : 'text-gray-900 dark:text-gray-100'
                  )}
                  dangerouslySetInnerHTML={{ __html: backContent.htmlWithoutImage }}
                />
              </div>
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
          onClick={onNext}
          disabled={!onNext || (onResponse && !hasGraded)}
          className="p-3 rounded-full bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label={t('flashcards.nextCard')}
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Difficulty Buttons */}
      <AnimatePresence>
        {onResponse && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex justify-center gap-3 md:gap-2 mt-6"
          >
            <button
              onClick={() => handleGrade(false, 'again')}
              className="px-4 py-2 md:px-3 md:py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors font-medium md:text-sm"
            >
              {t('flashcards.difficulty.again')} <span className="hidden md:inline text-xs opacity-60">(1)</span>
            </button>
            <button
              onClick={() => handleGrade(false, 'hard')}
              className="px-4 py-2 md:px-3 md:py-1.5 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-800/50 transition-colors font-medium md:text-sm"
            >
              {t('flashcards.difficulty.hard')} <span className="hidden md:inline text-xs opacity-60">(2)</span>
            </button>
            <button
              onClick={() => handleGrade(true, 'good')}
              className="px-4 py-2 md:px-3 md:py-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors font-medium md:text-sm"
            >
              {t('flashcards.difficulty.good')} <span className="hidden md:inline text-xs opacity-60">(3)</span>
            </button>
            <button
              onClick={() => handleGrade(true, 'easy')}
              className="px-4 py-2 md:px-3 md:py-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors font-medium md:text-sm"
            >
              {t('flashcards.difficulty.easy')} <span className="hidden md:inline text-xs opacity-60">(4)</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .flashcard-content-scroll {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE and Edge */
          touch-action: pan-y; /* Enable vertical scrolling */
          -webkit-overflow-scrolling: touch; /* Smooth scrolling on iOS */
        }

        .flashcard-content-scroll::-webkit-scrollbar {
          display: none; /* Chrome, Safari, Opera */
        }

        .anki-card-content {
          text-align: center;
          line-height: 1.6;
          font-size: 1.1rem !important;
        }

        .anki-card-content > *:first-child {
          margin-top: 0.8rem !important;
          padding-top: 0 !important;
        }

        .anki-card-content br:first-child,
        .anki-card-content br:first-child + br {
          display: none;
        }

        .anki-card-content span {
          font-size: 1.5rem !important;
          line-height: 1.8;
          font-weight: 500 !important;
        }

        .anki-card-content span[style] {
          font-size: 1.5rem !important;
          font-weight: 500 !important;
        }

        /* Romaji label - small, at top, in flow */
        .anki-card-content .anki-romaji-label {
          display: block;
          text-align: left;
          margin-top: 0;
          margin-bottom: auto;
          padding-bottom: 1rem;
          font-size: 0.65rem !important;
          color: #6b7280 !important;
          font-weight: 400 !important;
          line-height: 1.2 !important;
        }

        .anki-card-content .anki-romaji-label .anki-romaji-text {
          font-size: 0.65rem !important;
          color: #9ca3af !important;
          font-style: italic !important;
          font-weight: 400 !important;
          line-height: 1.2 !important;
        }

        /* Hide br after romaji */
        .anki-card-content .anki-romaji-label + br {
          display: none;
        }

        /* Ruby tags - let browser handle positioning naturally */
        .anki-card-content ruby {
          display: inline-ruby !important;
          font-size: 1.5rem !important;
          font-weight: 600 !important;
        }

        .anki-card-content ruby rt {
          font-size: 0.5em !important;
          user-select: none !important;
        }

        .anki-card-content img {
          display: none !important;
        }

        .anki-card-content br {
          display: block;
          margin: 0.25rem 0;
          content: "";
        }

        .anki-card-content div {
          margin: 0.5rem 0;
        }

        .anki-card-content p {
          margin: 0.25rem 0;
          font-size: 1.05rem !important;
        }

        .anki-card-content .anki-cloze {
          color: #ef4444;
          font-weight: 600;
          padding: 0 0.1rem;
        }

        .anki-card-content .anki-grammar-notes {
          margin-top: 0.75rem;
          padding: 0.6rem 0.8rem;
          border-radius: 0.75rem;
          background: rgba(99, 102, 241, 0.08);
          border: 1px solid rgba(99, 102, 241, 0.2);
          font-size: 0.95rem;
          line-height: 1.6;
          text-align: left;
        }

        .anki-card-content .anki-grammar-notes ruby {
          font-weight: 600 !important;
        }

        .anki-card-content .anki-grammar-notes span {
          font-size: 0.95rem !important;
          font-weight: 400 !important;
          color: #c7d2fe;
        }
      `}</style>
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

.anki-card-content {
  text-align: center;
  line-height: 1.6;
  font-size: 1.1rem !important;
}

.anki-card-content .anki-romaji-label {
  display: block;
  text-align: left;
  margin-top: 0;
  margin-bottom: auto;
  padding-bottom: 1rem;
  font-size: 0.65rem !important;
  color: #6b7280 !important;
  font-weight: 400 !important;
  line-height: 1.2 !important;
  align-self: flex-start;
}

.anki-card-content .anki-romaji-label .anki-romaji-text {
  font-size: 0.65rem !important;
  color: #9ca3af !important;
  font-style: italic !important;
  font-weight: 400 !important;
  line-height: 1.2 !important;
}

.anki-card-content .anki-romaji-label + br {
  display: none;
}

.anki-card-content span {
  font-size: 1.5rem !important;
  line-height: 1.8;
  font-weight: 500 !important;
}

.anki-card-content span[style] {
  font-size: 1.5rem !important;
  font-weight: 500 !important;
}

.anki-card-content ruby {
  display: inline-ruby !important;
  font-weight: 600 !important;
  font-size: 1.5rem !important;
}

.anki-card-content ruby rt {
  font-weight: 600 !important;
  font-size: 0.7em !important;
}

.anki-card-content img {
  display: none !important;
}

.anki-card-content br {
  display: block;
  margin: 0.25rem 0;
  content: "";
}

.anki-card-content div {
  margin: 0.5rem 0;
}

.anki-card-content p {
  margin: 0.25rem 0;
  font-size: 1.05rem !important;
}
`;
