'use client';

import React, { useEffect, useState, useMemo } from 'react';
import KuromojiService, { TokenWithHighlight, POS_COLORS } from '@/utils/kuromojiService';
import { katakanaToHiragana } from '@/utils/japaneseParser';

interface GrammarHighlightedTextProps {
  text: string;
  highlightMode: 'none' | 'all' | 'content' | 'grammar';
  onWordClick?: (word: string, event: React.MouseEvent) => void;
  showFurigana?: boolean;
  className?: string;
}

export function GrammarHighlightedText({
  text,
  highlightMode,
  onWordClick,
  showFurigana = false,
  className = ''
}: GrammarHighlightedTextProps) {
  const [tokens, setTokens] = useState<TokenWithHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isKuromojiReady, setIsKuromojiReady] = useState(false);

  // Initialize Kuromoji once
  useEffect(() => {
    const initKuromoji = async () => {
      try {
        const kuromojiService = KuromojiService.getInstance();
        await kuromojiService.initialize();
        setIsKuromojiReady(true);
      } catch (err) {
        console.error('Failed to initialize Kuromoji:', err);
        setError('Failed to initialize grammar analyzer');
      }
    };

    initKuromoji();
  }, []);

  useEffect(() => {
    const analyzeText = async () => {
      if (!isKuromojiReady || highlightMode === 'none' || !text) {
        setTokens([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const kuromojiService = KuromojiService.getInstance();
        const analyzedTokens = await kuromojiService.tokenize(text);
        setTokens(analyzedTokens);
        setError(null);
      } catch (err) {
        console.error('Failed to analyze text:', err);
        setError('Failed to analyze text');
        setTokens([]);
      } finally {
        setLoading(false);
      }
    };

    analyzeText();
  }, [text, highlightMode, isKuromojiReady]);

  const shouldHighlight = (token: TokenWithHighlight): boolean => {
    if (highlightMode === 'none') return false;
    if (highlightMode === 'all') return true;

    const kuromojiService = KuromojiService.getInstance();

    if (highlightMode === 'content') {
      return kuromojiService.isContentWord(token);
    }

    if (highlightMode === 'grammar') {
      return kuromojiService.isGrammarWord(token);
    }

    return false;
  };

  const handleWordClick = (token: TokenWithHighlight, event: React.MouseEvent) => {
    if (onWordClick && token.basic_form) {
      onWordClick(token.basic_form, event);
    }
  };

  if (loading || !isKuromojiReady) {
    return <span className={`${className} font-japanese`}>{text}</span>;
  }

  if (error || tokens.length === 0) {
    return <span className={`${className} font-japanese`}>{text}</span>;
  }

  return (
    <span className={`${className} font-japanese inline`} style={{ lineHeight: '2.5' }}>
      {tokens.map((token, index) => {
        const isHighlighted = shouldHighlight(token);
        const kuromojiService = KuromojiService.getInstance();
        const posType = kuromojiService.getPartOfSpeech(token);

        // Skip symbols (e.g., '・', punctuation)
        if (posType === 'symbol') {
          return <span key={index}>{token.surface_form}</span>;
        }

        // Check if the token contains kanji
        const hasKanji = kuromojiService.hasKanji(token.surface_form);

        // Convert katakana reading to hiragana
        const hiraganaReading = token.reading ? katakanaToHiragana(token.reading) : '';

        if (showFurigana && hiraganaReading && token.surface_form !== hiraganaReading && hasKanji) {
          // Render with furigana only for words containing kanji
          return (
            <ruby
              key={index}
              className={`cursor-pointer hover:bg-primary/20 transition-colors rounded px-1 py-0.5 mx-0.5 inline-block ${
                isHighlighted ? `grammar-${posType}` : ''
              }`}
              style={{
                ...(isHighlighted ? { backgroundColor: `${token.color}20` } : {}),
                paddingTop: showFurigana ? '0.5em' : undefined,
              }}
              onClick={(e) => handleWordClick(token, e)}
              data-pos={posType}
            >
              {token.surface_form}
              <rp>(</rp>
              <rt className="text-xs">{hiraganaReading}</rt>
              <rp>)</rp>
            </ruby>
          );
        } else {
          // Render without furigana
          return (
            <span
              key={index}
              className={`cursor-pointer hover:bg-primary/20 transition-colors rounded px-1 py-0.5 mx-0.5 inline-block ${
                isHighlighted ? `grammar-${posType}` : ''
              }`}
              style={{
                ...(isHighlighted ? { backgroundColor: `${token.color}20` } : {}),
              }}
              onClick={(e) => handleWordClick(token, e)}
              data-pos={posType}
            >
              {token.surface_form}
            </span>
          );
        }
      })}
    </span>
  );
}

// Grammar Legend Component
export function GrammarLegend({ onClose }: { onClose?: () => void }) {
  const legendItems = [
    { type: 'noun', label: 'Noun', color: POS_COLORS.noun },
    { type: 'verb', label: 'Verb', color: POS_COLORS.verb },
    { type: 'adjective', label: 'Adjective', color: POS_COLORS.adjective },
    { type: 'adverb', label: 'Adverb', color: POS_COLORS.adverb },
    { type: 'particle', label: 'Particle', color: POS_COLORS.particle },
    { type: 'auxiliary', label: 'Auxiliary', color: POS_COLORS.auxiliary },
    { type: 'conjunction', label: 'Conjunction', color: POS_COLORS.conjunction },
    { type: 'interjection', label: 'Interjection', color: POS_COLORS.interjection },
  ];

  return (
    <div className="bg-background dark:bg-dark-800 border border-border dark:border-dark-700 rounded-lg shadow-lg p-4 max-w-sm">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-foreground dark:text-dark-100">Grammar Legend</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground dark:text-dark-400 dark:hover:text-dark-100 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {legendItems.map((item) => (
          <div key={item.type} className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: `${item.color}40` }}
            />
            <span className="text-sm text-foreground dark:text-dark-200">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}