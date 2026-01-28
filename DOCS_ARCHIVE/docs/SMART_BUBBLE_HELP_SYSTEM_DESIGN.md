# Smart Bubble Help System - Design Specification

**Version**: 1.0
**Date**: 2025-01-10
**Status**: Design Phase

---

## 🎯 Goals

1. **Context-Aware**: Show the right help at the right time
2. **Mistake-Driven**: Trigger on user errors, not random
3. **Non-Intrusive**: Bubbles appear when needed, disappear when not
4. **Progressive**: Track user knowledge to avoid repeating known concepts
5. **Bilingual**: Support both drill practice and conjugation browsing

---

## 📐 System Architecture

### Three-Layer Design

```
┌─────────────────────────────────────────────┐
│  Layer 1: Bubble Content Library           │
│  (Static MD → JSON conversion)             │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Layer 2: Smart Matching Engine            │
│  (Error Analysis → Bubble Selection)       │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Layer 3: UI Display Component             │
│  (Animated bubbles with dismiss tracking)  │
└─────────────────────────────────────────────┘
```

---

## 📚 Layer 1: Bubble Content Library

### File Structure

```
/src/data/help-bubbles/
├── bubble-content.json          # Main content library
├── bubble-triggers.json         # Trigger rules
└── bubble-sequences.json        # Learning progressions
```

### Content Schema (`bubble-content.json`)

```typescript
interface HelpBubble {
  id: string;                    // Unique identifier
  category: BubbleCategory;      // Verb type, tense, form, etc.
  subcategory?: string;          // Optional refinement
  level: 'beginner' | 'intermediate' | 'advanced';

  content: {
    emoji: string;               // Visual identifier
    title: string;               // Short heading
    body: string;                // Main explanation (markdown)
    tip?: string;                // Optional extra tip
    examples: string[];          // 1-3 examples
  };

  triggers: {
    errorPatterns: string[];     // What mistakes trigger this
    formTypes: ConjugationForm[];// Which forms this applies to
    wordTypes: WordType[];       // Which verb/adj types
  };

  display: {
    priority: number;            // 1-10, higher = more important
    maxShowCount: number;        // Don't show more than X times
    cooldown: number;            // Minutes before showing again
    requiredMistakes: number;    // Show after X mistakes of this type
  };
}

type BubbleCategory =
  | 'verb-type'      // Ichidan, Godan, Irregular
  | 'adjective-type' // i-adj, na-adj
  | 'tense'          // Present, past, negative
  | 'politeness'     // Plain vs polite
  | 'form'           // Tai, potential, passive, etc.
  | 'conditional'    // Ba, tara
  | 'special-case'   // Iku, ii exceptions
  | 'mnemonic';      // Memory aids
```

### Example Bubble Definition

```json
{
  "id": "godan-te-form-utsuru",
  "category": "form",
  "subcategory": "te-form",
  "level": "beginner",

  "content": {
    "emoji": "🧠",
    "title": "Godan Te-Form: う・つ・る Group",
    "body": "For verbs ending in う, つ, or る, the te-form uses って!\n\nThe past tense follows the same pattern with った.",
    "tip": "Memory trick: 'Small tsu-boys' all use って/った",
    "examples": [
      "買う → 買って (not 買うて)",
      "待つ → 待って (not 待ちて)",
      "帰る → 帰って (not 帰りて)"
    ]
  },

  "triggers": {
    "errorPatterns": [
      "買うて", "買いて", "買って",  // Common mistakes
      "待ちて", "待つて",
      "帰りて", "帰るて"
    ],
    "formTypes": ["teForm"],
    "wordTypes": ["Godan"]
  },

  "display": {
    "priority": 8,
    "maxShowCount": 3,
    "cooldown": 30,
    "requiredMistakes": 1
  }
}
```

---

## 🧠 Layer 2: Smart Matching Engine

### Error Analysis Flow

