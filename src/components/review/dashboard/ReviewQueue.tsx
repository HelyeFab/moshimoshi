'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { 
  Clock, 
  Filter, 
  SortAsc, 
  Grid3x3, 
  List, 
  LayoutGrid,
  ChevronRight,
  Play,
  Check,
  X
} from 'lucide-react';
import { cn } from '@/utils/cn';

interface ReviewItem {
  id: string;
  type: 'hiragana' | 'katakana' | 'kanji' | 'vocabulary' | 'sentence';
  content: string;
  meaning: string;
  dueIn: number; // hours
  difficulty?: number;
  streak?: number;
}

interface ReviewQueueProps {
  items: ReviewItem[];
  onStartReview: (items: ReviewItem[]) => void;
  onItemClick: (item: ReviewItem) => void;
  viewMode?: 'compact' | 'detailed' | 'cards';
}

const ITEMS_PER_PAGE = 20;

function QueueItem({ 
  item, 
  onClick, 
  viewMode, 
  selected,
  onSelect 
}: { 
  item: ReviewItem; 
  onClick: () => void; 
  viewMode: 'compact' | 'detailed' | 'cards';
  selected: boolean;
  onSelect: (selected: boolean) => void;
}) {
  const typeColors = {
    hiragana: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    katakana: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    kanji: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    vocabulary: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
    sentence: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
  };

  const urgencyClass = item.dueIn === 0 
    ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10' 
    : item.dueIn <= 1 
    ? 'border-yellow-300 dark:border-yellow-700' 
    : '';

  if (viewMode === 'cards') {
    return (
      <div
        className={cn(
          'relative p-4 rounded-lg border cursor-pointer transition-all duration-200',
          'hover:shadow-md hover:scale-105',
          'bg-soft-white dark:bg-dark-800',
          urgencyClass || 'border-gray-200 dark:border-dark-700',
          selected && 'ring-2 ring-primary-500'
        )}
        onClick={onClick}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect(e.target.checked);
          }}
          className="absolute top-2 left-2 h-4 w-4 text-primary-600 rounded focus:ring-primary-500"
        />
        
        <div className="text-center">
          <div className="text-2xl font-bold mb-2">{item.content}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">{item.meaning}</div>
          <span className={cn('inline-block px-2 py-1 rounded-full text-xs font-medium', typeColors[item.type])}>
            {item.type}
          </span>
          {item.dueIn === 0 && (
            <div className="mt-2 text-xs text-red-600 dark:text-red-400 font-medium">Due now!</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center p-3 rounded-lg border cursor-pointer transition-all duration-200',
        'hover:bg-gray-50 dark:hover:bg-dark-700',
        'bg-soft-white dark:bg-dark-800',
        urgencyClass || 'border-gray-200 dark:border-dark-700',
        selected && 'ring-2 ring-primary-500',
        viewMode === 'compact' ? 'space-x-3' : 'space-x-4'
      )}
      onClick={onClick}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => {
          e.stopPropagation();
          onSelect(e.target.checked);
        }}
        className="h-4 w-4 text-primary-600 rounded focus:ring-primary-500"
      />
      
      <div className={cn(
        'font-bold',
        viewMode === 'compact' ? 'text-lg' : 'text-xl'
      )}>
        {item.content}
      </div>
      
      <div className="flex-1">
        <div className="text-sm text-gray-600 dark:text-gray-400">{item.meaning}</div>
        {viewMode === 'detailed' && (
          <div className="flex items-center space-x-2 mt-1">
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', typeColors[item.type])}>
              {item.type}
            </span>
            {item.streak && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Streak: {item.streak}
              </span>
            )}
          </div>
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        {item.dueIn === 0 ? (
          <span className="text-sm font-medium text-red-600 dark:text-red-400">Due now</span>
        ) : (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {item.dueIn}h
          </span>
        )}
        <ChevronRight className="h-4 w-4 text-gray-400" />
      </div>
    </div>
  );
}

