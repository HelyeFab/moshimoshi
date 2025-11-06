# Hybrid Conjugation Help System - Implementation Plan

**Version**: 2.0 (Hybrid)
**Date**: 2025-01-10
**Approach**: Smart Error Detection + Manual Contextual Tips

---

## 🎯 Hybrid Design Overview

### Two Complementary Modes

```
┌─────────────────────────────────────────────────────────┐
│                    SMART MODE                           │
│  Automatic • Error-Triggered • Reactive                 │
│  → Shows modal after mistakes with explanation          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   MANUAL MODE                            │
│  User-Initiated • Contextual • Proactive                │
│  → Tooltip (hover) + Modal (click) for any form         │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 What You Already Have

✅ **Modal Component** (`src/components/ui/Modal.tsx`)
- Sizes: sm, md, lg, xl
- Close on overlay/ESC
- Portal rendering
- Focus trap

✅ **Tooltip Component** (`src/components/ui/Tooltip.tsx`)
- Positioning: top, bottom, left, right
- Auto-positioning when off-screen
- Delay support
- Portal rendering

✅ **Pattern**: GrammarExplanationTrigger
- Render props pattern
- Entitlement checking
- Loading states
- Caching

---

## 🏗️ New Components to Build

### 1. Help Content Library

```typescript
// src/data/conjugation-help/help-content.ts

export interface HelpContent {
  id: string;
  category: 'verb-type' | 'form' | 'tense' | 'special-case' | 'mnemonic';

  // Display content
  emoji: string;
  title: string;
  tooltip: string;           // Short version (for hover)
  explanation: string;       // Full version (for modal)
  examples: Array<{
    japanese: string;
    romaji?: string;
    translation?: string;
  }>;
  tip?: string;              // Optional memory aid

  // Trigger conditions
  triggers: {
    formTypes: string[];     // ['teForm', 'past', ...]
    wordTypes: string[];     // ['Godan', 'Ichidan', ...]
    errorPatterns?: string[]; // For smart mode
  };
}