```typescript
interface ErrorAnalysis {
  userAnswer: string;           // What user typed
  correctAnswer: string;        // Expected answer
  word: EnhancedJapaneseWord;   // The word being conjugated
  formType: keyof ExtendedConjugationForms; // Which form

  // Computed analysis
  errorType: ErrorType;
  errorSeverity: 'minor' | 'major' | 'critical';
  mistakePattern: string;       // Specific pattern that failed
  potentialCauses: string[];    // Why this might have happened
}

type ErrorType =
  | 'wrong-ending'         // Used wrong て/た/だ pattern
  | 'wrong-stem'           // Used wrong stem (a/i/u/e/o)
  | 'wrong-verb-type'      // Treated Godan as Ichidan or vice versa
  | 'politeness-mismatch'  // Used plain instead of polite
  | 'tense-confusion'      // Used past instead of present
  | 'spelling-mistake'     // Close but wrong character
  | 'irregular-forgotten'  // Forgot special case (行く, いい)
  | 'particle-error'       // Added/removed particles incorrectly
  | 'complete-mismatch';   // Not even close
```

### Matching Algorithm

```typescript
class BubbleMatchingEngine {
  /**
   * Find the best bubble(s) to show for an error
   */
  async findRelevantBubbles(
    error: ErrorAnalysis,
    userHistory: UserHelpHistory
  ): Promise<HelpBubble[]> {

    // 1. Get all candidate bubbles
    const candidates = this.getCandidateBubbles(error);

    // 2. Filter by user history (don't repeat too much)
    const filtered = this.filterByHistory(candidates, userHistory);

    // 3. Score each bubble by relevance
    const scored = this.scoreBubbles(filtered, error);

    // 4. Apply cooldowns and limits
    const eligible = this.applyConstraints(scored, userHistory);

    // 5. Return top 1-2 bubbles
    return eligible.slice(0, 2);
  }

  private getCandidateBubbles(error: ErrorAnalysis): HelpBubble[] {
    const bubbles: HelpBubble[] = [];

    // Match by error pattern
    const patternMatches = this.bubbles.filter(b =>
      b.triggers.errorPatterns.some(pattern =>
        this.matchesPattern(error.userAnswer, pattern)
      )
    );

    // Match by form type
    const formMatches = this.bubbles.filter(b =>
      b.triggers.formTypes.includes(error.formType)
    );

    // Match by word type
    const typeMatches = this.bubbles.filter(b =>
      b.triggers.wordTypes.includes(error.word.conjugationType)
    );

    // Combine with deduplication
    return [...new Set([...patternMatches, ...formMatches, ...typeMatches])];
  }

  private scoreBubbles(
    bubbles: HelpBubble[],
    error: ErrorAnalysis
  ): ScoredBubble[] {
    return bubbles.map(bubble => ({
      bubble,
      score: this.calculateRelevanceScore(bubble, error)
    })).sort((a, b) => b.score - a.score);
  }

  private calculateRelevanceScore(
    bubble: HelpBubble,
    error: ErrorAnalysis
  ): number {
    let score = bubble.display.priority * 10; // Base priority

    // Bonus for exact error pattern match
    if (bubble.triggers.errorPatterns.includes(error.mistakePattern)) {
      score += 50;
    }

    // Bonus for matching form type
    if (bubble.triggers.formTypes.includes(error.formType)) {
      score += 30;
    }

    // Bonus for matching word type
    if (bubble.triggers.wordTypes.includes(error.word.conjugationType)) {
      score += 20;
    }

    // Bonus for critical errors
    if (error.errorSeverity === 'critical') {
      score += 40;
    }

    // Penalty for wrong difficulty level
    const userLevel = this.estimateUserLevel(error);
    if (bubble.level !== userLevel) {
      score -= 20;
    }

    return score;
  }
}
```

### Error Pattern Recognition