export function ReviewQueue({ items, onStartReview, onItemClick, viewMode: initialViewMode = 'detailed' }: ReviewQueueProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'compact' | 'detailed' | 'cards'>(initialViewMode);
  const [filter, setFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'dueDate' | 'difficulty' | 'type'>('dueDate');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [visibleItems, setVisibleItems] = useState(ITEMS_PER_PAGE);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter and sort items
  const processedItems = useMemo(() => {
    let filtered = items;
    
    if (filter !== 'all') {
      filtered = items.filter(item => item.type === filter);
    }
    
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'dueDate':
          return a.dueIn - b.dueIn;
        case 'difficulty':
          return (b.difficulty || 0) - (a.difficulty || 0);
        case 'type':
          return a.type.localeCompare(b.type);
        default:
          return 0;
      }
    });
    
    return sorted;
  }, [items, filter, sortBy]);

  // Virtual scrolling
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      if (scrollTop + clientHeight >= scrollHeight - 100 && visibleItems < processedItems.length) {
        setVisibleItems(prev => Math.min(prev + ITEMS_PER_PAGE, processedItems.length));
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [visibleItems, processedItems.length]);

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedItems(new Set(processedItems.map(item => item.id)));
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  if (items.length === 0) {
    return (
      <div className="bg-soft-white dark:bg-dark-800 rounded-xl p-8 border border-gray-200 dark:border-dark-700 text-center">
        <div className="text-gray-400 dark:text-gray-500 mb-2">
          <Grid3x3 className="h-12 w-12 mx-auto mb-4" />
        </div>
        <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
          {t('review.dashboard.queue.empty')}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          {t('review.dashboard.queue.emptyDescription')}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-soft-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-dark-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('review.dashboard.queue.title')}
          </h2>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {t('review.dashboard.queue.itemCount', { count: processedItems.length })}
          </span>
        </div>
        
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode */}
          <div className="flex items-center bg-gray-100 dark:bg-dark-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('compact')}
              className={cn(
                'p-1.5 rounded transition-colors',
                viewMode === 'compact' ? 'bg-soft-white dark:bg-dark-600 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-dark-600'
              )}
              title="Compact view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('detailed')}
              className={cn(
                'p-1.5 rounded transition-colors',
                viewMode === 'detailed' ? 'bg-soft-white dark:bg-dark-600 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-dark-600'
              )}
              title="Detailed view"
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={cn(
                'p-1.5 rounded transition-colors',
                viewMode === 'cards' ? 'bg-soft-white dark:bg-dark-600 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-dark-600'
              )}
              title="Card view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          
          {/* Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-dark-600 bg-soft-white dark:bg-dark-700 text-sm"
          >
            <option value="all">{t('review.dashboard.queue.filters.all')}</option>
            <option value="hiragana">{t('review.dashboard.queue.filters.hiragana')}</option>
            <option value="katakana">{t('review.dashboard.queue.filters.katakana')}</option>
            <option value="kanji">{t('review.dashboard.queue.filters.kanji')}</option>
            <option value="vocabulary">{t('review.dashboard.queue.filters.vocabulary')}</option>
          </select>
          
          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-dark-600 bg-soft-white dark:bg-dark-700 text-sm"
          >
            <option value="dueDate">{t('review.dashboard.queue.sortBy.dueDate')}</option>
            <option value="difficulty">{t('review.dashboard.queue.sortBy.difficulty')}</option>
            <option value="type">{t('review.dashboard.queue.sortBy.type')}</option>
          </select>
          
          {/* Selection controls */}
          {selectedItems.size > 0 && (
            <div className="flex items-center space-x-2 ml-auto">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectedItems.size} selected
              </span>
              <button
                onClick={selectAll}
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                Select all
              </button>
              <button
                onClick={clearSelection}
                className="text-sm text-gray-600 dark:text-gray-400 hover:underline"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Queue Items */}
      <div 
        ref={containerRef}
        className={cn(
          'p-4 overflow-y-auto max-h-96',
          viewMode === 'cards' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4' : 'space-y-2'
        )}
      >
        {processedItems.slice(0, visibleItems).map(item => (
          <QueueItem
            key={item.id}
            item={item}
            onClick={() => onItemClick(item)}
            viewMode={viewMode}
            selected={selectedItems.has(item.id)}
            onSelect={(selected) => toggleItemSelection(item.id)}
          />
        ))}
      </div>
      
      {/* Footer Actions */}
      <div className="p-4 border-t border-gray-200 dark:border-dark-700">
        <button
          onClick={() => {
            const itemsToReview = selectedItems.size > 0 
              ? processedItems.filter(item => selectedItems.has(item.id))
              : processedItems.filter(item => item.dueIn === 0);
            onStartReview(itemsToReview);
          }}
          className="w-full sm:w-auto px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center space-x-2"
        >
          <Play className="h-4 w-4" />
          <span>
            {selectedItems.size > 0 
              ? `Start Review (${selectedItems.size} items)`
              : t('review.dashboard.queue.startReview')}
          </span>
        </button>
      </div>
    </div>
  );
}