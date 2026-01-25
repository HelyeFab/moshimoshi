# Agent 1 - Data Engineer

**Role**: Data & Content Creation Specialist
**Project**: Grammar Stall MVP
**Timeline**: Days 1-2 (10 points), Days 9-10 (70 points)
**Branch**: `grammar-stall-mvp-agent1-data`

---

## 🎯 Your Mission

You are the **Data Engineer** responsible for creating all N5 grammar content. Your deliverables:

1. **80 Grammar Point JSON files** with explanations and examples
2. **80 Exercise JSON files** with 10 exercises each
3. **1 Index JSON file** listing all grammar points
4. **TypeScript interfaces** matching the JSON structure

**Total**: 161 files + TypeScript types

---

## 📚 Required Reading

**READ THESE FIRST**:
1. `../MVP_SPECIFICATION.md` - Sections: "Data Structure" and "N5 Grammar Points Coverage"
2. `../DATA_SCHEMA.md` - **ENTIRE DOCUMENT** (this is your bible)
3. `../TECHNICAL_DESIGN.md` - Section: "Data Flow"

---

## 📅 Your Schedule

### Days 1-2: Foundation (10 Grammar Points)

**Day 1 Morning**:
- [ ] Read all documentation
- [ ] Create file structure
- [ ] Define TypeScript interfaces
- [ ] Create 3 sample grammar points

**Day 1 Afternoon**:
- [ ] Technical Lead reviews your 3 samples
- [ ] Fix any issues
- [ ] Create 7 more grammar points (total: 10)

**Day 2**:
- [ ] Create exercises for all 10 points (100 exercises total)
- [ ] Validate JSON syntax
- [ ] Submit for code review

**Deliverable**: 10 complete grammar points ready for Agent 2 (UI) to use

---

### Days 9-10: Content Completion (70 Grammar Points)

**Day 9**:
- [ ] Create grammar points 11-50 (40 points)
- [ ] Create exercises for points 11-50 (400 exercises)

**Day 10**:
- [ ] Create grammar points 51-80 (30 points)
- [ ] Create exercises for points 51-80 (300 exercises)
- [ ] Final validation of all 80 points
- [ ] Update `n5-index.json` with all points

**Deliverable**: All 80 grammar points complete

---

## 📁 File Structure You'll Create

```
/public/data/grammar/
├── n5-index.json                     # YOU CREATE THIS
└── points/                           # YOU CREATE 80 FILES
    ├── 001-x-wa-y-desu.json
    ├── 002-particles-wa.json
    ├── 003-particles-ga.json
    └── ... (77 more files)
└── exercises/                        # YOU CREATE 80 FILES
    ├── 001-x-wa-y-desu.json
    ├── 002-particles-wa.json
    ├── 003-particles-ga.json
    └── ... (77 more files)

/src/lib/grammar/
└── types.ts                          # YOU CREATE THIS
```

---

## 🔧 Step-by-Step Instructions

### Step 1: Create TypeScript Interfaces

**File**: `/src/lib/grammar/types.ts`

Copy the interfaces from `../DATA_SCHEMA.md` exactly:

