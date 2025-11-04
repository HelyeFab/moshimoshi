'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  MessageCircle,
  RotateCcw,
  Play,
  Pause,
  Settings,
  X,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { GrammarExplanationTrigger } from '@/components/grammar/GrammarExplanationTrigger';

// Floating Repeat Menu Component
function RepeatMenu({
  isOpen,
  currentCount,
  onSelectCount,
  onClose
}: {
  isOpen: boolean;
  currentCount: number;
  onSelectCount: (count: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [localValue, setLocalValue] = useState(currentCount);
  const quickOptions = [1, 2, 3, 5, 10];

  // Update local value when currentCount changes
  useEffect(() => {
    setLocalValue(currentCount);
  }, [currentCount]);

  if (!isOpen) return null;

  const handleDecrement = () => {
    if (localValue > 1) {
      const newValue = localValue - 1;
      setLocalValue(newValue);
      onSelectCount(newValue);
    }
  };

  const handleIncrement = () => {
    if (localValue < 10) {
      const newValue = localValue + 1;
      setLocalValue(newValue);
      onSelectCount(newValue);
    }
  };

  const handleQuickSelect = (count: number) => {
    setLocalValue(count);
    onSelectCount(count);
    setTimeout(() => onClose(), 200);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Menu */}
      <div
        className="absolute bottom-full mb-3 left-1/2 transform -translate-x-1/2 z-50"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Repeat Each Line
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          <div className="p-3 w-60">
            {/* Counter Display with +/- Controls */}
            <div className="flex items-center justify-center gap-2 mb-3">
              <button
                onClick={handleDecrement}
                disabled={localValue <= 1}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                  localValue <= 1
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                    : "bg-primary/10 hover:bg-primary/20 text-primary hover:scale-105 active:scale-95"
                )}
                title="Decrease"
              >
                <ChevronDown className="w-4 h-4" />
              </button>

              <div className="flex flex-col items-center">
                <div className="text-3xl font-bold text-primary tabular-nums">
                  {localValue}
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                  {localValue === 1 ? 'time' : 'times'}
                </div>
              </div>

              <button
                onClick={handleIncrement}
                disabled={localValue >= 10}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                  localValue >= 10
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                    : "bg-primary/10 hover:bg-primary/20 text-primary hover:scale-105 active:scale-95"
                )}
                title="Increase"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Select Buttons */}
            <div className="space-y-1.5">
              <div className="text-[10px] text-gray-500 dark:text-gray-400 text-center font-medium">
                Quick Select
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {quickOptions.map((count) => (
                  <button
                    key={count}
                    onClick={() => handleQuickSelect(count)}
                    className={cn(
                      "h-8 rounded-lg font-bold transition-all text-xs",
                      "hover:scale-105 active:scale-95",
                      count === localValue
                        ? "bg-primary text-primary-foreground shadow-lg ring-2 ring-primary/50"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    )}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            {/* Helpful Tip */}
            <div className="mt-3 p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-[10px] text-blue-800 dark:text-blue-200 text-center">
                💡 Each line plays {localValue}× before advancing
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Floating Settings Menu Component
function SettingsMenu({
  isOpen,
  onClose,
  showFurigana,
  onToggleFurigana,
  showTranslations,
  onToggleTranslations,
  displayMode,
  onDisplayModeChange,
  showVideo,
  isYouTubeMode,
  isLocalVideo,
  formattedAvailable,
  useEnhancedTranscript,
  onToggleTranscriptSource,
  showGrammar,
  onToggleGrammar,
  grammarMode,
  onGrammarModeChange
}: {
  isOpen: boolean;
  onClose: () => void;
  showFurigana?: boolean;
  onToggleFurigana?: () => void;
  showTranslations?: boolean;
  onToggleTranslations?: () => void;
  displayMode?: 'video' | 'transcript';
  onDisplayModeChange?: (mode: 'video' | 'transcript') => void;
  showVideo?: boolean;
  isYouTubeMode?: boolean;
  isLocalVideo?: boolean;
  formattedAvailable?: boolean;
  useEnhancedTranscript?: boolean;
  onToggleTranscriptSource?: (useEnhanced: boolean) => void;
  showGrammar?: boolean;
  onToggleGrammar?: () => void;
  grammarMode?: 'none' | 'all' | 'content' | 'grammar';
  onGrammarModeChange?: (mode: 'none' | 'all' | 'content' | 'grammar') => void;
}) {
  const { t } = useTranslation();
  const enhancedEnabled = Boolean(useEnhancedTranscript);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />

      {/* Menu */}
      <div
        className="absolute bottom-full mb-3 right-0 z-50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Quick Settings
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          <div className="p-3 w-60">
            <div className="space-y-2.5">
              {/* Furigana Toggle */}
              {onToggleFurigana && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                    {t('shadowing.floatingNavbar.furigana')}
                  </span>
                  <button
                    onClick={onToggleFurigana}
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                      showFurigana ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
                    )}
                  >
                    <span className={cn(
                      "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                      showFurigana ? "translate-x-5" : "translate-x-1"
                    )} />
                  </button>
                </div>
              )}

              {/* Translation Toggle */}
              {onToggleTranslations && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                    {t('shadowing.floatingNavbar.translations')}
                  </span>
                  <button
                    onClick={onToggleTranslations}
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                      showTranslations ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
                    )}
                  >
                    <span className={cn(
                      "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                      showTranslations ? "translate-x-5" : "translate-x-1"
                    )} />
                  </button>
                </div>
              )}

              {/* Grammar Colors Toggle */}
              {onToggleGrammar && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                      Grammar Colors
                    </span>
                    <button
                      onClick={onToggleGrammar}
                      className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                        showGrammar ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
                      )}
                    >
                      <span className={cn(
                        "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                        showGrammar ? "translate-x-5" : "translate-x-1"
                      )} />
                    </button>
                  </div>

                  {/* Grammar Mode Selection - shown when grammar is enabled */}
                  {showGrammar && onGrammarModeChange && (
                    <div className="pt-1">
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          onClick={() => onGrammarModeChange('all')}
                          className={cn(
                            "px-2 py-1 rounded-lg font-normal transition-all",
                            grammarMode === 'all'
                              ? 'bg-primary text-primary-foreground shadow-lg ring-1 ring-primary/50'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          )}
                          style={{ fontSize: '12px' }}
                        >
                          All
                        </button>
                        <button
                          onClick={() => onGrammarModeChange('content')}
                          className={cn(
                            "px-2 py-1 rounded-lg font-normal transition-all",
                            grammarMode === 'content'
                              ? 'bg-primary text-primary-foreground shadow-lg ring-1 ring-primary/50'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          )}
                          style={{ fontSize: '12px' }}
                        >
                          Content
                        </button>
                        <button
                          onClick={() => onGrammarModeChange('grammar')}
                          className={cn(
                            "px-2 py-1 rounded-lg font-normal transition-all",
                            grammarMode === 'grammar'
                              ? 'bg-primary text-primary-foreground shadow-lg ring-1 ring-primary/50'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          )}
                          style={{ fontSize: '12px' }}
                        >
                          Grammar
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* AI Transcript Toggle */}
              {formattedAvailable && onToggleTranscriptSource && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                    Transcript Mode
                  </span>
                  <button
                    onClick={() => onToggleTranscriptSource(!enhancedEnabled)}
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                      enhancedEnabled ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
                    )}
                  >
                    <span className={cn(
                      "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                      enhancedEnabled ? "translate-x-5" : "translate-x-1"
                    )} />
                  </button>
                </div>
              )}

              {/* Display Mode Toggle */}
              {onDisplayModeChange && showVideo && (isYouTubeMode || isLocalVideo) && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 text-center font-medium mb-2">
                    Display Mode
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => onDisplayModeChange('video')}
                      className={cn(
                        "flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg font-bold transition-all text-xs",
                        "hover:scale-105 active:scale-95",
                        displayMode === 'video'
                          ? 'bg-blue-500 text-white shadow-lg ring-2 ring-blue-500/50'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      )}
                    >
                      🎬 Video
                    </button>
                    <button
                      onClick={() => onDisplayModeChange('transcript')}
                      className={cn(
                        "flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg font-bold transition-all text-xs",
                        "hover:scale-105 active:scale-95",
                        displayMode === 'transcript'
                          ? 'bg-amber-500 text-white shadow-lg ring-2 ring-amber-500/50'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      )}
                    >
                      📄 Text
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

