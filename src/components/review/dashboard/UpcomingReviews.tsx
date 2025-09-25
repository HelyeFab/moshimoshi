'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { Calendar, Clock, TrendingUp, AlertCircle, ChevronDown, ChevronRight, Play } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { kanaData } from '@/data/kanaData';
import { ReviewableContent } from '@/lib/review-engine/core/interfaces';

interface ScheduledItem {
  id: string;
  type: string;
  content: string;
  meaning: string;
  nextReviewAt: string;
  dueIn: number; // hours
  interval: number;
  easeFactor: number;
  status: string;
  reviewCount: number;
  correctCount: number;
  streak: number;
  difficulty?: number;
  category: 'overdue' | 'today' | 'tomorrow' | 'thisWeek' | 'later';
  sessionType?: 'review' | 'study';
}

interface UpcomingReviewsProps {
  className?: string;
}

interface GroupedItems {
  [contentType: string]: {
    items: Map<string, ScheduledItem[]>;
    count: number;
    overdueCount: number;
  };
}

export function UpcomingReviews({ className }: UpcomingReviewsProps) {
  const { t, strings } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [groupedItems, setGroupedItems] = useState<GroupedItems>({});
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['hiragana', 'katakana', 'kanji']));
  const [stats, setStats] = useState({
    overdue: 0,
    dueToday: 0,
    dueTomorrow: 0,
    dueThisWeek: 0,
    total: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchScheduledItems = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/review/scheduled');
        if (!response.ok) {
          throw new Error('Failed to fetch scheduled reviews');
        }

        const data = await response.json();
        if (data.success) {
          setItems(data.items);
          setStats(data.stats);

          // Group items by content type and deduplicate
          const grouped: GroupedItems = {};

          data.items.forEach((item: ScheduledItem) => {
            if (!grouped[item.type]) {
              grouped[item.type] = {
                items: new Map(),
                count: 0,
                overdueCount: 0
              };
            }

            const displayContent = getDisplayContent(item);
            const key = displayContent.character;

            if (!grouped[item.type].items.has(key)) {
              grouped[item.type].items.set(key, []);
            }

            grouped[item.type].items.get(key)!.push(item);
            grouped[item.type].count++;
            if (item.category === 'overdue') {
              grouped[item.type].overdueCount++;
            }
          });

          setGroupedItems(grouped);
        }
      } catch (err) {
        console.error('Error fetching scheduled reviews:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchScheduledItems();
  }, [user]);

  const formatTimeUntil = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffMs < 0) {
      const overdueDays = Math.abs(diffDays);
      const overdueHours = Math.abs(diffHours) % 24;
      if (overdueDays > 0) {
        return `${overdueDays} ${overdueDays === 1 ? 'day' : 'days'} overdue`;
      }
      return `${overdueHours} ${overdueHours === 1 ? 'hour' : 'hours'} overdue`;
    }

    if (diffDays === 0) {
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return `in ${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'}`;
      }
      return `in ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'}`;
    }

    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `in ${diffDays} days`;
    const weeks = Math.floor(diffDays / 7);
    return `in ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'overdue':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20';
      case 'today':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20';
      case 'tomorrow':
        return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20';
      case 'thisWeek':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'hiragana':
        return 'bg-blue-500';
      case 'katakana':
        return 'bg-green-500';
      case 'kanji':
        return 'bg-purple-500';
      case 'vocabulary':
        return 'bg-orange-500';
      case 'sentence':
        return 'bg-pink-500';
      default:
        return 'bg-gray-500';
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const getDisplayContent = (item: ScheduledItem): { character: string; reading: string } => {
    // For hiragana/katakana, check if content is already the Japanese character
    if (item.type === 'hiragana' || item.type === 'katakana' || item.type === 'kana') {
      // Check if item.content is already a Japanese character
      const isJapaneseChar = /[\u3040-\u309F\u30A0-\u30FF]/.test(item.content);

      if (isJapaneseChar) {
        // Content is already the Japanese character, use meaning as romaji
        return { character: item.content, reading: item.meaning || '' };
      }

      // Fallback: content might still be in old format like "hiragana-a"
      // This mapping is for backward compatibility with existing data
      const kanaMap: Record<string, string> = {
        // Hiragana
        'a': 'あ', 'i': 'い', 'u': 'う', 'e': 'え', 'o': 'お',
        'ka': 'か', 'ki': 'き', 'ku': 'く', 'ke': 'け', 'ko': 'こ',
        'sa': 'さ', 'shi': 'し', 'su': 'す', 'se': 'せ', 'so': 'そ',
        'ta': 'た', 'chi': 'ち', 'tsu': 'つ', 'te': 'て', 'to': 'と',
        'na': 'な', 'ni': 'に', 'nu': 'ぬ', 'ne': 'ね', 'no': 'の',
        'ha': 'は', 'hi': 'ひ', 'fu': 'ふ', 'he': 'へ', 'ho': 'ほ',
        'ma': 'ま', 'mi': 'み', 'mu': 'む', 'me': 'め', 'mo': 'も',
        'ya': 'や', 'yu': 'ゆ', 'yo': 'よ',
        'ra': 'ら', 'ri': 'り', 'ru': 'る', 're': 'れ', 'ro': 'ろ',
        'wa': 'わ', 'wo': 'を', 'n': 'ん',
        // Katakana
        'a-kata': 'ア', 'i-kata': 'イ', 'u-kata': 'ウ', 'e-kata': 'エ', 'o-kata': 'オ',
        'ka-kata': 'カ', 'ki-kata': 'キ', 'ku-kata': 'ク', 'ke-kata': 'ケ', 'ko-kata': 'コ',
        'sa-kata': 'サ', 'shi-kata': 'シ', 'su-kata': 'ス', 'se-kata': 'セ', 'so-kata': 'ソ',
        'ta-kata': 'タ', 'chi-kata': 'チ', 'tsu-kata': 'ツ', 'te-kata': 'テ', 'to-kata': 'ト',
        'na-kata': 'ナ', 'ni-kata': 'ニ', 'nu-kata': 'ヌ', 'ne-kata': 'ネ', 'no-kata': 'ノ',
        'ha-kata': 'ハ', 'hi-kata': 'ヒ', 'fu-kata': 'フ', 'he-kata': 'ヘ', 'ho-kata': 'ホ',
        'ma-kata': 'マ', 'mi-kata': 'ミ', 'mu-kata': 'ム', 'me-kata': 'メ', 'mo-kata': 'モ',
        'ya-kata': 'ヤ', 'yu-kata': 'ユ', 'yo-kata': 'ヨ',
        'ra-kata': 'ラ', 'ri-kata': 'リ', 'ru-kata': 'ル', 're-kata': 'レ', 'ro-kata': 'ロ',
        'wa-kata': 'ワ', 'wo-kata': 'ヲ', 'n-kata': 'ン'
      };

      const romaji = item.content.replace(`${item.type}-`, '');
      const character = kanaMap[romaji] || kanaMap[`${romaji}-kata`] || item.content;
      return { character, reading: item.meaning || romaji };
    }

    // For kanji or other content, return as-is
    return { character: item.content, reading: item.meaning };
  };

  if (loading) {
    return (
      <div className={cn('bg-soft-white dark:bg-dark-800 rounded-xl p-6 border border-gray-200 dark:border-dark-700', className)}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-dark-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('bg-soft-white dark:bg-dark-800 rounded-xl p-6 border border-gray-200 dark:border-dark-700', className)}>
        <div className="text-red-600 dark:text-red-400">
          <AlertCircle className="h-5 w-5 inline mr-2" />
          {error}
        </div>
      </div>
    );
  }

  // Prepare review items from scheduled items
  const prepareReviewItems = (): ReviewableContent[] => {
    console.log('[UpcomingReviews] Raw items:', items);

    // Get all overdue items and deduplicate by character
    const overdueMap = new Map<string, ScheduledItem>();

    items
      .filter(item => item.category === 'overdue')
      .forEach(item => {
        // Use the display character as the key for deduplication
        const display = getDisplayContent(item);
        const key = display.character;
        console.log('[UpcomingReviews] Processing item:', item.content, 'key:', key, 'type:', item.type);

        // Keep the first instance or the one with better data
        if (!overdueMap.has(key) || item.reviewCount > 0) {
          overdueMap.set(key, item);
        }
      });

    console.log('[UpcomingReviews] Overdue map size:', overdueMap.size);

    // Convert to ReviewableContent format
    const reviewableItems: ReviewableContent[] = [];

    overdueMap.forEach(item => {
      if (item.type === 'hiragana' || item.type === 'katakana') {
        // Handle both formats: "hiragana-a" and "あ"
        let searchKey = item.content.replace(`${item.type}-`, '');
        console.log('[UpcomingReviews] Original content:', item.content, 'searchKey:', searchKey);

        // If searchKey is a Japanese character, we need to find it by character
        // If it's romaji like 'a', 'i', 'u', we find it by id
        const isJapaneseChar = /[\u3040-\u309F\u30A0-\u30FF]/.test(searchKey);

        let kanaItem;
        if (isJapaneseChar) {
          // Search by character (for items stored as "あ", "い", "う")
          if (item.type === 'hiragana') {
            kanaItem = kanaData.find(k => k.hiragana === searchKey);
          } else if (item.type === 'katakana') {
            kanaItem = kanaData.find(k => k.katakana === searchKey);
          }
          console.log('[UpcomingReviews] Searching by character:', searchKey);
        } else {
          // Search by romaji id (for items stored as "hiragana-a")
          kanaItem = kanaData.find(k => k.id === searchKey);
          console.log('[UpcomingReviews] Searching by romaji:', searchKey);
        }

        if (kanaItem) {
          const reviewItem = {
            id: `${item.type}-${kanaItem.id}`,
            contentType: 'kana' as any,
            primaryDisplay: item.type === 'hiragana' ? kanaItem.hiragana : kanaItem.katakana,
            primaryAnswer: kanaItem.romaji,
            alternativeAnswers: [],
            audioUrl: undefined,
            supportedModes: ['recognition', 'recall', 'listening'] as any,
            difficulty: 0.3,
            tags: [item.type, kanaItem.row || 'basic']
          };
          console.log('[UpcomingReviews] Created review item:', reviewItem);
          reviewableItems.push(reviewItem);
        } else {
          console.warn('[UpcomingReviews] No kana item found for:', searchKey, 'type:', item.type);
        }
      } else {
        console.log('[UpcomingReviews] Skipping non-kana item:', item.type);
      }
      // Future: Add kanji, vocabulary, sentence support here
    });

    console.log('[UpcomingReviews] Final reviewable items:', reviewableItems);
    return reviewableItems;
  };

  const handleStartReview = () => {
    console.log('[UpcomingReviews] Starting review...');
    const reviewItems = prepareReviewItems();
    console.log('[UpcomingReviews] Prepared items:', reviewItems);

    if (reviewItems.length > 0) {
      // Store in sessionStorage (same pattern as KanaLearningComponent)
      sessionStorage.setItem('reviewItems', JSON.stringify(reviewItems));
      console.log('[UpcomingReviews] Stored in sessionStorage, navigating...');

      // Navigate to review session page (not just /review which redirects)
      router.push('/review/session');
    } else {
      console.warn('[UpcomingReviews] No items to review!');
    }
  };

  return (
    <div className={cn('bg-soft-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700', className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-dark-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            {t('reviewDashboard.upcomingReviews')}
          </h3>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {stats.total} {t('review.items')}
          </span>
        </div>

        {/* Start Review Button - Only show if there are overdue items */}
        {stats.overdue > 0 && (
          <button
            onClick={handleStartReview}
            className="w-full sm:w-auto px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Play className="h-4 w-4" />
            {t('reviewDashboard.actions.reviewOverdue', { count: stats.overdue })}
          </button>
        )}

        {/* Statistics */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          {stats.overdue > 0 && (
            <div className="text-center px-2 py-1 rounded bg-red-100 dark:bg-red-900/20">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.overdue}</div>
              <div className="text-xs text-red-600 dark:text-red-400">{t('reviewDashboard.overdue')}</div>
            </div>
          )}
          <div className="text-center px-2 py-1 rounded bg-yellow-100 dark:bg-yellow-900/20">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.dueToday}</div>
            <div className="text-xs text-yellow-600 dark:text-yellow-400">{t('common.today')}</div>
          </div>
          <div className="text-center px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/20">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.dueTomorrow}</div>
            <div className="text-xs text-blue-600 dark:text-blue-400">{t('review.schedule.tomorrow')}</div>
          </div>
          <div className="text-center px-2 py-1 rounded bg-green-100 dark:bg-green-900/20">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.dueThisWeek}</div>
            <div className="text-xs text-green-600 dark:text-green-400">{t('reviewDashboard.thisWeek')}</div>
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {Object.keys(groupedItems).length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">{t('reviewDashboard.noScheduledReviews')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedItems).map(([contentType, group]) => (
              <div key={contentType} className="border border-gray-200 dark:border-dark-700 rounded-lg">
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(contentType)}
                  className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className={cn('w-2 h-6 rounded-full', getTypeColor(contentType))} />
                    <span className="font-medium capitalize">
                      {contentType} ({group.count})
                    </span>
                    {group.overdueCount > 0 && (
                      <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full">
                        {group.overdueCount} overdue
                      </span>
                    )}
                  </div>
                  {expandedSections.has(contentType) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>

                {/* Section Content */}
                {expandedSections.has(contentType) && (
                  <div className="p-2 space-y-2 border-t border-gray-200 dark:border-dark-700">
                    {Array.from(group.items.entries()).map(([character, itemsList]) => {
                      // Separate review sessions from study sessions
                      const reviewItems = itemsList.filter(item => item.correctCount > 0 || (item.reviewCount > 0 && item.correctCount === 0 && !itemsList.some(other => other.id !== item.id && other.correctCount > 0)));
                      const studyOnlyItems = itemsList.filter(item => item.correctCount === 0 && item.reviewCount > 0 && itemsList.some(other => other.id !== item.id && other.correctCount > 0));

                      // Calculate stats ONLY from actual review sessions (not study sessions)
                      const reviewOnlyStats = reviewItems.filter(item => item.correctCount > 0);
                      const totalReviews = reviewOnlyStats.reduce((sum, item) => sum + item.reviewCount, 0);
                      const totalCorrect = reviewOnlyStats.reduce((sum, item) => sum + item.correctCount, 0);
                      const bestStreak = Math.max(...itemsList.map(item => item.streak), 0);
                      const isOverdue = itemsList.some(item => item.category === 'overdue');
                      const earliestDue = itemsList.reduce((earliest, item) => {
                        const itemDate = new Date(item.nextReviewAt);
                        return itemDate < earliest ? itemDate : earliest;
                      }, new Date(itemsList[0].nextReviewAt));

                      // Check if there are study sessions mixed with review sessions
                      const hasStudySessions = studyOnlyItems.length > 0;
                      const hasReviewSessions = reviewOnlyStats.length > 0;

                      return (
                        <div
                          key={character}
                          className={cn(
                            'p-3 rounded-lg border transition-all',
                            isOverdue
                              ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10'
                              : 'border-gray-200 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700'
                          )}
                        >
                          {/* Top row: Character and due time */}
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <span className="font-bold text-gray-900 dark:text-gray-100 text-2xl">
                                {character}
                              </span>
                              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                                {itemsList[0].meaning || getDisplayContent(itemsList[0]).reading}
                              </span>
                            </div>
                            <div className={cn(
                              'text-xs font-medium px-2 py-1 rounded whitespace-nowrap',
                              isOverdue
                                ? 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20'
                                : 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/20'
                            )}>
                              {formatTimeUntil(earliestDue.toISOString())}
                            </div>
                          </div>

                          {/* Bottom row: Stats badges */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {itemsList.length > 1 && (
                              <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded">
                                {itemsList.length} instances
                              </span>
                            )}
                            {bestStreak > 0 && (
                              <span className="text-xs px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded flex items-center gap-0.5">
                                <span>🔥</span>
                                <span>{bestStreak}</span>
                              </span>
                            )}
                            {hasReviewSessions && totalReviews > 0 && (
                              <span className={cn(
                                "text-xs px-1.5 py-0.5 rounded font-medium",
                                totalCorrect === totalReviews
                                  ? "bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                                  : "bg-gray-100 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400"
                              )}>
                                {Math.round((totalCorrect / totalReviews) * 100)}% Review
                              </span>
                            )}
                            {hasStudySessions && (
                              <span className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded">
                                + Study
                              </span>
                            )}
                            {!hasReviewSessions && itemsList.length > 0 && (
                              <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 rounded">
                                Study only
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}