// Example content
export const HELP_CONTENT: HelpContent[] = [
  {
    id: 'godan-te-form-utsu-ru',
    category: 'form',
    emoji: '🧠',
    title: 'Godan Te-Form: う・つ・る Group',

    tooltip: 'Verbs ending in う, つ, or る use って for te-form',

    explanation: `For verbs ending in う, つ, or る, the te-form uses って!

The past tense follows the same pattern with った.

**Memory trick**: Think of "small tsu-boys" - they all use the っ sound.`,

    examples: [
      { japanese: '買う → 買って', romaji: 'kau → katte', translation: 'to buy' },
      { japanese: '待つ → 待って', romaji: 'matsu → matte', translation: 'to wait' },
      { japanese: '帰る → 帰って', romaji: 'kaeru → kaette', translation: 'to return' }
    ],

    tip: 'If you see う, つ, or る at the end - use って!',

    triggers: {
      formTypes: ['teForm', 'past'],
      wordTypes: ['Godan'],
      errorPatterns: ['かうて', 'かいて', 'まちて', 'まつて', 'かえりて', 'かえるて']
    }
  },

  {
    id: 'ichidan-simple',
    category: 'verb-type',
    emoji: '💧',
    title: 'Ichidan Verbs - The Easy Ones!',

    tooltip: 'Just drop る to conjugate',

    explanation: `Ichidan verbs (also called ru-verbs) are the easiest!

**Simple rule**: Drop the final る and add your ending.

Most Ichidan verbs end with **える** or **いる** sounds before the る.`,

    examples: [
      { japanese: '食べる → 食べます', romaji: 'taberu → tabemasu', translation: 'to eat' },
      { japanese: '見る → 見た', romaji: 'miru → mita', translation: 'to see' },
      { japanese: '寝る → 寝ない', romaji: 'neru → nenai', translation: 'to sleep' }
    ],

    tip: 'Look for e-sound or i-sound before る!',

    triggers: {
      formTypes: ['all'],
      wordTypes: ['Ichidan']
    }
  },

  {
    id: 'iku-exception',
    category: 'special-case',
    emoji: '⚡',
    title: 'Special Case: 行く (iku)',

    tooltip: '行く is the ONLY く-verb that uses って',

    explanation: `行く (iku - "to go") is special!

Even though it ends in く, it uses って/った instead of いて/いた.

**Why?** Historical sound change. It's the ONLY verb with this exception.`,

    examples: [
      { japanese: '行く → 行って', romaji: 'iku → itte', translation: 'going' },
      { japanese: '行く → 行った', romaji: 'iku → itta', translation: 'went' },
      { japanese: '❌ 行いて (WRONG)', romaji: '❌ iite' }
    ],

    tip: 'Remember: 行く breaks the く rule!',

    triggers: {
      formTypes: ['teForm', 'past'],
      wordTypes: ['Godan'],
      errorPatterns: ['行いて', '行いた', 'いいて', 'いいた']
    }
  },

  {
    id: 'ii-exception',
    category: 'special-case',
    emoji: '✨',
    title: 'Special Case: いい/良い',

    tooltip: 'いい uses よ stem for conjugations',

    explanation: `The adjective いい (good) is special!

For conjugations, it uses the よ stem (from the original form 良い - yoi).

**Only the dictionary form stays as いい** - everything else uses よ.`,

    examples: [
      { japanese: 'いい (dictionary form)', translation: 'good' },
      { japanese: 'よかった (past)', romaji: 'yokatta', translation: 'was good' },
      { japanese: 'よくない (negative)', romaji: 'yokunai', translation: 'not good' },
      { japanese: '❌ いかった (WRONG)', romaji: '❌ ikatta' }
    ],

    tip: '"Good is good, but better is よかった!"',

    triggers: {
      formTypes: ['all'],
      wordTypes: ['i-adjective'],
      errorPatterns: ['いかった', 'いくない', 'いくて']
    }
  },

  {
    id: 'tai-form',
    category: 'form',
    emoji: '🍽️',
    title: 'Tai-Form: Want to...',

    tooltip: 'Use masu-stem + たい to express desire',

    explanation: `The tai-form expresses what you want to do!

**Formation**: masu-stem + たい

**Important**: After adding たい, it conjugates like an i-adjective.`,

    examples: [
      { japanese: '食べる → 食べたい', romaji: 'taberu → tabetai', translation: 'want to eat' },
      { japanese: '買う → 買いたい', romaji: 'kau → kaitai', translation: 'want to buy' },
      { japanese: '食べたくない', romaji: 'tabetakunai', translation: "don't want to eat" },
      { japanese: '食べたかった', romaji: 'tabetakatta', translation: 'wanted to eat' }
    ],

    tip: 'Tai-form = i-adjective behavior!',

    triggers: {
      formTypes: ['taiForm', 'taiFormNegative', 'taiFormPast'],
      wordTypes: ['Godan', 'Ichidan', 'Irregular']
    }
  },

  {
    id: 'potential-can',
    category: 'form',
    emoji: '💪',
    title: 'Potential Form: Can...',

    tooltip: 'Express ability - different patterns for Godan vs Ichidan',

    explanation: `The potential form means "can do" or "able to do".

**Ichidan**: Add られる
- 食べる → 食べられる (can eat)

**Godan**: Change to e-stem + る
- 買う → 買える (can buy)
- 書く → 書ける (can write)

**Casual speech**: Often drops ら from Ichidan (食べれる)`,

    examples: [
      { japanese: '食べられる', romaji: 'taberareru', translation: 'can eat (Ichidan)' },
      { japanese: '買える', romaji: 'kaeru', translation: 'can buy (Godan)' },
      { japanese: '食べれる', romaji: 'tabereru', translation: 'can eat (casual)' }
    ],

    tip: 'Godan → e-line shift, Ichidan → add られる',

    triggers: {
      formTypes: ['potential', 'potentialNegative'],
      wordTypes: ['Godan', 'Ichidan']
    }
  },

  {
    id: 'ba-vs-tara',
    category: 'form',
    emoji: '🌤️',
    title: 'Conditionals: ば vs たら',

    tooltip: 'ば = hypothetical, たら = specific/sequential',

    explanation: `Both mean "if", but with different nuances:

**たら (Conditional)**:
- Specific one-time events
- Sequential actions ("when/after")
- Most versatile for beginners

**ば (Provisional)**:
- Hypothetical conditions
- General truths
- "If [condition], then [result]"`,

    examples: [
      { japanese: '帰ったら電話して', romaji: 'kaettara denwa shite', translation: 'Call me when you get home (たら)' },
      { japanese: '春になれば花が咲く', romaji: 'haru ni nareba hana ga saku', translation: 'When spring comes, flowers bloom (ば)' }
    ],

    tip: 'When in doubt, use たら - it\'s more versatile!',

    triggers: {
      formTypes: ['conditional', 'provisional', 'conditionalNegative', 'provisionalNegative'],
      wordTypes: ['all']
    }
  },

  {
    id: 'plain-vs-polite',
    category: 'tense',
    emoji: '🗣️',
    title: 'Plain vs Polite Forms',

    tooltip: 'Polite (ます/です) for formal, plain for casual',

    explanation: `Japanese has different politeness levels:

**Polite Form** (ます/です):
- Safe for all conversations
- Use with strangers, customers, teachers
- Standard for business
- Great for N5 learners

**Plain Form**:
- Casual with friends/family
- Used in grammar patterns
- Too direct with strangers = rude!`,

    examples: [
      { japanese: '食べます (polite)', romaji: 'tabemasu', translation: 'eat/will eat' },
      { japanese: '食べる (plain)', romaji: 'taberu', translation: 'eat/will eat' },
      { japanese: '買いました (polite past)', romaji: 'kaimashita', translation: 'bought' },
      { japanese: '買った (plain past)', romaji: 'katta', translation: 'bought' }
    ],

    tip: 'When in doubt, use polite form!',

    triggers: {
      formTypes: ['polite', 'politePast', 'politeNegative'],
      wordTypes: ['all']
    }
  }
];
```

---

### 2. Smart Error Analyzer

```typescript
// src/lib/conjugation-help/error-analyzer.ts

