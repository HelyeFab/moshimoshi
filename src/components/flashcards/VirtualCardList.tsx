'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Edit2, Eye, EyeOff } from 'lucide-react';
import type { FlashcardContent } from '@/types/flashcards';
import { cn } from '@/lib/utils';

interface VirtualCardListProps {
  cards: FlashcardContent[];
  onRemove?: (index: number) => void;
  onEdit?: (index: number, card: FlashcardContent) => void;
  itemHeight?: number; // Height of each card item
  containerHeight?: number; // Height of the scrollable container
  overscan?: number; // Number of items to render outside visible area
  showStats?: boolean;
  className?: string;
}

export function VirtualCardList({
  cards,
  onRemove,
  onEdit,
  itemHeight = 100,
  containerHeight = 400,
  overscan = 3,
  showStats = false,
  className
}: VirtualCardListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });
  const [revealedCards, setRevealedCards] = useState<Set<number>>(new Set());

  // Calculate visible items based on scroll position
  useEffect(() => {
    const visibleStart = Math.floor(scrollTop / itemHeight);
    const visibleEnd = Math.ceil((scrollTop + containerHeight) / itemHeight);

    // Add overscan
    const start = Math.max(0, visibleStart - overscan);
    const end = Math.min(cards.length - 1, visibleEnd + overscan);

    setVisibleRange({ start, end });
  }, [scrollTop, itemHeight, containerHeight, overscan, cards.length]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const toggleReveal = (index: number) => {
    setRevealedCards(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const totalHeight = cards.length * itemHeight;
  const offsetY = visibleRange.start * itemHeight;
  const visibleCards = cards.slice(visibleRange.start, visibleRange.end + 1);

  // Performance metrics
  const renderedCount = visibleRange.end - visibleRange.start + 1;
  const totalCount = cards.length;
  const percentageRendered = totalCount > 0 ? Math.round((renderedCount / totalCount) * 100) : 0;

  return (
    <div className={cn("relative", className)}>
      {/* Performance indicator for development */}
      {showStats && totalCount > 50 && (
        <div className="absolute top-0 right-0 z-10 bg-primary-500/90 text-white text-xs px-2 py-1 rounded-bl-lg">
          Rendering {renderedCount}/{totalCount} ({percentageRendered}%)
        </div>
      )}

      {/* Scrollable container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="overflow-y-auto"
        style={{ height: containerHeight }}
      >
        {/* Virtual spacer to maintain correct scroll height */}
        <div style={{ height: totalHeight, position: 'relative' }}>
          {/* Rendered items */}
          <div
            style={{
              transform: `translateY(${offsetY}px)`,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0
            }}
          >
            {visibleCards.map((card, localIndex) => {
              const globalIndex = visibleRange.start + localIndex;
              const isRevealed = revealedCards.has(globalIndex);

              return (
                <motion.div
                  key={`${card.id}-${globalIndex}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: localIndex * 0.02 }}
                  className="p-2"
                  style={{ height: itemHeight }}
                >
                  <div className="h-full flex items-center justify-between p-3 bg-soft-white dark:bg-dark-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex-1 min-w-0">
                      {/* Front side */}
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          #{globalIndex + 1}
                        </span>
                        <div className="flex-1">
                          <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                            {card.front}
                          </p>

                          {/* Back side - toggleable */}
                          {isRevealed ? (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {card.back}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-400 dark:text-gray-500 italic mt-1">
                              Click eye to reveal answer
                            </p>
                          )}

                          {/* Notes if present */}
                          {card.notes && isRevealed && (
                            <p className="text-xs text-gray-500 dark:text-gray-500 italic mt-1">
                              {card.notes}
                            </p>
                          )}

                          {/* SRS Stats */}
                          {showStats && card.metadata && (
                            <div className="flex items-center gap-2 mt-1">
                              {card.metadata.status && (
                                <span className={cn(
                                  "text-xs px-1.5 py-0.5 rounded",
                                  card.metadata.status === 'new' && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                                  card.metadata.status === 'learning' && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                                  card.metadata.status === 'review' && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                                  card.metadata.status === 'mastered' && "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                                )}>
                                  {card.metadata.status}
                                </span>
                              )}
                              {card.metadata.interval !== undefined && (
                                <span className="text-xs text-gray-500 dark:text-gray-500">
                                  Interval: {card.metadata.interval}d
                                </span>
                              )}
                              {card.metadata.easeFactor !== undefined && (
                                <span className="text-xs text-gray-500 dark:text-gray-500">
                                  EF: {card.metadata.easeFactor.toFixed(2)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => toggleReveal(globalIndex)}
                        className="p-1.5 text-gray-500 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                        aria-label={isRevealed ? "Hide answer" : "Show answer"}
                      >
                        {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>

                      {onEdit && (
                        <button
                          onClick={() => onEdit(globalIndex, card)}
                          className="p-1.5 text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                          aria-label="Edit card"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}

                      {onRemove && (
                        <button
                          onClick={() => onRemove(globalIndex)}
                          className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          aria-label="Remove card"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Loading indicator for large lists */}
      {cards.length === 0 && (
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          No cards to display
        </div>
      )}

      {/* Scroll indicators */}
      {totalCount > renderedCount && (
        <>
          {visibleRange.start > 0 && (
            <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-gray-100 dark:from-dark-900 to-transparent pointer-events-none" />
          )}
          {visibleRange.end < totalCount - 1 && (
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-100 dark:from-dark-900 to-transparent pointer-events-none" />
          )}
        </>
      )}
    </div>
  );
}