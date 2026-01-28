# Agent 1 - Data Engineer (Standalone Prompt)

**Role**: Data & Content Creation Specialist
**Project**: Grammar Stall MVP
**Timeline**: Days 1-2 (10 points), Days 9-10 (70 points)
**Branch**: `grammar-stall-mvp-agent1-data`

---

## 🎯 Your Mission

You are the **Data Engineer** responsible for creating all N5 grammar content. Your deliverables:

1. **80 Grammar Point JSON files** with explanations and examples
2. **80 Exercise JSON files** with 10 exercises each (800 total exercises)
3. **1 Index JSON file** listing all grammar points
4. **TypeScript interfaces** matching the JSON structure

**Total**: 161 files

---

## 📅 Your Schedule

### Days 1-2: Foundation (10 Grammar Points)

**Day 1 Morning**:
- Create file structure
- Define TypeScript interfaces
- Create 3 sample grammar points

**Day 1 Afternoon**:
- Fix any issues from review
- Create 7 more grammar points (total: 10)

**Day 2**:
- Create exercises for all 10 points (100 exercises total)
- Validate JSON syntax
- Submit for code review

**Deliverable**: 10 complete grammar points ready for Agent 2 to use

---

### Days 9-10: Content Completion (70 Grammar Points)

**Day 9**: Create points 11-50 + exercises (40 points, 400 exercises)
**Day 10**: Create points 51-80 + exercises (30 points, 300 exercises)

**Deliverable**: All 80 grammar points complete

---

## 📁 File Structure You'll Create

```
/public/data/grammar/
├── n5-index.json                     # YOU CREATE THIS
├── points/                           # YOU CREATE 80 FILES
│   ├── 001-x-wa-y-desu.json
│   ├── 002-x-wa-y-de-wa-arimasen.json
│   └── ... (78 more files)
└── exercises/                        # YOU CREATE 80 FILES
    ├── 001-x-wa-y-desu.json
    ├── 002-x-wa-y-de-wa-arimasen.json
    └── ... (78 more files)

/src/lib/grammar/
└── types.ts                          # YOU CREATE THIS
```

---

## 📊 COMPLETE DATA SCHEMAS

This section contains the COMPLETE JSON structure and TypeScript interfaces you need.

### Schema 1: Grammar Index File

**File**: `/public/data/grammar/n5-index.json`

**Purpose**: Lists all 80 N5 grammar points for the grid view.

**JSON Structure**:

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
      "shortDescription": "Basic identity and description sentences",
      "jlptLevel": "N5",
      "difficulty": "beginner"
    },
    {
      "id": "002-x-wa-y-de-wa-arimasen",
      "order": 2,
      "category": "basic-sentences",
      "title": {
        "ja": "XはYではありません",
        "romaji": "X wa Y de wa arimasen",
        "en": "X is not Y"
      },
      "shortDescription": "Negative form of XはYです",
      "jlptLevel": "N5",
      "difficulty": "beginner"
    }
    // ... 78 more points
  ]
}
```

**TypeScript Interface**:

```typescript
export interface GrammarPointIndex {
  id: string // e.g., "001-x-wa-y-desu"
  order: number // 1-80
  category: string // e.g., "basic-sentences", "particles", "verbs"
  title: {
    ja: string
    romaji: string
    en: string
  }
  shortDescription: string // 50-100 characters
  jlptLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1' // Always "N5" for MVP
  difficulty: 'beginner' | 'intermediate' | 'advanced' // Always "beginner" for MVP
}