import { HelpContent, HELP_CONTENT } from '@/data/conjugation-help/help-content';
import type { EnhancedJapaneseWord } from '@/utils/enhancedWordTypeDetection';
import type { ExtendedConjugationForms } from '@/types/conjugation';

export interface ErrorAnalysis {
  userAnswer: string;
  correctAnswer: string;
  word: EnhancedJapaneseWord;
  formType: keyof ExtendedConjugationForms;

  // Analysis results
  hasError: boolean;
  errorType: ErrorType;
  relevantHelp: HelpContent[];
}

export type ErrorType =
  | 'perfect'           // No error
  | 'minor-typo'        // Close, probably typo
  | 'wrong-pattern'     // Wrong conjugation pattern
  | 'wrong-verb-type'   // Confused Godan/Ichidan
  | 'special-case'      // Missed exception (行く, いい)
  | 'wrong-politeness'  // Plain vs polite confusion
  | 'completely-wrong'; // Not even close

export class ConjugationErrorAnalyzer {
  /**
   * Analyze a user's answer and find relevant help
   */
  static analyze(
    userAnswer: string,
    correctAnswer: string,
    word: EnhancedJapaneseWord,
    formType: keyof ExtendedConjugationForms
  ): ErrorAnalysis {
    const normalized = {
      user: this.normalize(userAnswer),
      correct: this.normalize(correctAnswer)
    };

    // Perfect match
    if (normalized.user === normalized.correct) {
      return {
        userAnswer,
        correctAnswer,
        word,
        formType,
        hasError: false,
        errorType: 'perfect',
        relevantHelp: []
      };
    }

    // Detect error type
    const errorType = this.detectErrorType(
      normalized.user,
      normalized.correct,
      word,
      formType
    );

    // Find relevant help content
    const relevantHelp = this.findRelevantHelp(
      normalized.user,
      word,
      formType,
      errorType
    );

    return {
      userAnswer,
      correctAnswer,
      word,
      formType,
      hasError: true,
      errorType,
      relevantHelp
    };
  }

