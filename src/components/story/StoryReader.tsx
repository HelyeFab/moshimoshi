'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Story, StoryPage, StoryQuizQuestion, SelectedWord, ReadingSettings } from '@/types/story';
import { useAuth } from '@/hooks/useAuth';
import { useTTS } from '@/hooks/useTTS';
import { parseJapaneseText, processTextWithFurigana, cleanTextForTTS } from '@/utils/japaneseParser';
import { storyService } from '@/lib/services/StoryService';
import { useI18n } from '@/i18n/I18nContext';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { GrammarHighlightedText, GrammarLegend } from '@/components/reading/GrammarHighlightedText';
import {
  BookmarkIcon,
  SpeakerWaveIcon,
  Cog6ToothIcon,
  MicrophoneIcon,
  LanguageIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  AcademicCapIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid';
import ShadowingAudioPlayer from '@/components/audio/ShadowingAudioPlayer';
import dynamic from 'next/dynamic';

// Audio player placeholder - using ShadowingAudioPlayer instead
// const EnhancedArticleAudioPlayer = dynamic(...);

interface StoryReaderProps {
  story: Story;
  onComplete?: () => void;
  onExit?: () => void;
}

interface SettingsPanelProps {
  settings: ReadingSettings;
  onSettingsChange: (settings: ReadingSettings) => void;
  onClose: () => void;
}

interface WordLookupResult {
  word: string;
  reading?: string;
  meanings?: string[];
}

// Simple word lookup function (can be enhanced with actual dictionary API)
const lookupWord = async (word: string): Promise<WordLookupResult | null> => {
  // This is a placeholder - in a real app you'd call a dictionary API
  // For now, just return basic info
  return {
    word,
    reading: undefined, // Will be extracted from furigana if available
    meanings: ['Definition not available']
  };
};

function SettingsPanel({ settings, onSettingsChange, onClose }: SettingsPanelProps) {
  const { t } = useI18n();

  const handleFontSizeChange = (fontSize: ReadingSettings['fontSize']) => {
    onSettingsChange({ ...settings, fontSize });
  };

  const handleToggleFurigana = () => {
    onSettingsChange({ ...settings, showFurigana: !settings.showFurigana });
  };

  const handleToggleVocabularyHighlight = () => {
    onSettingsChange({ ...settings, highlightVocabulary: !settings.highlightVocabulary });
  };

  const handleHighlightModeChange = (mode: ReadingSettings['highlightMode']) => {
    onSettingsChange({ ...settings, highlightMode: mode });
  };

  return (
    <div className="absolute top-12 right-0 z-40 bg-soft-white dark:bg-dark-850 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 w-64 max-w-[calc(100vw-2rem)] md:max-w-none">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium text-gray-900 dark:text-white">{t('story.readingSettings')}</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Font Size */}
        <div>
          <label className="block text-sm font-medium mb-2">{t('story.fontSize')}</label>
          <div className="flex flex-wrap gap-2">
            {(['small', 'medium', 'large', 'xlarge'] as const).map((size) => (
              <button
                key={size}
                onClick={() => handleFontSizeChange(size)}
                className={`px-3 py-1 rounded text-xs sm:text-sm ${
                  settings.fontSize === size
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {t(`story.fontSize.${size}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Furigana Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">{t('story.showFurigana')}</label>
          <button
            onClick={handleToggleFurigana}
            className={`relative inline-flex h-6 sm:h-6 w-11 items-center rounded-full transition-colors ${
              settings.showFurigana ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-soft-white dark:bg-gray-200 shadow-sm transition-transform ${
                settings.showFurigana ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* Vocabulary Highlighting */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Highlight Vocabulary</label>
          <button
            onClick={handleToggleVocabularyHighlight}
            className={`relative inline-flex h-6 sm:h-6 w-11 items-center rounded-full transition-colors ${
              settings.highlightVocabulary ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                settings.highlightVocabulary ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* Highlight Mode */}
        {settings.highlightVocabulary && (
          <div>
            <label className="block text-sm font-medium mb-2">Highlight Mode</label>
            <div className="space-y-2">
              {(['none', 'all', 'content', 'grammar'] as const).map((mode) => (
                <label key={mode} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="highlightMode"
                    checked={settings.highlightMode === mode}
                    onChange={() => handleHighlightModeChange(mode)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm capitalize">{mode}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StoryReader({ story, onComplete, onExit }: StoryReaderProps) {
  const { user } = useAuth();
  const { t, strings } = useI18n();
  const { play, isPlaying, isCacheLoading } = useTTS({ cacheFirst: true });
  const { showToast } = useToast();

  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [startTime] = useState(new Date());
  const [selectedWord, setSelectedWord] = useState<SelectedWord | null>(null);
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [wordLookupLoading, setWordLookupLoading] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  // New advanced features
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [showGrammarLegend, setShowGrammarLegend] = useState(false);
  const [settings, setSettings] = useState<ReadingSettings>({
    fontSize: 'medium',
    showFurigana: true,
    highlightVocabulary: true,
    highlightMode: 'content',
    darkMode: false
  });
  const [showShadowingMode, setShowShadowingMode] = useState(false);

  const textContainerRef = useRef<HTMLDivElement>(null);
  const currentPage = story.pages[currentPageIndex];

  // Track if story was just completed
  const [hasTrackedCompletion, setHasTrackedCompletion] = useState(false);

  // Track story view and cache on mount
  useEffect(() => {
    if (story.id) {
      // Reset state when story changes
      setCurrentPageIndex(0);
      setHasTrackedCompletion(false);
      setReadingProgress(0);
      setShowQuiz(false);
      setQuizAnswers([]);
      setQuizScore(null);
      setSavedWords(new Set());

      console.log('🔄 Story changed, reset tracking:', story.title);

      if (user?.uid) {
        // Track view count and initial progress
        storyService.incrementViewCount(story.id);
        storyService.saveStoryProgress({
          storyId: story.id,
          userId: user.uid,
          currentPage: currentPageIndex,
          completed: false,
          completedAt: undefined,
          quizScore: undefined,
          quizAttempts: 0,
          savedWords: Array.from(savedWords),
          lastReadAt: new Date(),
          progress: ((currentPageIndex + 1) / story.pages.length) * 100,
          timeSpent: 0,
          vocabularyLearned: [],
          updatedAt: new Date()
        });
      }
    }
  }, [story.id]);

  // Calculate reading progress
  useEffect(() => {
    const progress = ((currentPageIndex + 1) / story.pages.length) * 100;
    setReadingProgress(progress);
  }, [currentPageIndex, story.pages.length]);

  // Save progress and track completion
  useEffect(() => {
    if (user && story.id) {
      // Check if story is completed (reached last page)
      const isCompleted = currentPageIndex === story.pages.length - 1;

      // Track story completion only once when reaching the last page
      // BUT DO NOT call onComplete here - let the user finish the quiz first
      if (isCompleted && !hasTrackedCompletion) {
        console.log('📚 User reached last page:', {
          storyId: story.id,
          title: story.title,
          currentPage: currentPageIndex + 1,
          totalPages: story.pages.length,
          hasQuiz: !!(story.quiz && story.quiz.length > 0)
        });

        setHasTrackedCompletion(true);

        // DO NOT call onComplete here - it will be called after quiz or when clicking next
      }

      // Save to Firebase
      storyService.saveStoryProgress({
        storyId: story.id,
        userId: user.uid,
        currentPage: currentPageIndex,
        completed: isCompleted,
        completedAt: isCompleted ? new Date() : undefined,
        quizScore: quizScore || undefined,
        quizAttempts: quizScore !== null ? 1 : 0,
        savedWords: Array.from(savedWords),
        lastReadAt: new Date(),
        progress: ((currentPageIndex + 1) / story.pages.length) * 100,
        timeSpent: Math.ceil((Date.now() - startTime.getTime()) / 1000),
        vocabularyLearned: Array.from(savedWords),
        updatedAt: new Date()
      });
    }
  }, [currentPageIndex, user, story.id, savedWords, story.pages.length, hasTrackedCompletion, onComplete, quizScore, startTime]);

  const handleWordClick = async (word: string, event: React.MouseEvent) => {
    if (!word) return;

    // For compatibility, try to get reading from event target if available
    const target = event.target as HTMLElement;
    const reading = target?.getAttribute?.('data-reading');

    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const containerRect = textContainerRef.current?.getBoundingClientRect();

    if (!containerRect) return;

    setWordLookupLoading(true);
    try {
      const lookupResult = await lookupWord(word);

      setSelectedWord({
        word,
        reading: reading || lookupResult?.reading,
        meanings: lookupResult?.meanings || ['No definition found'],
        position: {
          x: rect.left - containerRect.left + rect.width / 2,
          y: rect.top - containerRect.top
        }
      });
    } catch (error) {
      console.error('Error looking up word:', error);
      setSelectedWord({
        word,
        reading: reading || undefined,
        meanings: ['Error loading definition'],
        position: {
          x: rect.left - containerRect.left + rect.width / 2,
          y: rect.top - containerRect.top
        }
      });
    } finally {
      setWordLookupLoading(false);
    }
  };

  const handleSaveWord = async () => {
    if (!selectedWord || !user) return;

    try {
      // Simple word saving - could be enhanced with actual study list integration
      setSavedWords(prev => new Set(prev).add(selectedWord.word));
      setSelectedWord(null);
      showToast(t('common.saved') + ': ' + selectedWord.word, 'success');
    } catch (error) {
      console.error('Error saving word:', error);
      showToast('Error saving word', 'error');
    }
  };

  const handleBookmarkToggle = async () => {
    if (!user || !story.id) return;

    setBookmarkLoading(true);
    try {
      setIsBookmarked(!isBookmarked);
      showToast(isBookmarked ? 'Bookmark removed' : 'Story bookmarked', 'success');
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      showToast('Error updating bookmark', 'error');
    } finally {
      setBookmarkLoading(false);
    }
  };

  const handlePageChange = (direction: 'next' | 'prev') => {
    if (direction === 'next' && currentPageIndex < story.pages.length - 1) {
      setCurrentPageIndex(currentPageIndex + 1);
    } else if (direction === 'prev' && currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
    } else if (direction === 'next' && currentPageIndex === story.pages.length - 1) {
      if (story.quiz && story.quiz.length > 0) {
        setShowQuiz(true);
      } else if (onComplete) {
        onComplete();
      }
    }
  };

  const handleQuizAnswer = (questionIndex: number, answerIndex: number) => {
    const newAnswers = [...quizAnswers];
    newAnswers[questionIndex] = answerIndex;
    setQuizAnswers(newAnswers);
  };

  const handleQuizSubmit = async () => {
    if (!story.quiz || quizAnswers.length !== story.quiz.length) return;

    let correctAnswers = 0;
    story.quiz.forEach((question, index) => {
      if (quizAnswers[index] === question.correctIndex) {
        correctAnswers++;
      }
    });

    const score = Math.round((correctAnswers / story.quiz.length) * 100);
    setQuizScore(score);

    if (user?.uid && story.id) {
      storyService.saveStoryProgress({
        storyId: story.id,
        userId: user.uid,
        currentPage: story.pages.length - 1,
        completed: true,
        completedAt: new Date(),
        quizScore: score,
        quizAttempts: 1,
        savedWords: Array.from(savedWords),
        lastReadAt: new Date(),
        progress: 100,
        timeSpent: Math.ceil((Date.now() - startTime.getTime()) / 1000),
        vocabularyLearned: Array.from(savedWords),
        updatedAt: new Date()
      });
    }
  };

  const getFontSizeClass = () => {
    const sizes = {
      small: 'text-sm',
      medium: 'text-base',
      large: 'text-lg',
      xlarge: 'text-xl'
    };
    return sizes[settings.fontSize];
  };

  const renderJapaneseText = (html: string) => {
    if (settings.highlightVocabulary && settings.highlightMode !== 'none') {
      return (
        <GrammarHighlightedText
          text={html.replace(/<[^>]*>/g, '')} // Remove HTML tags for grammar analysis
          highlightMode={settings.highlightMode}
          onWordClick={handleWordClick}
          showFurigana={settings.showFurigana}
          className={`${getFontSizeClass()} leading-relaxed`}
        />
      );
    }

    // Fallback to basic rendering
    let processedHtml = html;
    if (settings.showFurigana) {
      processedHtml = processTextWithFurigana(html);
    }

    // Parse the HTML and add click handlers
    const parser = new DOMParser();
    const doc = parser.parseFromString(processedHtml, 'text/html');

    // Add data attributes to ruby elements for word lookup
    const rubyElements = doc.querySelectorAll('ruby');
    rubyElements.forEach(ruby => {
      const word = ruby.textContent?.replace(/[\s\n]+/g, '') || '';
      const reading = ruby.querySelector('rt')?.textContent || '';
      ruby.setAttribute('data-word', word);
      ruby.setAttribute('data-reading', reading);
    });

    return (
      <div
        ref={textContainerRef}
        className={`japanese-text font-ja ${getFontSizeClass()} leading-relaxed relative`}
        data-quickcontext="true"
        dangerouslySetInnerHTML={{ __html: doc.body.innerHTML }}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.tagName === 'RUBY' || target.closest('ruby')) {
            const ruby = target.tagName === 'RUBY' ? target : target.closest('ruby');
            if (ruby) {
              const word = ruby.getAttribute('data-word');
              const reading = ruby.getAttribute('data-reading');
              if (word) {
                // Create a synthetic React event
                const syntheticEvent = {
                  ...e,
                  currentTarget: ruby as HTMLSpanElement,
                  target: ruby as HTMLSpanElement
                } as React.MouseEvent<HTMLSpanElement>;
                handleWordClick(word, syntheticEvent);
              }
            }
          }
        }}
      />
    );
  };

  if (showQuiz) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-900">
        <div className="max-w-4xl mx-auto p-4">
          <div className="bg-soft-white dark:bg-dark-850 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold mb-6">{t('story.quiz.title')}</h2>

          {quizScore === null ? (
            <div className="space-y-6">
              {story.quiz.map((question, qIndex) => (
                <div key={question.id} className="space-y-3">
                  <p className="font-medium">{qIndex + 1}. {question.question}</p>
                  <div className="space-y-2">
                    {question.options.map((option, oIndex) => (
                      <label key={oIndex} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                        <input
                          type="radio"
                          name={`question-${qIndex}`}
                          checked={quizAnswers[qIndex] === oIndex}
                          onChange={() => handleQuizAnswer(qIndex, oIndex)}
                          className="w-4 h-4"
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex justify-between mt-8">
                <button
                  onClick={() => setShowQuiz(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 rounded-lg transition-colors"
                >
                  {t('common.back')}
                </button>
                <button
                  onClick={handleQuizSubmit}
                  disabled={quizAnswers.length !== story.quiz.length}
                  className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50"
                >
                  {t('common.submit')}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="text-6xl mb-4">
                {quizScore >= 80 ? '🎉' : quizScore >= 60 ? '👍' : '💪'}
              </div>
              <h3 className="text-2xl font-bold">
                {quizScore >= 80 ? t('story.quiz.excellent') : quizScore >= 60 ? t('story.quiz.good') : t('story.quiz.keepPracticing')}
              </h3>
              <p className="text-xl">{t('story.quiz.yourScore')}: {quizScore}%</p>

              <div className="space-y-3 mt-6">
                {story.quiz.map((question, index) => (
                  <div key={question.id} className="text-left p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <p className="font-medium mb-2">{question.question}</p>
                    <p className={quizAnswers[index] === question.correctIndex ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      Your answer: {question.options[quizAnswers[index]]}
                    </p>
                    {quizAnswers[index] !== question.correctIndex && (
                      <p className="text-green-600 dark:text-green-400">
                        Correct: {question.options[question.correctIndex]}
                      </p>
                    )}
                    {question.explanation && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{question.explanation}</p>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={onExit}
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg mt-6"
              >
                {t('common.finish')}
              </button>
            </div>
          )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto px-4 py-6 min-h-screen pb-24 md:pb-8 bg-gray-50 dark:bg-dark-900">
        <div className="max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPageIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Header with navigation and controls */}
              <div className="flex items-center justify-end mb-6">
                <div className="relative">
                  {/* Options Menu Button */}
                  <button
                    onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                      />
                    </svg>
                    <span>Options</span>
                  </button>

                  {/* Dropdown Menu */}
                  {showOptionsMenu && (
                    <div className="absolute top-12 right-0 z-50 bg-soft-white dark:bg-dark-850 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-1 w-64">
                      {/* Audio Reader */}
                      <button
                        onClick={() => {
                          play(cleanTextForTTS(currentPage.text), { voice: 'ja-JP', rate: 0.9 });
                          setShowOptionsMenu(false);
                        }}
                        disabled={isPlaying || isCacheLoading}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-left disabled:opacity-50"
                      >
                        <span className="text-xl">🔊</span>
                        <div>
                          <div className="font-medium">Play Audio</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Listen to this page</div>
                        </div>
                      </button>

                      {/* Quiz */}
                      <button
                        onClick={() => {
                          setShowQuiz(true);
                          setShowOptionsMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-left"
                      >
                        <span className="text-xl">🎯</span>
                        <div>
                          <div className="font-medium">Comprehension Quiz</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Test your understanding</div>
                        </div>
                      </button>

                      {/* Bookmark */}
                      <button
                        onClick={() => {
                          handleBookmarkToggle();
                          setShowOptionsMenu(false);
                        }}
                        disabled={bookmarkLoading || !user}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="text-xl">{isBookmarked ? '★' : '☆'}</span>
                        <div>
                          <div className="font-medium">{isBookmarked ? 'Remove Bookmark' : 'Bookmark Story'}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {!user ? 'Login required' : 'Save for later'}
                          </div>
                        </div>
                      </button>

                      <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>

                      {/* Settings */}
                      <button
                        onClick={() => {
                          setShowSettings(true);
                          setShowOptionsMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-left"
                      >
                        <span className="text-xl">⚙️</span>
                        <div>
                          <div className="font-medium">{t('story.readingSettings')}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Font size, furigana, etc.</div>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Settings Panel (separate from menu) */}
                  {showSettings && (
                    <SettingsPanel
                      settings={settings}
                      onSettingsChange={setSettings}
                      onClose={() => setShowSettings(false)}
                    />
                  )}
                </div>
              </div>

              {/* Reading progress bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mb-6">
                <div
                  className="bg-primary-600 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${readingProgress}%` }}
                />
              </div>

              {/* Story content */}
              <div className="bg-soft-white dark:bg-dark-850 rounded-lg p-4 md:p-8 border border-gray-200 dark:border-gray-700">
                {/* Story header */}
                <header className="mb-6">
                  {/* Story metadata */}
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <span>📄 Page {currentPageIndex + 1} of {story.pages.length}</span>
                    <span>📊 {story.jlptLevel}</span>
                    <span>🏷️ {story.theme}</span>
                    <span>❓ {story.quiz?.length || 0} questions</span>
                  </div>
                </header>

                {/* Page Content - Image and Text side by side on desktop */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                  {/* Image Column - Left side on desktop */}
                  <div className="relative order-2 lg:order-1">
                    {currentPage.imageUrl && currentPage.imageUrl.trim() !== '' ? (
                      <div className="sticky top-4">
                        <img
                          src={currentPage.imageUrl}
                          alt={currentPage.imageAlt || `Page ${currentPage.pageNumber}`}
                          className="w-full rounded-lg shadow-lg object-cover"
                          style={{ maxHeight: '600px' }}
                        />
                      </div>
                    ) : (
                      <div className="hidden lg:block" /> // Empty space on desktop when no image
                    )}
                  </div>

                  {/* Text Column - Right side on desktop */}
                  <div className="space-y-4 relative order-1 lg:order-2">
                    {/* Audio Player - using TTS directly */}
                    <div className="space-y-2 mb-6">
                      <button
                        onClick={() => play(cleanTextForTTS(currentPage.text), { voice: 'ja-JP', rate: 0.9 })}
                        disabled={isPlaying || isCacheLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-900/50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <SpeakerWaveIcon className="w-5 h-5" />
                        {t('story.reader.playAudio')}
                      </button>
                      <button
                        onClick={() => setShowShadowingMode(true)}
                        className="w-full px-4 py-2 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                        </svg>
                        Shadowing Practice Mode
                      </button>
                    </div>

                    {/* Grammar Legend */}
                    {settings.highlightVocabulary && settings.highlightMode !== 'none' && (
                      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <button
                          onClick={() => setShowGrammarLegend(!showGrammarLegend)}
                          className="flex items-center gap-2 text-sm font-medium hover:text-primary-600 dark:hover:text-primary-400 transition-colors w-full text-left"
                        >
                          <svg
                            className={`w-4 h-4 transition-transform ${showGrammarLegend ? 'rotate-180' : 'rotate-0'}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          Grammar Color Guide
                        </button>
                        {showGrammarLegend && (
                          <div className="mt-3">
                            <GrammarLegend />
                          </div>
                        )}
                      </div>
                    )}

                    {renderJapaneseText(currentPage.text)}

                    {showTranslation && (
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Translation:</p>
                        <p>{currentPage.translation}</p>
                      </div>
                    )}

                    {/* Word Popup */}
                    {selectedWord && (
                      <div
                        className="absolute z-50 bg-soft-white dark:bg-dark-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 min-w-[200px]"
                        style={{
                          left: `${selectedWord.position.x}px`,
                          top: `${selectedWord.position.y + 30}px`,
                          transform: 'translateX(-50%)'
                        }}
                      >
                        {wordLookupLoading ? (
                          <div className="text-center py-2">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-bold text-lg japanese-text">{selectedWord.word}</p>
                                {selectedWord.reading && (
                                  <p className="text-sm text-gray-600 dark:text-gray-400 japanese-text">{selectedWord.reading}</p>
                                )}
                              </div>
                              <button
                                onClick={() => setSelectedWord(null)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 ml-2"
                              >
                                <XMarkIcon className="w-5 h-5" />
                              </button>
                            </div>
                            <div className="space-y-1">
                              {selectedWord.meanings?.map((meaning, index) => (
                                <p key={index} className="text-sm">{index + 1}. {meaning}</p>
                              ))}
                            </div>
                            {user && (
                              <button
                                onClick={handleSaveWord}
                                disabled={savedWords.has(selectedWord.word)}
                                className="mt-3 w-full px-3 py-1 bg-primary-600 text-white rounded text-sm disabled:bg-gray-300 disabled:text-gray-500"
                              >
                                {savedWords.has(selectedWord.word) ? t('common.saved') : 'Save Word'}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex justify-between items-center pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => handlePageChange('prev')}
                    disabled={currentPageIndex === 0}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {t('common.previous')}
                  </button>

                  <div className="flex gap-2">
                    {story.pages.map((_, index) => (
                      <div
                        key={index}
                        className={`w-2 h-2 rounded-full ${
                          index === currentPageIndex ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    onClick={() => handlePageChange('next')}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
                  >
                    {currentPageIndex === story.pages.length - 1 ? t('story.takeQuiz') : t('common.next')}
                  </button>
                </div>

              </div>
            </motion.div>
          </AnimatePresence>

          {/* Shadowing Mode Modal */}
          {showShadowingMode && (
            <ShadowingAudioPlayer
              article={{
                id: `${story.id}_page_${currentPageIndex}`,
                content: cleanTextForTTS(currentPage.text),
                title: story.title
              } as any}
              onClose={() => setShowShadowingMode(false)}
            />
          )}
        </div>
      </div>
    </>
  );
}