export interface GrammarIndexFile {
  version: string
  jlptLevel: string
  totalPoints: number
  lastUpdated: string // ISO date
  points: GrammarPointIndex[]
}
```

**Validation Rules**:
- `id`: Must match filename slug (without number prefix)
- `order`: Unique integers 1-80
- `category`: One of: `basic-sentences`, `particles`, `verbs`, `adjectives`, `time-expressions`, `existence`, `comparisons`, `questions`, `numbers-counters`, `necessity-ability`, `giving-receiving`, `miscellaneous`
- `shortDescription`: 50-100 characters

---

### Schema 2: Grammar Point Detail File

**File**: `/public/data/grammar/points/{id}.json`

**Purpose**: Full grammar point data including explanation, examples, and structure.

**JSON Structure**:

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
      "notes": "Describing a place"
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

**TypeScript Interface**:

```typescript
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
    ja: string // Empty for MVP
  }
  structure: {
    pattern: string
    components: StructureComponent[]
  }
  examples: Example[]
  relatedPoints: string[] // Array of grammar point IDs
  commonMistakes?: CommonMistake[] // Optional
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
  breakdown: Record<string, string> // Word-by-word translation
  notes?: string // Optional
}

export interface CommonMistake {
  mistake: string
  correction: string
  example: string
}
```

**Content Guidelines**:

**Explanation** (200-300 words):
- Write for absolute beginners
- Use simple English, avoid jargon
- Explain WHY, not just WHAT
- Include key points as bullet list

**Examples** (3-5 required):
- Use only N5 vocabulary
- Progress from simple to complex
- Provide complete word-by-word breakdown
- Include romaji for pronunciation

**Related Points** (1-3):
- Link to grammar points by exact ID

---

### Schema 3: Exercise File

**File**: `/public/data/grammar/exercises/{id}.json`

**Purpose**: Interactive exercises for practicing the grammar point.

**JSON Structure**:

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
      "id": "001-x-wa-y-desu-ex-03",
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
        }
      ],
      "correctFeedback": "Perfect! You matched all sentences correctly.",
      "incorrectFeedback": "Not quite. Review the XはYです pattern and try again.",
      "explanation": "All sentences follow the basic pattern: Topic は Description です",
      "difficulty": "easy"
    }
    // ... 7 more exercises (total 10 per grammar point)
  ]
}
```

**TypeScript Interface**:

```typescript
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
  correctAnswer: string // Option ID (e.g., "a", "b", "c", "d")
}

export interface MultipleChoiceOption {
  id: string // "a", "b", "c", "d"
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
```

**Exercise Distribution per Grammar Point** (10 total):
- **Multiple Choice**: 4-5 exercises
- **Fill-in-Blank**: 3-4 exercises
- **Sentence Matching**: 1-2 exercises

**Difficulty Progression**:
- Exercises 1-3: **Easy** (direct application)
- Exercises 4-7: **Medium** (requires thinking)
- Exercises 8-10: **Hard** (creative application)

---

## 🗂️ COMPLETE N5 GRAMMAR POINT LIST (80 Points)

Create these files in order:

### Basic Sentences (5 points)
1. `001-x-wa-y-desu` - XはYです (X is Y)
2. `002-x-wa-y-de-wa-arimasen` - XはYではありません (X is not Y)
3. `003-kore-sore-are` - これ/それ/あれ (this/that)
4. `004-basic-word-order` - Basic SOV word order
5. `005-sentence-ending-particles` - ね、よ、か

### Particles (15 points)
6. `006-particle-wa` - は (topic marker)
7. `007-particle-ga` - が (subject marker)
8. `008-particle-wo` - を (object marker)
9. `009-particle-ni-location` - に (location/time)
10. `010-particle-ni-indirect-object` - に (indirect object)
11. `011-particle-de-location` - で (location of action)
12. `012-particle-de-means` - で (means/method)
13. `013-particle-e` - へ (direction)
14. `014-particle-to-and` - と (and - for nouns)
15. `015-particle-to-with` - と (with - doing together)
16. `016-particle-no-possessive` - の (possessive)
17. `017-particle-no-explanation` - の (nominalizer)
18. `018-particle-ka-question` - か (question marker)
19. `019-particle-mo` - も (also, too)
20. `020-particle-ya` - や (and - non-exhaustive list)