```typescript
class ErrorPatternRecognizer {
  /**
   * Analyze what type of mistake was made
   */
  analyzeError(
    userAnswer: string,
    correctAnswer: string,
    word: EnhancedJapaneseWord,
    formType: string
  ): ErrorAnalysis {

    // Normalize inputs
    const user = this.normalize(userAnswer);
    const correct = this.normalize(correctAnswer);

    // Calculate similarity
    const similarity = this.levenshteinSimilarity(user, correct);

    // Determine error type
    let errorType: ErrorType;
    let mistakePattern: string;

    if (similarity > 0.9) {
      errorType = 'spelling-mistake';
      mistakePattern = user;
    } else if (this.isEndingError(user, correct)) {
      errorType = 'wrong-ending';
      mistakePattern = this.extractEnding(user);
    } else if (this.isStemError(user, correct, word)) {
      errorType = 'wrong-stem';
      mistakePattern = this.extractStem(user);
    } else if (this.isVerbTypeConfusion(user, correct, word)) {
      errorType = 'wrong-verb-type';
      mistakePattern = 'ichidan-godan-confusion';
    } else if (this.isIrregularForgotten(user, correct, word)) {
      errorType = 'irregular-forgotten';
      mistakePattern = word.kanji || word.kana;
    } else {
      errorType = 'complete-mismatch';
      mistakePattern = user;
    }

    return {
      userAnswer: user,
      correctAnswer: correct,
      word,
      formType: formType as any,
      errorType,
      errorSeverity: this.determineSeverity(errorType, similarity),
      mistakePattern,
      potentialCauses: this.inferCauses(errorType, word, formType)
    };
  }

  private isEndingError(user: string, correct: string): boolean {
    // Check if stem is correct but ending is wrong
    const userStem = user.slice(0, -2);
    const correctStem = correct.slice(0, -2);
    return userStem === correctStem && user !== correct;
  }

  private isVerbTypeConfusion(
    user: string,
    correct: string,
    word: EnhancedJapaneseWord
  ): boolean {
    // Did user conjugate Godan as Ichidan or vice versa?
    if (word.conjugationType === 'Godan') {
      // Check if user just dropped る (Ichidan pattern)
      const base = word.kanji || word.kana;
      const stem = base.slice(0, -1);
      return user.startsWith(stem + 'て') || user.startsWith(stem + 'た');
    }
    return false;
  }

  private inferCauses(
    errorType: ErrorType,
    word: EnhancedJapaneseWord,
    formType: string
  ): string[] {
    const causes: string[] = [];

    if (errorType === 'wrong-verb-type') {
      causes.push('verb-type-confusion');
      if (word.conjugationType === 'Godan' && (word.kanji?.endsWith('る') || word.kana?.endsWith('る'))) {
        causes.push('godan-ru-exception');
      }
    }

    if (errorType === 'wrong-ending') {
      if (formType === 'teForm' || formType === 'past') {
        causes.push('godan-ending-pattern');
      }
    }

    if (errorType === 'irregular-forgotten') {
      causes.push('irregular-verb-special-case');
    }

    return causes;
  }
}
```

---

## 🎨 Layer 3: UI Display Component

### Component Structure

```
/src/components/help-bubbles/
├── HelpBubbleProvider.tsx       # Context provider
├── HelpBubbleDisplay.tsx        # Main bubble component
├── BubbleContainer.tsx          # Positioning wrapper
├── BubbleContent.tsx            # Content rendering
└── styles/bubble.css            # Animations
```

### React Component API

```typescript
/**
 * Context provider - wrap around drill or conjugation page
 */
<HelpBubbleProvider>
  {/* Your page content */}
</HelpBubbleProvider>

/**
 * Hook for triggering bubbles on errors
 */
const { showBubbleForError } = useHelpBubbles();

// When user makes a mistake:
await showBubbleForError({
  userAnswer: 'かって',
  correctAnswer: '買って',
  word: currentWord,
  formType: 'teForm'
});

/**
 * Clickable bubble triggers (for conjugation page)
 */
<ConjugationFormItem
  label="Te-form"
  value="買って"
  onHelpClick={() => showBubbleForForm('teForm', 'Godan')}
/>
```