interface FloatingNavbarProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onRepeatChange?: () => void; // Legacy: cycles through preset values
  onRepeatCountChange?: (count: number) => void; // New: directly sets repeat count
  onSettingsOpen?: () => void;
  repeatCount: number;
  className?: string;
  // Additional props for floating menus
  showFurigana?: boolean;
  onToggleFurigana?: () => void;
  showTranslations?: boolean;
  onToggleTranslations?: () => void;
  displayMode?: 'video' | 'transcript';
  onDisplayModeChange?: (mode: 'video' | 'transcript') => void;
  showVideo?: boolean;
  isYouTubeMode?: boolean;
  isLocalVideo?: boolean;
  formattedAvailable?: boolean;
  useEnhancedTranscript?: boolean;
  onToggleTranscriptSource?: (useEnhanced: boolean) => void;
  grammarSentence?: string;
  grammarContext?: string;
  grammarSurrounding?: string[];
  grammarTitle?: string;
  showGrammar?: boolean;
  onToggleGrammar?: () => void;
  grammarMode?: 'none' | 'all' | 'content' | 'grammar';
  onGrammarModeChange?: (mode: 'none' | 'all' | 'content' | 'grammar') => void;
}

export default function FloatingNavbar({
  isPlaying,
  onPlayPause,
  onRepeatChange,
  onRepeatCountChange,
  onSettingsOpen,
  repeatCount,
  className = '',
  showFurigana,
  onToggleFurigana,
  showTranslations,
  onToggleTranslations,
  displayMode,
  onDisplayModeChange,
  showVideo,
  isYouTubeMode,
  isLocalVideo,
  formattedAvailable,
  useEnhancedTranscript,
  onToggleTranscriptSource,
  grammarSentence,
  grammarContext,
  grammarSurrounding,
  grammarTitle,
  showGrammar,
  onToggleGrammar,
  grammarMode,
  onGrammarModeChange
}: FloatingNavbarProps) {
  const { t } = useTranslation();
  const [showRepeatMenu, setShowRepeatMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const enhancedEnabled = Boolean(useEnhancedTranscript);

  const handleRepeatButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowRepeatMenu(!showRepeatMenu);
    setShowSettingsMenu(false);
  };

  const handleSettingsButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSettingsMenu(!showSettingsMenu);
    setShowRepeatMenu(false);
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      <div className={cn(
        "bg-white/10 dark:bg-black/10 backdrop-blur-md rounded-full shadow-2xl border border-white/15 dark:border-white/10 py-3 flex items-center gap-2 transition-all duration-300",
        isExpanded ? "px-4" : "px-3"
      )}>
        {!isExpanded ? (
          <button
            onClick={handleToggleExpand}
            className="p-2 rounded-full hover:bg-white/30 dark:hover:bg-white/20 transition-colors"
            title="Expand controls"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        ) : (
          <GrammarExplanationTrigger
            sentence={grammarSentence}
            context={grammarContext}
            surroundingSentences={grammarSurrounding}
            title={grammarTitle}
          >
            {({ open, loading, disabled }) => (
              <button
                className="p-2 rounded-full hover:bg-white/30 dark:hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={t('shadowing.floatingNavbar.message')}
                onClick={(e) => {
                  e.stopPropagation();
                  open();
                }}
                disabled={disabled || loading}
              >
                <MessageCircle className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>
            )}
          </GrammarExplanationTrigger>
        )}

        {/* Repeat Button */}
        {isExpanded && (
          <button
            onClick={handleRepeatButtonClick}
            className="p-2 rounded-full hover:bg-white/30 dark:hover:bg-white/20 transition-colors relative"
            title={`${t('shadowing.floatingNavbar.repeat')} (${repeatCount})`}
          >
            <RotateCcw className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            {repeatCount > 1 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium shadow-lg">
                {repeatCount}
              </span>
            )}
          </button>
        )}

        {/* Play/Pause Button - Larger and more prominent */}
        {isExpanded && (
          <button
            onClick={onPlayPause}
            className="p-3 bg-primary/90 hover:bg-primary text-primary-foreground rounded-full transition-all shadow-lg hover:shadow-xl hover:scale-105"
            title={isPlaying ? t('shadowing.floatingNavbar.pause') : t('shadowing.floatingNavbar.play')}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6 ml-0.5" />
            )}
          </button>
        )}

        {/* Settings Button */}
        {isExpanded && (
          <button
            onClick={handleSettingsButtonClick}
            className="p-2 rounded-full hover:bg-white/30 dark:hover:bg-white/20 transition-colors"
            title={t('shadowing.floatingNavbar.settings')}
          >
            <Settings className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        )}

        {/* Collapse Button */}
        {isExpanded && (
          <button
            onClick={handleToggleExpand}
            className="p-2 rounded-full hover:bg-white/30 dark:hover:bg-white/20 transition-colors"
            title="Collapse"
          >
            <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        )}
      </div>

      {/* Floating Menus */}
      <RepeatMenu
        isOpen={showRepeatMenu}
        currentCount={repeatCount}
        onSelectCount={(count) => {
          // Use the new callback if available, otherwise fall back to legacy cycle behavior
          if (onRepeatCountChange) {
            onRepeatCountChange(count);
          } else if (onRepeatChange) {
            onRepeatChange();
          }
        }}
        onClose={() => setShowRepeatMenu(false)}
      />

      <SettingsMenu
        isOpen={showSettingsMenu}
        onClose={() => setShowSettingsMenu(false)}
        showFurigana={showFurigana}
        onToggleFurigana={onToggleFurigana}
        showTranslations={showTranslations}
        onToggleTranslations={onToggleTranslations}
        displayMode={displayMode}
        onDisplayModeChange={onDisplayModeChange}
        showVideo={showVideo}
        isYouTubeMode={isYouTubeMode}
        isLocalVideo={isLocalVideo}
        formattedAvailable={formattedAvailable}
        useEnhancedTranscript={useEnhancedTranscript}
        onToggleTranscriptSource={onToggleTranscriptSource}
        showGrammar={showGrammar}
        onToggleGrammar={onToggleGrammar}
        grammarMode={grammarMode}
        onGrammarModeChange={onGrammarModeChange}
      />
    </div>
  );
}