```typescript
// src/lib/grammar/types.ts

export interface GrammarPointIndex {
  id: string
  order: number
  category: string
  title: {
    ja: string
    romaji: string
    en: string
  }
  shortDescription: string
  jlptLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
}

export interface GrammarIndexFile {
  version: string
  jlptLevel: string
  totalPoints: number
  lastUpdated: string
  points: GrammarPointIndex[]
}

export interface GrammarPoint {
  id: string
  version: string
  title: {
    ja: string
    romaji: string
    en: string
  }
  jlptLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
  category: string
  explanation: {
    en: string
    ja: string
  }
  structure: {
    pattern: string
    components: StructureComponent[]
  }
  examples: Example[]
  relatedPoints: string[]
  commonMistakes?: CommonMistake[]
  tags: string[]
}

export interface StructureComponent {
  part: string
  explanation: string
  examples: string[]
}

export interface Example {
  japanese: string
  romaji: string
  english: string
  breakdown: Record<string, string>
  notes?: string
}

export interface CommonMistake {
  mistake: string
  correction: string
  example: string
}

export interface ExerciseFile {
  grammarPointId: string
  version: string
  totalExercises: number
  exercises: Exercise[]
}

export type ExerciseType = 'multiple-choice' | 'fill-in-blank' | 'sentence-matching'

export interface BaseExercise {
  id: string
  type: ExerciseType
  question: string
  questionRomaji?: string
  correctFeedback: string
  incorrectFeedback: string
  explanation: string
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface MultipleChoiceExercise extends BaseExercise {
  type: 'multiple-choice'
  options: MultipleChoiceOption[]
  correctAnswer: string
}

export interface MultipleChoiceOption {
  id: string
  text: string
  romaji?: string
}

export interface FillInBlankExercise extends BaseExercise {
  type: 'fill-in-blank'
  correctAnswer: string
  acceptedVariations?: string[]
  hints?: string[]
}

export interface SentenceMatchingExercise extends BaseExercise {
  type: 'sentence-matching'
  pairs: SentencePair[]
}

export interface SentencePair {
  japanese: string
  romaji: string
  english: string
}

export type Exercise = MultipleChoiceExercise | FillInBlankExercise | SentenceMatchingExercise

export interface ExerciseResult {
  isCorrect: boolean
  message: string
  correctAnswer?: string
  explanation?: string
}

// Grammar categories
export type GrammarCategory =
  | 'basic-sentences'
  | 'particles'
  | 'verbs'
  | 'adjectives'
  | 'time-expressions'
  | 'existence'
  | 'comparisons'
  | 'questions'
  | 'numbers-counters'
  | 'necessity-ability'
  | 'giving-receiving'
  | 'miscellaneous'
```

**Action**: Create this file first! All other files depend on it.

---

### Step 2: Create Directory Structure

```bash
cd /home/beano/DevProjects/NextJs/moshimoshi

# Create directories
mkdir -p public/data/grammar/points
mkdir -p public/data/grammar/exercises
```

---

### Step 3: Create Your First Grammar Point

Let's create `001-x-wa-y-desu` as a complete example.

**File**: `/public/data/grammar/points/001-x-wa-y-desu.json`

```json
{
  "id": "001-x-wa-y-desu",
  "version": "1.0.0",
  "title": {
    "ja": "XはYです",
    "romaji": "X wa Y desu",
    "en": "X is Y"
  },
  "jlptLevel": "N5",
  "category": "basic-sentences",
  "explanation": {
    "en": "This is the most fundamental sentence structure in Japanese. It states that X is Y, where X is the topic (marked by は) and Y describes or identifies X. です makes the sentence polite.\n\nKey Points:\n• は (pronounced 'wa') marks the topic - what the sentence is about\n• です (desu) is like 'is' or 'am' in English\n• This pattern works for identity, occupation, nationality, descriptions, etc.\n• The word order is Topic-Description-Copula, which is different from English\n\nThink of は as saying 'As for X, ...' and です as the polite way to say 'is'.",
    "ja": ""
  },
  "structure": {
    "pattern": "X は Y です",
    "components": [
      {
        "part": "X",
        "explanation": "The topic - what you're talking about (person, thing, concept)",
        "examples": ["私 (I)", "これ (this)", "田中さん (Tanaka-san)"]
      },
      {
        "part": "は",
        "explanation": "Topic marker particle (pronounced 'wa', not 'ha')",
        "examples": ["は"]
      },
      {
        "part": "Y",
        "explanation": "The description or identity of X",
        "examples": ["学生 (student)", "本 (book)", "日本人 (Japanese person)"]
      },
      {
        "part": "です",
        "explanation": "Polite copula - means 'is', 'am', or 'are'",
        "examples": ["です"]
      }
    ]
  },
  "examples": [
    {
      "japanese": "私は学生です。",
      "romaji": "Watashi wa gakusei desu.",
      "english": "I am a student.",
      "breakdown": {
        "私": "I, me",
        "は": "topic marker (wa)",
        "学生": "student",
        "です": "am (polite)"
      },
      "notes": "Most common self-introduction pattern"
    },
    {
      "japanese": "これは本です。",
      "romaji": "Kore wa hon desu.",
      "english": "This is a book.",
      "breakdown": {
        "これ": "this",
        "は": "topic marker",
        "本": "book",
        "です": "is (polite)"
      },
      "notes": "Used when identifying objects"
    },
    {
      "japanese": "田中さんは日本人です。",
      "romaji": "Tanaka-san wa nihonjin desu.",
      "english": "Tanaka-san is Japanese.",
      "breakdown": {
        "田中さん": "Mr./Ms. Tanaka",
        "は": "topic marker",
        "日本人": "Japanese person",
        "です": "is (polite)"
      },
      "notes": "Describing someone's nationality"
    },
    {
      "japanese": "東京は大きいです。",
      "romaji": "Tōkyō wa ōkii desu.",
      "english": "Tokyo is big.",
      "breakdown": {
        "東京": "Tokyo",
        "は": "topic marker",
        "大きい": "big",
        "です": "is (polite ending)"
      },
      "notes": "Describing a place - note that 大きい is an adjective but still uses です"
    }
  ],
  "relatedPoints": [
    "002-x-wa-y-de-wa-arimasen",
    "006-particle-wa"
  ],
  "commonMistakes": [
    {
      "mistake": "Using を instead of は",
      "correction": "は marks the topic, を marks the direct object",
      "example": "❌ 私を学生です → ✅ 私は学生です"
    },
    {
      "mistake": "Forgetting です",
      "correction": "です is required for polite speech",
      "example": "❌ 私は学生 → ✅ 私は学生です"
    }
  ],
  "tags": ["basic", "identity", "polite", "beginner-essential", "self-introduction"]
}
```