### Component Implementation

```typescript
// HelpBubbleDisplay.tsx
interface HelpBubbleDisplayProps {
  bubble: HelpBubble;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  onDismiss: () => void;
  onNeverShowAgain?: () => void;
}

export function HelpBubbleDisplay({
  bubble,
  position,
  onDismiss,
  onNeverShowAgain
}: HelpBubbleDisplayProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.9 }}
        transition={{ type: 'spring', duration: 0.4 }}
        className={`help-bubble help-bubble-${position}`}
        role="tooltip"
        aria-live="polite"
      >
        {/* Emoji Icon */}
        <div className="bubble-icon">{bubble.content.emoji}</div>

        {/* Title */}
        <h3 className="bubble-title">{bubble.content.title}</h3>

        {/* Body */}
        <div className="bubble-body">
          <ReactMarkdown>{bubble.content.body}</ReactMarkdown>
        </div>

        {/* Examples */}
        {bubble.content.examples.length > 0 && (
          <div className="bubble-examples">
            {bubble.content.examples.map((ex, i) => (
              <div key={i} className="bubble-example">
                {ex}
              </div>
            ))}
          </div>
        )}

        {/* Tip */}
        {bubble.content.tip && (
          <div className="bubble-tip">
            <span className="tip-icon">💡</span>
            {bubble.content.tip}
          </div>
        )}

        {/* Actions */}
        <div className="bubble-actions">
          <button onClick={onDismiss} className="bubble-btn-primary">
            Got it!
          </button>
          {onNeverShowAgain && (
            <button onClick={onNeverShowAgain} className="bubble-btn-secondary">
              Don't show again
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
```

### Smart Positioning

```typescript
class BubblePositioner {
  /**
   * Determine best position for bubble based on:
   * - Available screen space
   * - Element triggering the bubble
   * - Current scroll position
   */
  calculatePosition(
    triggerElement: HTMLElement | null,
    bubbleSize: { width: number; height: number }
  ): BubblePosition {

    if (!triggerElement) {
      return { position: 'center', x: 0, y: 0 };
    }

    const rect = triggerElement.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    // Try positions in order of preference
    const positions = ['bottom', 'top', 'right', 'left', 'center'];

    for (const pos of positions) {
      if (this.hasSpace(pos, rect, bubbleSize, viewport)) {
        return this.calculateCoordinates(pos, rect, bubbleSize);
      }
    }

    // Fallback to center
    return {
      position: 'center',
      x: (viewport.width - bubbleSize.width) / 2,
      y: (viewport.height - bubbleSize.height) / 2
    };
  }

  private hasSpace(
    position: string,
    trigger: DOMRect,
    bubble: { width: number; height: number },
    viewport: { width: number; height: number }
  ): boolean {
    const padding = 20; // Minimum distance from edges

    switch (position) {
      case 'bottom':
        return trigger.bottom + bubble.height + padding < viewport.height;
      case 'top':
        return trigger.top - bubble.height - padding > 0;
      case 'right':
        return trigger.right + bubble.width + padding < viewport.width;
      case 'left':
        return trigger.left - bubble.width - padding > 0;
      default:
        return true;
    }
  }
}
```

---

## 💾 User History Tracking

### Storage Schema

```typescript
interface UserHelpHistory {
  userId: string;

  // Per-bubble tracking
  bubbleHistory: {
    [bubbleId: string]: {
      timesShown: number;
      lastShown: number;        // Timestamp
      dismissed: boolean;
      neverShowAgain: boolean;
      userFoundHelpful: boolean | null;
    };
  };

  // General stats
  stats: {
    totalBubblesShown: number;
    totalDismissals: number;
    averageTimeToRead: number; // Milliseconds
    mostHelpfulCategories: string[];
  };

  // Learning progress
  mastery: {
    [category: string]: {
      errorCount: number;
      successAfterBubble: number;
      estimatedMastery: number; // 0-100
    };
  };
}
```

### Storage Location