  /**
   * Normalize text for comparison
   */
  private static normalize(text: string): string {
    return text
      .trim()
      .toLowerCase()
      // Remove common particles that might be accidentally included
      .replace(/[をはがに]$/, '');
  }

  /**
   * Detect what type of error was made
   */
  private static detectErrorType(
    userAnswer: string,
    correctAnswer: string,
    word: EnhancedJapaneseWord,
    formType: keyof ExtendedConjugationForms
  ): ErrorType {
    // Check for special case errors (行く, いい)
    if (this.isSpecialCaseError(userAnswer, word)) {
      return 'special-case';
    }

    // Calculate similarity
    const similarity = this.calculateSimilarity(userAnswer, correctAnswer);

    if (similarity > 0.9) {
      return 'minor-typo';
    }

    // Check if verb type was confused
    if (this.isVerbTypeConfusion(userAnswer, correctAnswer, word, formType)) {
      return 'wrong-verb-type';
    }

    // Check if wrong politeness level
    if (this.isPolitenessError(userAnswer, correctAnswer, formType)) {
      return 'wrong-politeness';
    }

    // Check if wrong pattern used
    if (similarity > 0.5) {
      return 'wrong-pattern';
    }

    return 'completely-wrong';
  }

  /**
   * Check if this is a special case error (行く → 行いて, いい → いかった)
   */
  private static isSpecialCaseError(
    userAnswer: string,
    word: EnhancedJapaneseWord
  ): boolean {
    const base = word.kanji || word.kana;

    // Check for 行く exception
    if (base === '行く' || base === 'いく') {
      return userAnswer.includes('行い') || userAnswer.includes('いい');
    }

    // Check for いい exception
    if (base === 'いい' || base === '良い') {
      return userAnswer.includes('いか') || userAnswer.includes('いく');
    }

    return false;
  }

  /**
   * Check if user confused Godan with Ichidan or vice versa
   */
  private static isVerbTypeConfusion(
    userAnswer: string,
    correctAnswer: string,
    word: EnhancedJapaneseWord,
    formType: keyof ExtendedConjugationForms
  ): boolean {
    const base = word.kanji || word.kana;

    // Godan treated as Ichidan (just dropped る)
    if (word.conjugationType === 'Godan' && base.endsWith('る')) {
      const stem = base.slice(0, -1);
      // Check if user just dropped る (Ichidan pattern)
      return userAnswer.startsWith(stem);
    }

    // Ichidan treated as Godan (wrong stem transformation)
    if (word.conjugationType === 'Ichidan') {
      // This would show wrong consonant patterns
      const correctStem = base.slice(0, -1);
      return !userAnswer.startsWith(correctStem);
    }

    return false;
  }

  /**
   * Check if wrong politeness level used
   */
  private static isPolitenessError(
    userAnswer: string,
    correctAnswer: string,
    formType: keyof ExtendedConjugationForms
  ): boolean {
    const politeMarkers = ['ます', 'ました', 'ません', 'ませんでした'];
    const hasPoliteMarker = (text: string) =>
      politeMarkers.some(marker => text.includes(marker));

    const userIsPolite = hasPoliteMarker(userAnswer);
    const correctIsPolite = hasPoliteMarker(correctAnswer);

    return userIsPolite !== correctIsPolite;
  }

  /**
   * Calculate similarity between two strings
   */
  private static calculateSimilarity(a: string, b: string): number {
    const distance = this.levenshteinDistance(a, b);
    const maxLength = Math.max(a.length, b.length);
    return 1 - (distance / maxLength);
  }