**Save this file and validate**:

```bash
cat public/data/grammar/points/001-x-wa-y-desu.json | jq '.'
# Should output formatted JSON with no errors
```

---

### Step 4: Create Exercises for Grammar Point

**File**: `/public/data/grammar/exercises/001-x-wa-y-desu.json`

```json
{
  "grammarPointId": "001-x-wa-y-desu",
  "version": "1.0.0",
  "totalExercises": 10,
  "exercises": [
    {
      "id": "001-x-wa-y-desu-ex-01",
      "type": "multiple-choice",
      "question": "Choose the correct particle: 私＿＿学生です。",
      "questionRomaji": "Watashi __ gakusei desu.",
      "options": [
        { "id": "a", "text": "は", "romaji": "wa" },
        { "id": "b", "text": "が", "romaji": "ga" },
        { "id": "c", "text": "を", "romaji": "wo" },
        { "id": "d", "text": "に", "romaji": "ni" }
      ],
      "correctAnswer": "a",
      "correctFeedback": "Perfect! は (wa) is the topic marker used in the XはYです pattern.",
      "incorrectFeedback": "Not quite. The topic marker は (wa) is used to mark '私' as the topic.",
      "explanation": "In XはYです sentences, は always marks the topic. Here '私' (I) is the topic being described.",
      "difficulty": "easy"
    },
    {
      "id": "001-x-wa-y-desu-ex-02",
      "type": "multiple-choice",
      "question": "What does 'これは本です' mean?",
      "questionRomaji": "Kore wa hon desu",
      "options": [
        { "id": "a", "text": "This is a book." },
        { "id": "b", "text": "That is a book." },
        { "id": "c", "text": "I am a book." },
        { "id": "d", "text": "This was a book." }
      ],
      "correctAnswer": "a",
      "correctFeedback": "Correct! これ means 'this' and 本 means 'book'.",
      "incorrectFeedback": "Not quite. これ means 'this' (not 'that' or 'I'), and です is present tense.",
      "explanation": "これ = this, は = topic marker, 本 = book, です = is. All together: 'This is a book.'",
      "difficulty": "easy"
    },
    {
      "id": "001-x-wa-y-desu-ex-03",
      "type": "fill-in-blank",
      "question": "Translate to Japanese: 'I am a teacher.'",
      "correctAnswer": "私は先生です",
      "acceptedVariations": [
        "私は先生です。",
        "わたしはせんせいです",
        "わたしはせんせいです。",
        "watashi wa sensei desu",
        "watashi wa sensei desu."
      ],
      "correctFeedback": "Excellent! 私は先生です is the correct translation.",
      "incorrectFeedback": "The correct answer is: 私は先生です (watashi wa sensei desu)",
      "explanation": "私 = I, は = topic marker, 先生 = teacher, です = am (polite)",
      "hints": ["Use the pattern: X は Y です", "先生 (sensei) means teacher"],
      "difficulty": "medium"
    },
    {
      "id": "001-x-wa-y-desu-ex-04",
      "type": "fill-in-blank",
      "question": "Complete the sentence: 'That is a pen.' それ＿＿ペン＿＿。",
      "correctAnswer": "はです",
      "acceptedVariations": [
        "は です",
        "wa desu"
      ],
      "correctFeedback": "Great! それはペンです uses the XはYです pattern correctly.",
      "incorrectFeedback": "The correct particles are: は (wa) and です (desu)",
      "explanation": "それ = that, は = topic marker, ペン = pen, です = is",
      "hints": ["Two particles are needed", "Topic marker + polite copula"],
      "difficulty": "medium"
    },
    {
      "id": "001-x-wa-y-desu-ex-05",
      "type": "multiple-choice",
      "question": "Which sentence is grammatically correct?",
      "options": [
        { "id": "a", "text": "私は学生です。" },
        { "id": "b", "text": "私を学生です。" },
        { "id": "c", "text": "私が学生です。" },
        { "id": "d", "text": "私に学生です。" }
      ],
      "correctAnswer": "a",
      "correctFeedback": "Correct! は is the proper topic marker for XはYです sentences.",
      "incorrectFeedback": "Only は can mark the topic in this sentence pattern. を, が, and に serve different functions.",
      "explanation": "In the XはYです pattern, は must be used to mark the topic. を marks objects, が marks subjects (different usage), and に marks locations or indirect objects.",
      "difficulty": "medium"
    },
    {
      "id": "001-x-wa-y-desu-ex-06",
      "type": "sentence-matching",
      "question": "Match the Japanese sentences with their English translations:",
      "pairs": [
        {
          "japanese": "これは本です。",
          "romaji": "Kore wa hon desu.",
          "english": "This is a book."
        },
        {
          "japanese": "私は先生です。",
          "romaji": "Watashi wa sensei desu.",
          "english": "I am a teacher."
        },
        {
          "japanese": "田中さんは学生です。",
          "romaji": "Tanaka-san wa gakusei desu.",
          "english": "Tanaka-san is a student."
        },
        {
          "japanese": "それはペンです。",
          "romaji": "Sore wa pen desu.",
          "english": "That is a pen."
        }
      ],
      "correctFeedback": "Perfect! You matched all sentences correctly.",
      "incorrectFeedback": "Not quite. Review the vocabulary and the XはYです pattern.",
      "explanation": "All sentences follow XはYです: Topic は Description です",
      "difficulty": "easy"
    },
    {
      "id": "001-x-wa-y-desu-ex-07",
      "type": "fill-in-blank",
      "question": "Translate: 'Tokyo is the capital.' 東京＿＿首都＿＿。",
      "correctAnswer": "はです",
      "acceptedVariations": [
        "は です",
        "wa desu"
      ],
      "correctFeedback": "Excellent! 東京は首都です follows the XはYです pattern.",
      "incorrectFeedback": "Use は to mark the topic (Tokyo) and です as the copula.",
      "explanation": "東京 = Tokyo, は = topic marker, 首都 = capital, です = is",
      "hints": ["Topic marker + copula"],
      "difficulty": "medium"
    },
    {
      "id": "001-x-wa-y-desu-ex-08",
      "type": "multiple-choice",
      "question": "In 'これは本です', what part of speech is 'です'?",
      "options": [
        { "id": "a", "text": "Copula (linking word, like 'is')" },
        { "id": "b", "text": "Verb (action word)" },
        { "id": "c", "text": "Particle" },
        { "id": "d", "text": "Adjective" }
      ],
      "correctAnswer": "a",
      "correctFeedback": "Correct! です is the polite copula, functioning like 'is/am/are' in English.",
      "incorrectFeedback": "です is a copula - it links the topic to its description, similar to 'is' in English.",
      "explanation": "A copula is a linking word that connects the subject to a description. です is the polite form.",
      "difficulty": "hard"
    },
    {
      "id": "001-x-wa-y-desu-ex-09",
      "type": "fill-in-blank",
      "question": "How do you say 'This is Japan.' in Japanese?",
      "correctAnswer": "これは日本です",
      "acceptedVariations": [
        "これは日本です。",
        "kore wa nihon desu",
        "kore wa nihon desu.",
        "kore wa nippon desu",
        "これはにほんです",
        "これはにほんです。"
      ],
      "correctFeedback": "Perfect! これは日本です is exactly right.",
      "incorrectFeedback": "The answer is: これは日本です (kore wa nihon desu)",
      "explanation": "これ = this, は = topic marker, 日本 = Japan, です = is",
      "hints": ["Pattern: これ は _____ です", "日本 (にほん) = Japan"],
      "difficulty": "medium"
    },
    {
      "id": "001-x-wa-y-desu-ex-10",
      "type": "multiple-choice",
      "question": "Why is は pronounced 'wa' instead of 'ha' in this sentence?",
      "options": [
        { "id": "a", "text": "When は is used as a particle, it's always pronounced 'wa'" },
        { "id": "b", "text": "It's a special rule only for です sentences" },
        { "id": "c", "text": "Both 'wa' and 'ha' are correct" },
        { "id": "d", "text": "It's actually pronounced 'ha'" }
      ],
      "correctAnswer": "a",
      "correctFeedback": "Exactly! The particle は is always pronounced 'wa', even though it's written with the は character.",
      "incorrectFeedback": "When は functions as a particle (not just a letter), it's always pronounced 'wa', not 'ha'.",
      "explanation": "This is a special pronunciation rule in Japanese: the topic marker は is written with the は character but pronounced 'wa'.",
      "difficulty": "hard"
    }
  ]
}
```