```typescript
// Use Firebase for logged-in users
const userHistoryRef = doc(db, 'users', userId, 'helpBubbles', 'history');

// Use localStorage for anonymous users
const STORAGE_KEY = 'moshimoshi_help_bubbles';
localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
```

---

## 🎯 Integration Points

### 1. Drill Page Integration

```typescript
// src/app/drill/page.tsx

export default function DrillPage() {
  const { showBubbleForError } = useHelpBubbles();

  const handleAnswer = async (userAnswer: string) => {
    const correct = checkAnswer(userAnswer, currentQuestion);

    if (!correct) {
      // Show bubble after mistake
      await showBubbleForError({
        userAnswer,
        correctAnswer: currentQuestion.answer,
        word: currentQuestion.word,
        formType: currentQuestion.formType
      });
    }
  };

  return (
    <HelpBubbleProvider mode="drill">
      <DrillInterface onAnswer={handleAnswer} />
    </HelpBubbleProvider>
  );
}
```

### 2. Conjugation Page Integration

```typescript
// src/app/learn/conjugation/page.tsx

export default function ConjugationPage() {
  const { showBubbleForForm } = useHelpBubbles();

  return (
    <HelpBubbleProvider mode="reference">
      <ConjugationDisplay
        word={currentWord}
        onFormHelpRequest={(formType, wordType) => {
          showBubbleForForm(formType, wordType);
        }}
      />
    </HelpBubbleProvider>
  );
}
```

### 3. ConjugationDisplay Enhancement

```typescript
// Add help icon next to each form
<div className="conjugation-form-item">
  <span className="form-label">{formLabel}</span>
  <span className="form-value">{conjugationValue}</span>

  {/* New: Help icon */}
  <button
    className="form-help-icon"
    onClick={() => onFormHelpRequest(formKey, wordType)}
    aria-label="Show explanation"
  >
    <HelpCircle size={16} />
  </button>
</div>
```

---

## 🎨 Visual Design Specs

### Bubble Appearance

```css
.help-bubble {
  /* Base styling */
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 20px;
  max-width: 400px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  color: white;

  /* Typography */
  font-family: 'Inter', sans-serif;
  line-height: 1.6;
}

.bubble-icon {
  font-size: 48px;
  text-align: center;
  margin-bottom: 12px;
}

.bubble-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
  text-align: center;
}

.bubble-body {
  font-size: 14px;
  margin-bottom: 16px;
}

.bubble-examples {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px;
  margin: 12px 0;
}

.bubble-example {
  font-family: 'Noto Sans JP', sans-serif;
  font-size: 16px;
  padding: 4px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.bubble-example:last-child {
  border-bottom: none;
}

.bubble-tip {
  background: rgba(255, 255, 255, 0.15);
  border-left: 3px solid #ffd700;
  padding: 8px 12px;
  margin: 12px 0;
  border-radius: 4px;
  font-size: 13px;
}

.bubble-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.bubble-btn-primary {
  flex: 1;
  background: white;
  color: #667eea;
  border: none;
  padding: 10px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}

.bubble-btn-primary:hover {
  transform: scale(1.05);
}

.bubble-btn-secondary {
  flex: 1;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: none;
  padding: 10px;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
}
```

### Positioning Classes

```css
.help-bubble-top {
  transform-origin: bottom center;
}

.help-bubble-bottom {
  transform-origin: top center;
}

.help-bubble-left {
  transform-origin: right center;
}

.help-bubble-right {
  transform-origin: left center;
}

.help-bubble-center {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 9999;
}
```

### Animations