  /**
   * Levenshtein distance algorithm
   */
  private static levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Find relevant help content for this error
   */
  private static findRelevantHelp(
    userAnswer: string,
    word: EnhancedJapaneseWord,
    formType: keyof ExtendedConjugationForms,
    errorType: ErrorType
  ): HelpContent[] {
    const candidates: Array<{ content: HelpContent; score: number }> = [];

    for (const content of HELP_CONTENT) {
      let score = 0;

      // Match by form type
      if (
        content.triggers.formTypes.includes('all') ||
        content.triggers.formTypes.includes(formType)
      ) {
        score += 30;
      }

      // Match by word type
      if (
        content.triggers.wordTypes.includes('all') ||
        content.triggers.wordTypes.includes(word.conjugationType || '')
      ) {
        score += 20;
      }

      // Match by error pattern
      if (content.triggers.errorPatterns) {
        const hasPatternMatch = content.triggers.errorPatterns.some(pattern =>
          userAnswer.includes(pattern)
        );
        if (hasPatternMatch) {
          score += 50; // High priority for exact pattern match
        }
      }

      // Boost for special cases
      if (errorType === 'special-case' && content.category === 'special-case') {
        score += 40;
      }

      // Boost for verb type confusion
      if (errorType === 'wrong-verb-type' && content.category === 'verb-type') {
        score += 40;
      }

      if (score > 0) {
        candidates.push({ content, score });
      }
    }

    // Sort by score and return top 2
    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map(c => c.content);
  }
}
```

---

### 3. Help Icon Component

```typescript
// src/components/conjugation-help/HelpIcon.tsx

'use client';

import { HelpCircle } from 'lucide-react';
import Tooltip from '@/components/ui/Tooltip';
import { HELP_CONTENT } from '@/data/conjugation-help/help-content';
import type { ExtendedConjugationForms } from '@/types/conjugation';

interface HelpIconProps {
  formType: keyof ExtendedConjugationForms;
  wordType: string;
  onClick: () => void;
  className?: string;
}

export function HelpIcon({
  formType,
  wordType,
  onClick,
  className = ''
}: HelpIconProps) {
  // Find relevant help content
  const helpContent = HELP_CONTENT.find(content =>
    (content.triggers.formTypes.includes('all') ||
     content.triggers.formTypes.includes(formType)) &&
    (content.triggers.wordTypes.includes('all') ||
     content.triggers.wordTypes.includes(wordType))
  );

  if (!helpContent) {
    return null;
  }

  return (
    <Tooltip
      content={
        <div className="max-w-xs">
          <div className="font-semibold mb-1">{helpContent.emoji} {helpContent.title}</div>
          <div className="text-xs">{helpContent.tooltip}</div>
        </div>
      }
      position="top"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={`
          p-1 rounded-full
          text-gray-400 hover:text-primary-500 hover:bg-primary-50
          dark:text-gray-500 dark:hover:text-primary-400 dark:hover:bg-primary-900/20
          transition-colors
          ${className}
        `}
        aria-label="Show explanation"
      >
        <HelpCircle size={16} />
      </button>
    </Tooltip>
  );
}
```

---

### 4. Help Modal Component

```typescript
// src/components/conjugation-help/HelpModal.tsx

'use client';

import Modal from '@/components/ui/Modal';
import { HelpContent } from '@/data/conjugation-help/help-content';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: HelpContent | null;
}