**Validate**:

```bash
cat public/data/grammar/exercises/001-x-wa-y-desu.json | jq '.'
```

---

### Step 5: Add to Index

**File**: `/public/data/grammar/n5-index.json`

```json
{
  "version": "1.0.0",
  "jlptLevel": "N5",
  "totalPoints": 80,
  "lastUpdated": "2026-01-16",
  "points": [
    {
      "id": "001-x-wa-y-desu",
      "order": 1,
      "category": "basic-sentences",
      "title": {
        "ja": "XはYです",
        "romaji": "X wa Y desu",
        "en": "X is Y"
      },
      "shortDescription": "Basic identity and description sentences using the topic marker は and copula です",
      "jlptLevel": "N5",
      "difficulty": "beginner"
    }
    // ... Add more as you create them
  ]
}
```

---

## 📝 Content Creation Guidelines

### Writing Grammar Explanations

**DO**:
✅ Write for absolute beginners (assume zero Japanese knowledge)
✅ Use analogies ("Think of は as 'as for...'")
✅ Explain WHY, not just WHAT
✅ Use bullet points for key concepts
✅ Keep it 200-300 words
✅ Include common use cases

**DON'T**:
❌ Use linguistics jargon without explanation
❌ Assume knowledge of other grammar points
❌ Write essays (keep it concise)
❌ Skip the "why it matters" context