```css
@keyframes bubble-entrance {
  0% {
    opacity: 0;
    transform: scale(0.8) translateY(20px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes bubble-exit {
  0% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  100% {
    opacity: 0;
    transform: scale(0.8) translateY(-20px);
  }
}

.help-bubble {
  animation: bubble-entrance 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

---

## 📊 Bubble Priority & Sequencing

### Priority Levels (1-10)

**Level 10 (Critical):**
- Irregular verb special cases (行く → 行って)
- い adjective exception (いい → よかった)

**Level 8-9 (High):**
- Verb type identification (Godan vs Ichidan)
- Te-form pattern groups
- Basic tense formation

**Level 5-7 (Medium):**
- Politeness level explanations
- Conditional form differences (ば vs たら)
- Tai-form usage

**Level 1-4 (Low):**
- Advanced forms (causative-passive)
- Classical/literary forms
- Mnemonics and memory tips

### Smart Sequencing Rules

1. **First Mistake**: Show fundamental bubble (verb type, basic pattern)
2. **Repeated Mistake**: Show mnemonic or deeper explanation
3. **Third Time**: Offer practice suggestions or link to full guide
4. **Mastery**: Stop showing bubbles for that category

### Example Sequence

```typescript
// User makes te-form mistake with 買う
Mistake 1: Show "Godan Te-Form: う・つ・る Group"
Mistake 2: Show "Memory trick: Small tsu-boys"
Mistake 3: Show "Practice: Try these 5 words..."
Success:   Mark category as improving
```

---

## 🧪 Testing Strategy

### Test Scenarios

1. **Correct Error Detection**
   - User types `かって` instead of `買って`
   - System should show Godan う-verb te-form bubble

2. **Avoid Spam**
   - User makes same mistake 3 times in 5 minutes
   - System should show bubble max once (with cooldown)

3. **Progressive Learning**
   - User improves from 30% → 80% accuracy on te-forms
   - System should stop showing beginner te-form bubbles

4. **Clickable Help**
   - User clicks help icon on conditional form
   - System should show relevant conditional explanation

5. **Mobile Responsive**
   - Bubble should fit on mobile screens
   - Should not block input field

---

## 🚀 Implementation Plan

### Phase 1: Foundation (Week 1)
- [ ] Convert markdown bubbles to JSON structure
- [ ] Create trigger rules for each bubble
- [ ] Build error pattern recognizer
- [ ] Design bubble component UI

### Phase 2: Matching Engine (Week 2)
- [ ] Implement smart matching algorithm
- [ ] Build scoring system
- [ ] Add user history tracking
- [ ] Create cooldown logic

### Phase 3: UI Integration (Week 3)
- [ ] Integrate with drill page
- [ ] Add to conjugation page
- [ ] Implement positioning system
- [ ] Add animations

### Phase 4: Polish (Week 4)
- [ ] Add analytics tracking
- [ ] Test with real users
- [ ] Tune thresholds and priorities
- [ ] Add accessibility features

---

## 📈 Success Metrics

### Quantitative
- **Help Rate**: % of errors that trigger bubbles (target: 60-80%)
- **Engagement Rate**: % of bubbles read fully (target: >70%)
- **Improvement Rate**: % accuracy increase after seeing bubble (target: +15%)
- **Spam Rate**: % of bubbles dismissed immediately (target: <10%)

### Qualitative
- User feedback on helpfulness
- Reports of "aha moments"
- Reduced support questions about conjugation

---

## 🎯 Key Design Principles

1. **Show, Don't Tell**: Prefer examples over theory
2. **Right Time, Right Place**: Contextual > random
3. **Respect Intelligence**: Don't patronize or over-explain
4. **Progressive Disclosure**: Start simple, go deep as needed
5. **Celebrate Success**: Use encouragement, not criticism
6. **Be Cute**: Emojis and friendly language (Moshimoshi style)

---

## 📝 Content Guidelines for Writers

When creating new bubbles:

1. **Start with emoji** - Sets the mood
2. **One core concept** - Don't combine multiple topics
3. **2-3 examples** - Show pattern clearly
4. **Optional mnemonic** - Memory aid for tricky parts
5. **Keep it short** - 3-4 sentences max in body
6. **Use plain English** - Avoid linguistic jargon
7. **Be encouraging** - "You've got this!" tone

---

**End of Design Document**

Ready for review and implementation planning.
