'use client';

import { useState, useMemo, memo } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import {
  Type,
  Languages,
  Palette,
  Play,
  ChevronDown,
  X,
  Settings,
  Globe,
  Lightbulb,
  BookOpen,
  GraduationCap
} from 'lucide-react';
import { ReadingSettings, TranslationMode } from '@/types/story';

interface CompactSettingsToolbarProps {
  settings: ReadingSettings;
  onSettingsChange: (settings: ReadingSettings) => void;
  isScrolled: boolean;
  isOpen: boolean;
  onClose: () => void;
}

const CompactSettingsToolbar = memo(function CompactSettingsToolbar({
  settings,
  onSettingsChange,
  isScrolled,
  isOpen,
  onClose
}: CompactSettingsToolbarProps) {
  const { t } = useI18n();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(false);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Mobile: Centered modal with settings
  const MobileSettings = () => (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 md:hidden flex items-center justify-center p-4 transition-opacity duration-200"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none'
        }}
        onClick={onClose}
      >
        {/* Settings Panel */}
        <div
          className="w-full max-w-md transition-transform duration-300"
          style={{
            transform: isOpen ? 'scale(1)' : 'scale(0.95)',
            opacity: isOpen ? 1 : 0
          }}
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
        >
          <div
            className="rounded-3xl shadow-2xl p-6 max-h-[85vh] overflow-y-auto"
            style={{
              backgroundColor: 'var(--article-bg)',
              border: '1px solid var(--article-border)'
            }}
          >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3
              className="text-xl font-bold"
              style={{ color: 'var(--article-text)' }}
            >
              {t('news.reader.settings')}
            </h3>
            <button
              onClick={onClose}
              className="p-2 rounded-xl transition-all duration-200 hover:scale-110"
              style={{
                backgroundColor: 'var(--article-hover-bg)',
                color: 'var(--article-text-secondary)'
              }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Settings Content */}
          <div className="space-y-6">
            {/* Font Size */}
            <div>
              <label
                className="text-sm font-medium block mb-3"
                style={{ color: 'var(--article-text)' }}
              >
                {t('news.reader.fontSize')}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['small', 'medium', 'large', 'xlarge'] as const).map(size => (
                  <button
                    key={size}
                    onClick={() => onSettingsChange({ ...settings, fontSize: size })}
                    className="px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95"
                    style={{
                      backgroundColor: settings.fontSize === size
                        ? 'rgb(var(--palette-primary-500))'
                        : 'var(--article-accent-bg)',
                      color: settings.fontSize === size
                        ? 'white'
                        : 'var(--article-text)'
                    }}
                  >
                    {size[0].toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Furigana Toggle */}
            <div className="flex items-center justify-between">
              <span
                className="text-sm font-medium"
                style={{ color: 'var(--article-text)' }}
              >
                {t('news.reader.showFurigana')}
              </span>
              <button
                onClick={() => onSettingsChange({ ...settings, showFurigana: !settings.showFurigana })}
                className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                style={{
                  backgroundColor: settings.showFurigana
                    ? 'rgb(var(--palette-primary-500))'
                    : 'rgb(156 163 175)' // gray-400
                }}
              >
                <span
                  className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-200 shadow-md ${
                    settings.showFurigana ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Grammar Highlighting */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-sm font-medium"
                  style={{ color: 'var(--article-text)' }}
                >
                  {t('news.reader.highlightGrammar')}
                </span>
                <button
                  onClick={() => onSettingsChange({ ...settings, highlightGrammar: !settings.highlightGrammar })}
                  className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                  style={{
                    backgroundColor: settings.highlightGrammar
                      ? 'rgb(var(--palette-primary-500))'
                      : 'rgb(156 163 175)'
                  }}
                >
                  <span
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-200 shadow-md ${
                      settings.highlightGrammar ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {settings.highlightGrammar && (
                <div className="space-y-2 ml-2">
                  {[
                    { value: 'all', label: t('news.reader.highlightAll') },
                    { value: 'content', label: t('news.reader.highlightContent') },
                    { value: 'grammar', label: t('news.reader.highlightGrammarOnly') }
                  ].map(option => (
                    <label key={option.value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="highlightMode"
                        checked={settings.highlightMode === option.value}
                        onChange={() => onSettingsChange({ ...settings, highlightMode: option.value as any })}
                        className="w-4 h-4"
                      />
                      <span
                        className="text-sm"
                        style={{ color: 'var(--article-text-secondary)' }}
                      >
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Shadowing Mode */}
            <div className="flex items-center justify-between">
              <span
                className="text-sm font-medium"
                style={{ color: 'var(--article-text)' }}
              >
                {t('news.reader.shadowingMode')}
              </span>
              <button
                onClick={() => onSettingsChange({ ...settings, shadowingMode: !settings.shadowingMode })}
                className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                style={{
                  backgroundColor: settings.shadowingMode
                    ? 'rgb(var(--palette-primary-500))'
                    : 'rgb(156 163 175)'
                }}
              >
                <span
                  className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-200 shadow-md ${
                    settings.shadowingMode ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Translation Settings */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-sm font-medium"
                  style={{ color: 'var(--article-text)' }}
                >
                  Translation Assistance
                </span>
                <button
                  onClick={() => onSettingsChange({
                    ...settings,
                    translationMode: settings.translationMode === 'off' ? 'learning' : 'off'
                  })}
                  className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                  style={{
                    backgroundColor: settings.translationMode !== 'off'
                      ? 'rgb(var(--palette-primary-500))'
                      : 'rgb(156 163 175)'
                  }}
                >
                  <span
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-200 shadow-md ${
                      settings.translationMode !== 'off' ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {settings.translationMode !== 'off' && (
                <div className="space-y-4 ml-2">
                  {/* Translation Mode */}
                  <div>
                    <label
                      className="text-xs font-medium block mb-2"
                      style={{ color: 'var(--article-text-secondary)' }}
                    >
                      Learning Mode
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { value: 'hints', label: 'Hints', icon: '💡' },
                        { value: 'partial', label: 'Partial', icon: '📝' },
                        { value: 'full', label: 'Direct', icon: '📖' },
                        { value: 'learning', label: 'Learning', icon: '🎓' }
                      ] as const).map(mode => (
                        <button
                          key={mode.value}
                          onClick={() => onSettingsChange({ ...settings, translationMode: mode.value })}
                          className="px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1"
                          style={{
                            backgroundColor: settings.translationMode === mode.value
                              ? 'rgb(var(--palette-primary-500))'
                              : 'var(--article-accent-bg)',
                            color: settings.translationMode === mode.value
                              ? 'white'
                              : 'var(--article-text)'
                          }}
                        >
                          <span>{mode.icon}</span>
                          <span>{mode.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Translation Activation: Now uses inline icons after each sentence */}
                  <div className="text-xs opacity-75" style={{ color: 'var(--article-text-secondary)' }}>
                    Translation icons appear after each sentence when enabled
                  </div>

                  {/* User Level */}
                  <div>
                    <label
                      className="text-xs font-medium block mb-2"
                      style={{ color: 'var(--article-text-secondary)' }}
                    >
                      Your Level
                    </label>
                    <div className="grid grid-cols-5 gap-1">
                      {(['N5', 'N4', 'N3', 'N2', 'N1'] as const).map(level => (
                        <button
                          key={level}
                          onClick={() => onSettingsChange({ ...settings, translationUserLevel: level })}
                          className="px-2 py-1 rounded text-xs font-medium transition-all duration-200"
                          style={{
                            backgroundColor: settings.translationUserLevel === level
                              ? 'rgb(var(--palette-primary-500))'
                              : 'var(--article-accent-bg)',
                            color: settings.translationUserLevel === level
                              ? 'white'
                              : 'var(--article-text)'
                          }}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Additional Options */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.showTranslationConfidence}
                        onChange={(e) => onSettingsChange({
                          ...settings,
                          showTranslationConfidence: e.target.checked
                        })}
                        className="w-3 h-3"
                      />
                      <span
                        className="text-xs"
                        style={{ color: 'var(--article-text-secondary)' }}
                      >
                        Show confidence scores
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.includeGrammarNotes}
                        onChange={(e) => onSettingsChange({
                          ...settings,
                          includeGrammarNotes: e.target.checked
                        })}
                        className="w-3 h-3"
                      />
                      <span
                        className="text-xs"
                        style={{ color: 'var(--article-text-secondary)' }}
                      >
                        Include grammar notes
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.autoAddToVocabulary}
                        onChange={(e) => onSettingsChange({
                          ...settings,
                          autoAddToVocabulary: e.target.checked
                        })}
                        className="w-3 h-3"
                      />
                      <span
                        className="text-xs"
                        style={{ color: 'var(--article-text-secondary)' }}
                      >
                        Auto-add to vocabulary
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>
    </>
  );

  // Desktop: Floating toolbar with collapse functionality
  const DesktopToolbar = () => (
    <>
      <style jsx>{`
        @keyframes expandWidth {
          0% {
            opacity: 0;
            transform: scale(0.7) translateX(20px);
          }
          60% {
            opacity: 1;
          }
          100% {
            opacity: 1;
            transform: scale(1) translateX(0);
          }
        }
      `}</style>
      <div
        className={`fixed bottom-6 right-6 z-40 transition-all duration-300 hidden md:block ${
          isScrolled ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-90'
        }`}
      >
        <div className="max-w-lg mx-auto lg:ml-auto lg:mr-0">
        {/* Collapsed: Single Settings Button */}
        {!isToolbarExpanded && (
          <button
            onClick={() => setIsToolbarExpanded(true)}
            className="w-14 h-14 rounded-full shadow-2xl backdrop-blur-xl flex items-center justify-center hover:scale-110 active:scale-95"
            style={{
              backgroundColor: 'var(--article-bg)',
              border: '1px solid var(--article-border)',
              boxShadow: '0 20px 25px -5px var(--article-shadow), 0 10px 10px -5px var(--article-shadow)',
              transition: 'transform 0.2s ease'
            }}
            title={t('news.reader.settings')}
          >
            <Settings className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </button>
        )}

        {/* Expanded: Full Toolbar */}
        {isToolbarExpanded && (
          <>
            <div
              className="rounded-full shadow-2xl backdrop-blur-xl px-4 py-3 flex items-center justify-between gap-3"
              style={{
                backgroundColor: 'var(--article-bg)',
                border: '1px solid var(--article-border)',
                boxShadow: '0 20px 25px -5px var(--article-shadow), 0 10px 10px -5px var(--article-shadow)',
                animation: 'expandWidth 0.8s cubic-bezier(0.22, 0.61, 0.36, 1) forwards'
              }}
            >
              {/* Font Size Button */}
              <button
                onClick={() => toggleSection('fontSize')}
                className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 relative"
                style={{
                  backgroundColor: expandedSection === 'fontSize' ? 'var(--article-hover-bg)' : 'transparent',
                  color: 'var(--article-text)'
                }}
                title={t('news.reader.fontSize')}
              >
                <Type className="w-5 h-5" />
                <span className="hidden sm:inline text-sm font-medium">{settings.fontSize[0].toUpperCase()}</span>
              </button>

              {/* Furigana Toggle */}
              <button
                onClick={() => onSettingsChange({ ...settings, showFurigana: !settings.showFurigana })}
                className="px-3 py-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: settings.showFurigana ? 'rgb(var(--palette-primary-500) / 0.15)' : 'transparent',
                  color: settings.showFurigana ? 'rgb(var(--palette-primary-600))' : 'var(--article-text-secondary)'
                }}
                title={t('news.reader.showFurigana')}
              >
                <Languages className="w-5 h-5" />
              </button>

              {/* Grammar Highlighting Toggle */}
              <button
                onClick={() => toggleSection('grammar')}
                className="px-3 py-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: settings.highlightGrammar ? 'rgb(var(--palette-primary-500) / 0.15)' : 'transparent',
                  color: settings.highlightGrammar ? 'rgb(var(--palette-primary-600))' : 'var(--article-text-secondary)'
                }}
                title={t('news.reader.highlightGrammar')}
              >
                <Palette className="w-5 h-5" />
              </button>

              {/* Audio Toggle */}
              <button
                onClick={() => onSettingsChange({ ...settings, shadowingMode: !settings.shadowingMode })}
                className="px-3 py-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: settings.shadowingMode ? 'rgb(var(--palette-primary-500) / 0.15)' : 'transparent',
                  color: settings.shadowingMode ? 'rgb(var(--palette-primary-600))' : 'var(--article-text-secondary)'
                }}
                title={t('news.reader.shadowingMode')}
              >
                <Play className="w-5 h-5" />
              </button>

              {/* Translation Toggle */}
              <button
                onClick={() => toggleSection('translation')}
                className="px-3 py-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: settings.translationMode !== 'off' ? 'rgb(var(--palette-primary-500) / 0.15)' : 'transparent',
                  color: settings.translationMode !== 'off' ? 'rgb(var(--palette-primary-600))' : 'var(--article-text-secondary)'
                }}
                title="Translation Assistance"
              >
                <Globe className="w-5 h-5" />
              </button>

              {/* Close/Collapse Button */}
              <button
                onClick={() => {
                  setIsToolbarExpanded(false);
                  setExpandedSection(null);
                }}
                className="px-2 py-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
                style={{
                  color: 'var(--article-text-secondary)'
                }}
                title="Collapse"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Expanded Sections */}
            {expandedSection === 'fontSize' && (
              <div
                className="mt-3 rounded-2xl shadow-xl backdrop-blur-xl p-4 animate-scale-in"
                style={{
                  backgroundColor: 'var(--article-bg)',
                  border: '1px solid var(--article-border)'
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="text-sm font-medium"
                    style={{ color: 'var(--article-text)' }}
                  >
                    {t('news.reader.fontSize')}
                  </span>
                  <button
                    onClick={() => setExpandedSection(null)}
                    style={{ color: 'var(--article-text-secondary)' }}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {(['small', 'medium', 'large', 'xlarge'] as const).map(size => (
                    <button
                      key={size}
                      onClick={() => {
                        onSettingsChange({ ...settings, fontSize: size });
                        setExpandedSection(null);
                      }}
                      className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95"
                      style={{
                        backgroundColor: settings.fontSize === size
                          ? 'rgb(var(--palette-primary-500))'
                          : 'var(--article-accent-bg)',
                        color: settings.fontSize === size
                          ? 'white'
                          : 'var(--article-text)'
                      }}
                    >
                      {size[0].toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {expandedSection === 'grammar' && (
              <div
                className="mt-3 rounded-2xl shadow-xl backdrop-blur-xl p-4 animate-scale-in"
                style={{
                  backgroundColor: 'var(--article-bg)',
                  border: '1px solid var(--article-border)'
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="text-sm font-medium"
                    style={{ color: 'var(--article-text)' }}
                  >
                    {t('news.reader.highlightGrammar')}
                  </span>
                  <button
                    onClick={() => setExpandedSection(null)}
                    style={{ color: 'var(--article-text-secondary)' }}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                <label className="flex items-center gap-3 mb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.highlightGrammar}
                    onChange={(e) => onSettingsChange({ ...settings, highlightGrammar: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <span
                    className="text-sm"
                    style={{ color: 'var(--article-text)' }}
                  >
                    Enable highlighting
                  </span>
                </label>

                {settings.highlightGrammar && (
                  <div className="space-y-2 ml-1">
                    {[
                      { value: 'all', label: t('news.reader.highlightAll') },
                      { value: 'content', label: t('news.reader.highlightContent') },
                      { value: 'grammar', label: t('news.reader.highlightGrammarOnly') }
                    ].map(option => (
                      <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="highlightMode"
                          checked={settings.highlightMode === option.value}
                          onChange={() => onSettingsChange({ ...settings, highlightMode: option.value as any })}
                          className="w-3.5 h-3.5"
                        />
                        <span
                          className="text-sm"
                          style={{ color: 'var(--article-text-secondary)' }}
                        >
                          {option.label}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {expandedSection === 'translation' && (
              <div
                className="mt-3 rounded-2xl shadow-xl backdrop-blur-xl p-4 animate-scale-in"
                style={{
                  backgroundColor: 'var(--article-bg)',
                  border: '1px solid var(--article-border)'
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="text-sm font-medium"
                    style={{ color: 'var(--article-text)' }}
                  >
                    Translation Assistance
                  </span>
                  <button
                    onClick={() => setExpandedSection(null)}
                    style={{ color: 'var(--article-text-secondary)' }}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  {/* Enable/Disable Toggle */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.translationMode !== 'off'}
                      onChange={(e) => onSettingsChange({
                        ...settings,
                        translationMode: e.target.checked ? 'learning' : 'off'
                      })}
                      className="w-4 h-4 rounded"
                    />
                    <span
                      className="text-sm"
                      style={{ color: 'var(--article-text)' }}
                    >
                      Enable translation assistance
                    </span>
                  </label>

                  {settings.translationMode !== 'off' && (
                    <>
                      {/* Translation Mode */}
                      <div>
                        <label
                          className="text-xs font-medium block mb-2"
                          style={{ color: 'var(--article-text-secondary)' }}
                        >
                          Learning Mode
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { value: 'hints', label: 'Hints', icon: <Lightbulb className="w-3 h-3" /> },
                            { value: 'partial', label: 'Partial', icon: <BookOpen className="w-3 h-3" /> },
                            { value: 'full', label: 'Direct', icon: <Globe className="w-3 h-3" /> },
                            { value: 'learning', label: 'Learning', icon: <GraduationCap className="w-3 h-3" /> }
                          ] as const).map(mode => (
                            <button
                              key={mode.value}
                              onClick={() => onSettingsChange({ ...settings, translationMode: mode.value })}
                              className="px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1"
                              style={{
                                backgroundColor: settings.translationMode === mode.value
                                  ? 'rgb(var(--palette-primary-500))'
                                  : 'var(--article-accent-bg)',
                                color: settings.translationMode === mode.value
                                  ? 'white'
                                  : 'var(--article-text)'
                              }}
                            >
                              {mode.icon}
                              <span>{mode.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>


                      {/* User Level */}
                      <div>
                        <label
                          className="text-xs font-medium block mb-2"
                          style={{ color: 'var(--article-text-secondary)' }}
                        >
                          JLPT Level
                        </label>
                        <div className="flex gap-1">
                          {(['N5', 'N4', 'N3', 'N2', 'N1'] as const).map(level => (
                            <button
                              key={level}
                              onClick={() => onSettingsChange({ ...settings, translationUserLevel: level })}
                              className="px-2 py-1 rounded text-xs font-medium transition-all duration-200 flex-1"
                              style={{
                                backgroundColor: settings.translationUserLevel === level
                                  ? 'rgb(var(--palette-primary-500))'
                                  : 'var(--article-accent-bg)',
                                color: settings.translationUserLevel === level
                                  ? 'white'
                                  : 'var(--article-text)'
                              }}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
    </>
  );

  return (
    <>
      {/* Mobile Settings - always mounted, visibility controlled by CSS */}
      <MobileSettings />

      {/* Desktop Toolbar - always visible on desktop */}
      <DesktopToolbar />
    </>
  );
});

export default CompactSettingsToolbar;