export function HelpModal({ isOpen, onClose, content }: HelpModalProps) {
  if (!content) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${content.emoji} ${content.title}`}
      size="lg"
    >
      {/* Main Explanation */}
      <div className="prose dark:prose-invert max-w-none">
        <div className="text-gray-700 dark:text-gray-300 whitespace-pre-line mb-6">
          {content.explanation}
        </div>

        {/* Examples */}
        {content.examples.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Examples:
            </h4>
            <div className="space-y-2">
              {content.examples.map((ex, i) => (
                <div
                  key={i}
                  className="
                    p-3 rounded-lg
                    bg-gray-50 dark:bg-gray-800
                    border border-gray-200 dark:border-gray-700
                  "
                >
                  <div className="font-japanese text-lg text-gray-900 dark:text-gray-100">
                    {ex.japanese}
                  </div>
                  {ex.romaji && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {ex.romaji}
                    </div>
                  )}
                  {ex.translation && (
                    <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                      {ex.translation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tip */}
        {content.tip && (
          <div className="
            p-4 rounded-lg
            bg-yellow-50 dark:bg-yellow-900/20
            border-l-4 border-yellow-400 dark:border-yellow-600
          ">
            <div className="flex items-start gap-2">
              <span className="text-xl">💡</span>
              <div className="flex-1">
                <div className="font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
                  Quick Tip
                </div>
                <div className="text-sm text-yellow-800 dark:text-yellow-300">
                  {content.tip}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="
            px-4 py-2 rounded-lg
            bg-primary-500 hover:bg-primary-600
            text-white font-medium
            transition-colors
          "
        >
          Got it!
        </button>
      </div>
    </Modal>
  );
}
```

---

### 5. Context Provider & Hook

```typescript
// src/hooks/useConjugationHelp.tsx

'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { HelpModal } from '@/components/conjugation-help/HelpModal';
import { ConjugationErrorAnalyzer, ErrorAnalysis } from '@/lib/conjugation-help/error-analyzer';
import { HelpContent, HELP_CONTENT } from '@/data/conjugation-help/help-content';
import type { EnhancedJapaneseWord } from '@/utils/enhancedWordTypeDetection';
import type { ExtendedConjugationForms } from '@/types/conjugation';

interface ConjugationHelpContextValue {
  // Manual mode - user clicks help icon
  showHelpFor: (formType: keyof ExtendedConjugationForms, wordType: string) => void;

  // Smart mode - auto-trigger after error
  analyzeAnswer: (
    userAnswer: string,
    correctAnswer: string,
    word: EnhancedJapaneseWord,
    formType: keyof ExtendedConjugationForms
  ) => ErrorAnalysis;

  showHelpForError: (analysis: ErrorAnalysis) => void;
}

const ConjugationHelpContext = createContext<ConjugationHelpContextValue | null>(null);

export function ConjugationHelpProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentHelp, setCurrentHelp] = useState<HelpContent | null>(null);

  // Manual mode: Show help for a specific form/word type
  const showHelpFor = useCallback((
    formType: keyof ExtendedConjugationForms,
    wordType: string
  ) => {
    const helpContent = HELP_CONTENT.find(content =>
      (content.triggers.formTypes.includes('all') ||
       content.triggers.formTypes.includes(formType)) &&
      (content.triggers.wordTypes.includes('all') ||
       content.triggers.wordTypes.includes(wordType))
    );

    if (helpContent) {
      setCurrentHelp(helpContent);
      setIsOpen(true);
    }
  }, []);

  // Smart mode: Analyze answer
  const analyzeAnswer = useCallback((
    userAnswer: string,
    correctAnswer: string,
    word: EnhancedJapaneseWord,
    formType: keyof ExtendedConjugationForms
  ): ErrorAnalysis => {
    return ConjugationErrorAnalyzer.analyze(
      userAnswer,
      correctAnswer,
      word,
      formType
    );
  }, []);

  // Smart mode: Show help based on error analysis
  const showHelpForError = useCallback((analysis: ErrorAnalysis) => {
    if (!analysis.hasError || analysis.relevantHelp.length === 0) {
      return;
    }

    // Show the most relevant help (first in the array)
    setCurrentHelp(analysis.relevantHelp[0]);
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <ConjugationHelpContext.Provider
      value={{
        showHelpFor,
        analyzeAnswer,
        showHelpForError
      }}
    >
      {children}
      <HelpModal
        isOpen={isOpen}
        onClose={handleClose}
        content={currentHelp}
      />
    </ConjugationHelpContext.Provider>
  );
}

export function useConjugationHelp() {
  const context = useContext(ConjugationHelpContext);
  if (!context) {
    throw new Error('useConjugationHelp must be used within ConjugationHelpProvider');
  }
  return context;
}
```

---

## 🔌 Integration Examples

### Integration 1: Drill Page (Smart Mode)

```typescript
// src/app/drill/page.tsx

import { ConjugationHelpProvider, useConjugationHelp } from '@/hooks/useConjugationHelp';

function DrillContent() {
  const { analyzeAnswer, showHelpForError } = useConjugationHelp();
  const [showError, setShowError] = useState(false);

  const handleSubmitAnswer = (userAnswer: string) => {
    const correct = currentQuestion.correctAnswer;

    if (userAnswer === correct) {
      // Correct! Move to next question
      handleCorrectAnswer();
    } else {
      // Wrong! Analyze the error
      const analysis = analyzeAnswer(
        userAnswer,
        correct,
        currentQuestion.word,
        currentQuestion.formType
      );

      // Show error feedback
      setShowError(true);

      // Auto-show help modal if relevant help found
      if (analysis.relevantHelp.length > 0) {
        setTimeout(() => {
          showHelpForError(analysis);
        }, 1000); // Small delay so user sees "incorrect" first
      }
    }
  };

  return (
    <div>
      {/* Drill UI */}
      {/* ... */}
    </div>
  );
}

export default function DrillPage() {
  return (
    <ConjugationHelpProvider>
      <DrillContent />
    </ConjugationHelpProvider>
  );
}
```

---

### Integration 2: Conjugation Page (Manual Mode)

```typescript
// src/app/learn/conjugation/page.tsx

import { ConjugationHelpProvider, useConjugationHelp } from '@/hooks/useConjugationHelp';
import { HelpIcon } from '@/components/conjugation-help/HelpIcon';

function ConjugationContent() {
  const { showHelpFor } = useConjugationHelp();

  return (
    <div>
      {/* Each conjugation form */}
      <div className="conjugation-form-item">
        <div className="flex items-center gap-2">
          <span className="form-label">Te-form:</span>
          <span className="form-value japanese-text">買って</span>

          {/* Help Icon with Tooltip + Click */}
          <HelpIcon
            formType="teForm"
            wordType={word.conjugationType}
            onClick={() => showHelpFor('teForm', word.conjugationType)}
          />
        </div>
      </div>
    </div>
  );
}

export default function ConjugationPage() {
  return (
    <ConjugationHelpProvider>
      <ConjugationContent />
    </ConjugationHelpProvider>
  );
}
```

---

### Integration 3: Enhanced ConjugationDisplay Component

```typescript
// Update src/components/conjugation/ConjugationDisplay.tsx

import { HelpIcon } from '@/components/conjugation-help/HelpIcon';
import { useConjugationHelp } from '@/hooks/useConjugationHelp';

export function ConjugationDisplay({ word, ... }: ConjugationDisplayProps) {
  const { showHelpFor } = useConjugationHelp();

  // ... existing code ...

  return (
    <div className={`space-y-4 ${className}`}>
      {/* ... existing header ... */}

      {/* Conjugation groups */}
      <div className="space-y-2">
        {structure.map((group, groupIndex) => (
          <div key={groupId}>
            {/* ... group header ... */}

            {/* Group forms */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div>
                  <div className="p-4 space-y-3">
                    {group.forms.map((form) => {
                      const value = conjugations[form.key];
                      if (!value || value === '') return null;

                      return (
                        <div key={form.key} className="flex items-center justify-between p-3">
                          <div className="flex-1">
                            {/* Label */}
                            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                              {form.label}
                            </div>

                            {/* Value */}
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-medium japanese-text">
                                {value}
                              </span>

                              {/* NEW: Help Icon */}
                              <HelpIcon
                                formType={form.key}
                                wordType={enhancedWord.conjugationType || ''}
                                onClick={() => showHelpFor(form.key, enhancedWord.conjugationType || '')}
                              />
                            </div>
                          </div>

                          {/* Existing TTS button */}
                          <button onClick={() => handlePlayConjugation(value, form.key)}>
                            <Volume2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 📊 User Experience Flow

### Flow 1: Smart Mode (Drill)

```
User practicing drill
  ↓
Types wrong answer: "かうて" for 買う te-form
  ↓
System shows: ❌ Incorrect
  ↓
[1 second delay]
  ↓
Modal appears automatically:
  "🧠 Godan Te-Form: う・つ・る Group"
  Explanation + Examples
  ↓
User reads, clicks "Got it!"
  ↓
Continues drill with better understanding
```

---

### Flow 2: Manual Mode (Conjugation Page)

```
User browsing conjugations
  ↓
Hovers over help icon on "Potential Form"
  ↓
Tooltip appears: "💪 Can... - Express ability"
  ↓
User clicks icon
  ↓
Modal opens:
  "💪 Potential Form: Can..."
  Full explanation + Examples
  ↓
User reads and closes
  ↓
Help icon turns subtle green (visited state)
```

---

### Flow 3: Hybrid (Repeated Mistakes)

```
User makes same mistake 2nd time
  ↓
System tracks: This is repeat error
  ↓
Modal shows different content:
  - First time: Basic explanation
  - Second time: Mnemonic/memory trick
  - Third time: "Need more practice? Try drill mode!"
```

---

## 🎨 Visual Design Updates

### Help Icon States

```css
/* Default state */
.help-icon {
  color: #9ca3af; /* gray-400 */
  opacity: 0.6;
}

.help-icon:hover {
  color: #8b5cf6; /* primary-500 */
  opacity: 1;
  background: rgba(139, 92, 246, 0.1);
}

/* Visited state (user has read this help) */
.help-icon.visited {
  color: #10b981; /* green-500 */
  opacity: 0.5;
}

/* Pulsing state (auto-shown after error) */
.help-icon.attention {
  animation: pulse 2s infinite;
  color: #f59e0b; /* amber-500 */
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

---

## 📦 File Structure

```
src/
├── components/
│   └── conjugation-help/
│       ├── HelpIcon.tsx           # Tooltip + click icon
│       └── HelpModal.tsx          # Full explanation modal
│
├── data/
│   └── conjugation-help/
│       └── help-content.ts        # All bubble content (converted from MD)
│
├── lib/
│   └── conjugation-help/
│       └── error-analyzer.ts      # Smart error detection
│
└── hooks/
    └── useConjugationHelp.tsx     # Provider + hook
```

---

## ✅ Implementation Checklist

### Phase 1: Content & Infrastructure (2-3 days)
- [ ] Convert markdown bubbles to TypeScript help-content.ts
- [ ] Create HelpIcon component
- [ ] Create HelpModal component
- [ ] Build ConjugationHelpProvider & hook

### Phase 2: Smart Error Detection (2-3 days)
- [ ] Implement ConjugationErrorAnalyzer
- [ ] Add error pattern matching
- [ ] Create relevance scoring algorithm
- [ ] Test with common mistakes

### Phase 3: Integration (2-3 days)
- [ ] Add HelpIcon to ConjugationDisplay component
- [ ] Integrate smart mode in drill page
- [ ] Add tooltip hover states
- [ ] Style help icons

### Phase 4: Polish & Testing (1-2 days)
- [ ] Add visited state tracking
- [ ] Implement repeat-mistake handling
- [ ] Mobile responsiveness
- [ ] User testing & feedback

---

## 🎯 Key Advantages of Hybrid Approach

1. **✅ Uses Existing Components** - Modal & Tooltip already built
2. **✅ Smart When Needed** - Auto-shows on errors
3. **✅ Manual When Wanted** - User controls with clicks
4. **✅ Non-Intrusive** - Tooltip previews, full modal only on click/error
5. **✅ Progressive** - Can track what user has learned
6. **✅ Content-Rich** - Full educator-written explanations
7. **✅ Maintainable** - Content in single TypeScript file

---

## 🚀 Next Steps

Would you like me to:

1. **Start with content conversion** - Convert all markdown bubbles to TypeScript
2. **Build HelpIcon component** - Tooltip + click functionality
3. **Create error analyzer** - Smart detection logic
4. **Full implementation** - All phases at once

Let me know which you'd prefer to tackle first!

---

**End of Implementation Plan**