### Verbs (20 points)
21. `021-verb-groups` - Verb groups (う、る、irregular)
22. `022-masu-form-present` - ます form (present/future)
23. `023-masu-form-negative` - ません form (negative)
24. `024-masu-form-past` - ました form (past)
25. `025-masu-form-past-negative` - ませんでした (past negative)
26. `026-te-form-basics` - て form basics
27. `027-te-iru-progressive` - ～ている (continuous)
28. `028-te-kudasai` - ～てください (please do)
29. `029-tai-want-to` - ～たい (want to)
30. `030-mashou-lets` - ～ましょう (let's)
31. `031-masen-ka-invitation` - ～ませんか (won't you...?)
32. `032-te-mo-ii` - ～てもいい (may)
33. `033-te-wa-ikenai` - ～てはいけない (must not)
34. `034-nakute-wa-ikenai` - ～なくてはいけない (must)
35. `035-koto-ga-dekiru` - ～ことができる (can)
36. `036-plain-form-present` - Plain form (present)
37. `037-plain-form-past` - Plain form (past)
38. `038-plain-form-negative` - Plain form (negative)
39. `039-nai-form` - ない form
40. `040-dictionary-form` - Dictionary form

### Adjectives (10 points)
41. `041-i-adjectives-present` - い-adjectives (present)
42. `042-i-adjectives-past` - い-adjectives (past)
43. `043-i-adjectives-negative` - い-adjectives (negative)
44. `044-i-adjectives-past-negative` - い-adjectives (past negative)
45. `045-na-adjectives-present` - な-adjectives (present)
46. `046-na-adjectives-past` - な-adjectives (past)
47. `047-na-adjectives-negative` - な-adjectives (negative)
48. `048-na-adjectives-past-negative` - な-adjectives (past negative)
49. `049-adjective-modification` - Adjective + noun
50. `050-i-adjective-adverb` - い-adjective → adverb (く)

### Time Expressions (8 points)
51. `051-time-particle-ni` - Time に
52. `052-duration-particle-kan` - Duration 間
53. `053-made-until` - まで (until)
54. `054-kara-from` - から (from)
55. `055-mae-ni-before` - 前に (before)
56. `056-ato-de-after` - 後で (after)
57. `057-frequency-adverbs` - いつも、時々
58. `058-toki-when` - 時 (when)

### Existence (5 points)
59. `059-iru-animate` - いる (animate)
60. `060-aru-inanimate` - ある (inanimate)
61. `061-imasu-arimasu` - います/あります (polite)
62. `062-location-ni-iru-aru` - Location に いる/ある
63. `063-possession-ga-aru` - Possession が ある

### Comparisons (4 points)
64. `064-yori-than` - より (than)
65. `065-hou-ga-more-than` - ～方が～ (more than)
66. `066-ichiban-most` - 一番 (most)
67. `067-onaji-same` - 同じ (same as)

### Questions (6 points)
68. `068-question-nani-what` - 何 (what)
69. `069-question-dare-who` - 誰 (who)
70. `070-question-doko-where` - どこ (where)
71. `071-question-itsu-when` - いつ (when)
72. `072-question-naze-doushite-why` - なぜ/どうして (why)
73. `073-question-dou-how` - どう (how)

### Numbers & Counters (5 points)
74. `074-counter-tsu` - ～つ (general)
75. `075-counter-nin` - ～人 (people)
76. `076-counter-hon` - ～本 (long objects)
77. `077-counter-mai` - ～枚 (flat objects)
78. `078-age-sai` - ～歳 (age)

### Miscellaneous (2 points)
79. `079-kara-because` - ～から (because)
80. `080-node-so` - ～ので (so, therefore)

---

## 🔧 STEP-BY-STEP IMPLEMENTATION

### Step 1: Create TypeScript Interfaces

**File**: `/src/lib/grammar/types.ts`

Copy ALL the TypeScript interfaces from the schemas above into this single file. This is your first deliverable.

```typescript
// src/lib/grammar/types.ts

// Grammar Index Types
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

// Grammar Point Types
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

// Exercise Types
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

// Grammar Categories
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

---

### Step 2: Create Directory Structure

```bash
cd /home/beano/DevProjects/NextJs/moshimoshi

mkdir -p public/data/grammar/points
mkdir -p public/data/grammar/exercises
```

---

### Step 3: Create First 10 Grammar Points (Days 1-2)

**Priority Order**:
1. `001-x-wa-y-desu` (EXAMPLE PROVIDED ABOVE - use as template)
2. `002-x-wa-y-de-wa-arimasen`
3. `006-particle-wa`
4. `007-particle-ga`
5. `008-particle-wo`
6. `022-masu-form-present`
7. `041-i-adjectives-present`
8. `045-na-adjectives-present`
9. `059-iru-animate`
10. `060-aru-inanimate`

For each grammar point:
1. Create `/public/data/grammar/points/{id}.json`
2. Create `/public/data/grammar/exercises/{id}.json` with 10 exercises
3. Add entry to `/public/data/grammar/n5-index.json`

---

## ✅ QUALITY CHECKLIST

Before submitting each file:

### Grammar Point File
- [ ] ID matches filename
- [ ] Explanation is 200-300 words
- [ ] Beginner-friendly (no jargon)
- [ ] 3-5 examples with all fields
- [ ] Only N5 vocabulary in examples
- [ ] Related points reference valid IDs
- [ ] JSON is valid (use `jq '.' filename.json`)

### Exercise File
- [ ] Exactly 10 exercises
- [ ] 4-5 multiple choice, 3-4 fill-in-blank, 1-2 matching
- [ ] Easy → medium → hard progression
- [ ] All MC have 4 options
- [ ] Fill-in-blank lists accepted variations
- [ ] Feedback is educational
- [ ] JSON is valid

### Index File
- [ ] All grammar points listed
- [ ] Orders are sequential (1-80)
- [ ] No duplicate IDs or orders
- [ ] `totalPoints` matches actual count

---

## 🛠️ VALIDATION COMMANDS

```bash
# Validate single file
cat public/data/grammar/points/001-x-wa-y-desu.json | jq '.'

# Validate all points
for file in public/data/grammar/points/*.json; do
  jq '.' "$file" > /dev/null || echo "ERROR in $file"
done

# Count files
ls -1 public/data/grammar/points/*.json | wc -l
ls -1 public/data/grammar/exercises/*.json | wc -l
```

---

## 📝 CONTENT WRITING GUIDELINES

### Grammar Explanations

**DO**:
✅ Write for absolute beginners
✅ Use analogies ("Think of は as 'as for...'")
✅ Explain WHY, not just WHAT
✅ Use bullet points for key concepts
✅ 200-300 words
✅ Include common use cases

**DON'T**:
❌ Use jargon without explanation
❌ Assume knowledge of other grammar
❌ Write long essays
❌ Skip the "why it matters"

### Exercise Design

**Multiple Choice**:
- Always 4 options (A, B, C, D)
- Distractors are common mistakes
- Feedback explains WHY answer is correct

**Fill-in-Blank**:
- Accept kanji, hiragana, AND romaji
- List ALL accepted variations
- Provide 1-2 hints for medium/hard

**Sentence Matching**:
- 3-4 pairs per exercise
- All use same grammar pattern
- Vary vocabulary

---

## 🎯 SUCCESS CRITERIA

You've succeeded when:

- [ ] `/src/lib/grammar/types.ts` created
- [ ] 10 grammar point JSON files created (Days 1-2)
- [ ] 10 exercise JSON files created (100 exercises)
- [ ] `n5-index.json` has 10 entries
- [ ] All JSON validates with `jq`
- [ ] No empty required fields
- [ ] Agent 2 can load and display your data
- [ ] All 80 points complete (Day 10)

---

## 📞 GETTING HELP

**If you're stuck**:
1. Check the example file (`001-x-wa-y-desu.json`) above
2. Validate JSON syntax with `jq`
3. Re-read the schemas
4. Ping Technical Lead

**You're building the content foundation. Take your time and make it educational!** 📚

---

**Document Version**: 2.0.0 (Standalone)
**Last Updated**: 2026-01-16
