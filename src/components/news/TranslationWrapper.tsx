/**
 * Translation Wrapper Component
 * Simple wrapper to add translation functionality to any text
 */

'use client';

import React from 'react';
import { TranslationAssistance } from './TranslationAssistance';
import { TranslationMode } from '@/types/story';

// ============================================
// Translation Wrapper Props
// ============================================

export interface TranslationWrapperProps {
  children: React.ReactNode;
  text: string; // The Japanese text to translate
  settings: {
    translationMode: TranslationMode;
    translationUserLevel?: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
    showTranslationConfidence: boolean;
    includeGrammarNotes: boolean;
  };
  onWordSelect?: (word: string) => void;
  onVocabularyAdd?: (word: string, translation: string) => void;
  className?: string;
}

// ============================================
// Translation Wrapper Component
// ============================================

export const TranslationWrapper: React.FC<TranslationWrapperProps> = ({
  children,
  text,
  settings,
  onWordSelect,
  onVocabularyAdd,
  className = ''
}) => {
  // If translation is off, just render children
  if (settings.translationMode === 'off') {
    return <span className={className}>{children}</span>;
  }

  return (
    <TranslationAssistance
      text={text}
      mode={settings.translationMode}
      userLevel={settings.translationUserLevel || 'N5'}
      showConfidence={settings.showTranslationConfidence}
      includeGrammarNotes={settings.includeGrammarNotes}
      onWordSelect={onWordSelect}
      onVocabularyAdd={onVocabularyAdd}
      className={className}
    >
      {/* Render the original content instead of text for complex markup */}
      {children}
    </TranslationAssistance>
  );
};

// ============================================
// Sentence-Level Translation Component
// ============================================

export interface TranslationSentenceProps {
  sentence: string;
  settings: TranslationWrapperProps['settings'];
  onWordSelect?: (word: string) => void;
  onVocabularyAdd?: (word: string, translation: string) => void;
  className?: string;
  renderContent?: (sentence: string) => React.ReactNode;
}

export const TranslationSentence: React.FC<TranslationSentenceProps> = ({
  sentence,
  settings,
  onWordSelect,
  onVocabularyAdd,
  className = '',
  renderContent
}) => {
  const content = renderContent ? renderContent(sentence) : sentence;

  return (
    <TranslationWrapper
      text={sentence}
      settings={settings}
      onWordSelect={onWordSelect}
      onVocabularyAdd={onVocabularyAdd}
      className={className}
    >
      {content}
    </TranslationWrapper>
  );
};

// ============================================
// Higher-Order Component for Translation
// ============================================

export function withTranslation<P extends object>(
  WrappedComponent: React.ComponentType<P>
) {
  return function TranslatedComponent(
    props: P & {
      translationSettings?: TranslationWrapperProps['settings'];
      translationText?: string;
      onWordSelect?: (word: string) => void;
      onVocabularyAdd?: (word: string, translation: string) => void;
    }
  ) {
    const {
      translationSettings,
      translationText,
      onWordSelect,
      onVocabularyAdd,
      ...wrappedProps
    } = props;

    // If no translation settings provided, render normally
    if (!translationSettings || !translationText || translationSettings.translationMode === 'off') {
      return <WrappedComponent {...(wrappedProps as P)} />;
    }

    return (
      <TranslationWrapper
        text={translationText}
        settings={translationSettings}
        onWordSelect={onWordSelect}
        onVocabularyAdd={onVocabularyAdd}
      >
        <WrappedComponent {...(wrappedProps as P)} />
      </TranslationWrapper>
    );
  };
}

export default TranslationWrapper;