**Example**:
```
Good: "は marks the topic - what you're talking about in the sentence.
Think of it as saying 'As for X...'"

Bad: "は is a topic-marking particle that indicates the thematic subject
of the predicate."
```

---

### Creating Examples

**Requirements**:
- **Minimum**: 3 examples
- **Maximum**: 5 examples
- **Vocabulary**: Only N5 words
- **Progression**: Simple → Complex

**Each Example Must Have**:
1. Japanese text (with proper punctuation 。)
2. Romaji (for beginners who can't read kana yet)
3. English translation
4. Word-by-word breakdown (dictionary form + meaning)
5. Optional notes explaining usage

**Example Template**:
```json
{
  "japanese": "私は学生です。",
  "romaji": "Watashi wa gakusei desu.",
  "english": "I am a student.",
  "breakdown": {
    "私": "I, me",
    "は": "topic marker (wa)",
    "学生": "student",
    "です": "am (polite)"
  },
  "notes": "Basic self-introduction pattern"
}
```

---

### Designing Exercises

**Exercise Distribution (per grammar point)**:
- Total: 10 exercises
- Multiple Choice: 4-5 exercises
- Fill-in-Blank: 3-4 exercises
- Sentence Matching: 1-2 exercises

**Difficulty Curve**:
- Exercises 1-3: **Easy** (direct application, recognition)
- Exercises 4-7: **Medium** (requires thinking, production)
- Exercises 8-10: **Hard** (creative use, understanding concepts)

---

#### Multiple Choice Guidelines

**Question Types**:
1. **Particle Selection**: "Choose the correct particle: 私＿＿学生です"
2. **Translation**: "What does this sentence mean?"
3. **Grammar Recognition**: "Which sentence is correct?"
4. **Concept Understanding**: "Why is は pronounced 'wa'?"

**Options**:
- Always 4 options (A, B, C, D)
- One correct answer
- Distractors should be plausible (common mistakes)
- Use actual beginner errors as wrong answers

**Feedback**:
- **Correct**: Affirm + brief explanation
- **Incorrect**: Gentle correction + why wrong + what's correct

**Example**:
```json
{
  "type": "multiple-choice",
  "question": "Choose the correct particle: 私＿＿学生です。",
  "options": [
    { "id": "a", "text": "は" },  // Correct
    { "id": "b", "text": "が" },  // Common confusion
    { "id": "c", "text": "を" },  // Common mistake
    { "id": "d", "text": "に" }   // Plausible distractor
  ],
  "correctAnswer": "a",
  "correctFeedback": "Perfect! は marks the topic in XはYです sentences.",
  "incorrectFeedback": "The topic marker は is correct. を marks objects, が marks subjects (in different contexts), and に marks locations."
}
```

---

#### Fill-in-Blank Guidelines

**Question Types**:
1. **Translation**: "Translate to Japanese: '___'"
2. **Completion**: "Fill in the particles: これ＿＿本＿＿。"
3. **Conjugation**: (for verb/adjective grammar points)

**Answer Handling**:
- Provide **all acceptable variations**:
  - Kanji version (私は学生です)
  - Hiragana version (わたしはがくせいです)
  - Romaji version (watashi wa gakusei desu)
  - With/without punctuation

**Hints**:
- Provide 1-2 hints for medium/hard questions
- Hints should guide, not give away answer

**Example**:
```json
{
  "type": "fill-in-blank",
  "question": "Translate: 'I am a student.'",
  "correctAnswer": "私は学生です",
  "acceptedVariations": [
    "私は学生です。",
    "わたしはがくせいです",
    "わたしはがくせいです。",
    "watashi wa gakusei desu",
    "watashi wa gakusei desu."
  ],
  "hints": ["Pattern: X は Y です", "学生 = student"],
  "difficulty": "medium"
}
```

---

#### Sentence Matching Guidelines

**Structure**:
- 3-4 sentence pairs
- All sentences use the same grammar pattern
- Vary vocabulary to prevent rote memorization

**Example**:
```json
{
  "type": "sentence-matching",
  "question": "Match Japanese sentences to English translations:",
  "pairs": [
    {
      "japanese": "これは本です。",
      "romaji": "Kore wa hon desu.",
      "english": "This is a book."
    },
    {
      "japanese": "私は先生です。",
      "romaji": "Watashi wa sensei desu.",
      "english": "I am a teacher."
    },
    {
      "japanese": "それはペンです。",
      "romaji": "Sore wa pen desu.",
      "english": "That is a pen."
    }
  ]
}
```

---

## 🗂️ Grammar Point Priority List

### Phase 1: Days 1-2 (10 Points - HIGHEST PRIORITY)

Create these 10 first (they're foundational):

1. ✅ `001-x-wa-y-desu` - XはYです (DONE - use as template)
2. `002-x-wa-y-de-wa-arimasen` - XはYではありません (negative)
3. `006-particle-wa` - は (topic marker)
4. `007-particle-ga` - が (subject marker)
5. `008-particle-wo` - を (object marker)
6. `022-masu-form-present` - ます form (present)
7. `041-i-adjectives-present` - い-adjectives
8. `045-na-adjectives-present` - な-adjectives
9. `059-iru-animate` - いる (existence - animate)
10. `060-aru-inanimate` - ある (existence - inanimate)

**Why these 10?**:
- Cover 4 categories (sentences, particles, verbs, adjectives, existence)
- Most essential for beginners
- Give Agent 2 (UI) variety to test with

---

### Phase 2: Days 9-10 (Remaining 70 Points)

**Strategy**: Work category by category

**Day 9 (40 points)**:
- Complete all Particles (006-020) - 15 points
- Complete all Verbs (021-040) - 20 points
- Complete Basic Sentences (001-005) - 5 points

**Day 10 (30 points)**:
- Complete all Adjectives (041-050) - 10 points
- Complete Time Expressions (051-058) - 8 points
- Complete Existence (059-063) - 5 points
- Complete Comparisons (064-067) - 4 points
- Complete Miscellaneous (079-080) - 2 points

---

## ✅ Quality Checklist

Before submitting each grammar point, verify:

### Grammar Point File
- [ ] ID matches filename (without number prefix)
- [ ] Explanation is 200-300 words
- [ ] Explanation is beginner-friendly (no jargon)
- [ ] 3-5 examples provided
- [ ] Each example has all 5 fields (japanese, romaji, english, breakdown, notes)
- [ ] Only N5 vocabulary used in examples
- [ ] Related points reference valid IDs
- [ ] JSON is valid (no syntax errors)

### Exercise File
- [ ] Exactly 10 exercises
- [ ] Mix of 3 exercise types (4-5 MC, 3-4 fill-in, 1-2 matching)
- [ ] Difficulty progression (easy → medium → hard)
- [ ] All multiple choice have 4 options
- [ ] Fill-in-blank lists all accepted variations
- [ ] Feedback is helpful and educational
- [ ] JSON is valid

### Index Entry
- [ ] Added to `n5-index.json`
- [ ] Order number is correct (sequential)
- [ ] Short description is 50-100 characters
- [ ] Category is correct

---

## 🛠️ Tools & Commands

### Validate JSON Syntax

```bash
# Check single file
cat public/data/grammar/points/001-x-wa-y-desu.json | jq '.'

# Check all grammar points
for file in public/data/grammar/points/*.json; do
  echo "Checking $file..."
  jq '.' "$file" > /dev/null || echo "ERROR in $file"
done

# Check all exercises
for file in public/data/grammar/exercises/*.json; do
  echo "Checking $file..."
  jq '.' "$file" > /dev/null || echo "ERROR in $file"
done
```

### Count Total Files

```bash
# Count grammar points
ls -1 public/data/grammar/points/*.json | wc -l

# Count exercises
ls -1 public/data/grammar/exercises/*.json | wc -l
```

### Quick Validation Script

Create this helper script:

```bash
#!/bin/bash
# validate-grammar.sh

echo "Validating grammar data..."

# Check index
if jq '.' public/data/grammar/n5-index.json > /dev/null 2>&1; then
  echo "✅ Index file valid"
  TOTAL=$(jq '.totalPoints' public/data/grammar/n5-index.json)
  COUNT=$(jq '.points | length' public/data/grammar/n5-index.json)
  echo "   Total points declared: $TOTAL"
  echo "   Actual points in index: $COUNT"
else
  echo "❌ Index file invalid"
fi

# Check points directory
POINTS_COUNT=$(ls -1 public/data/grammar/points/*.json 2>/dev/null | wc -l)
echo "Grammar point files: $POINTS_COUNT"

# Check exercises directory
EXERCISES_COUNT=$(ls -1 public/data/grammar/exercises/*.json 2>/dev/null | wc -l)
echo "Exercise files: $EXERCISES_COUNT"

if [ "$POINTS_COUNT" -eq "$EXERCISES_COUNT" ]; then
  echo "✅ Points and exercises match"
else
  echo "❌ Mismatch: $POINTS_COUNT points vs $EXERCISES_COUNT exercises"
fi
```

---

## 📞 Getting Help

**Questions?**
- Technical Lead: See `TECHNICAL_LEAD.md`
- Schema questions: Re-read `DATA_SCHEMA.md`
- Content questions: Check `MVP_SPECIFICATION.md`

**Blockers?**
1. Try to solve yourself (15 min)
2. Check documentation (15 min)
3. Ping Technical Lead

---

## 🎯 Success Criteria

You've succeeded when:

- [ ] All 80 grammar point JSON files created
- [ ] All 80 exercise JSON files created (800 exercises total)
- [ ] Index file lists all 80 points
- [ ] TypeScript types.ts file created
- [ ] All JSON files validate with `jq`
- [ ] No empty required fields
- [ ] Agent 2 (UI) can load and display your data
- [ ] Agent 3 (Logic) can use your exercises

**Good luck! You're building the foundation for the entire grammar stall.** 💪

---

**Document Version**: 1.0.0
**Last Updated**: 2026-01-16
