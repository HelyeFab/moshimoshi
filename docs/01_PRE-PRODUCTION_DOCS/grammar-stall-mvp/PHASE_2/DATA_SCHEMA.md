# Grammar Stall Phase 2 Data Schema

**Version**: 1.0.0
**Last Updated**: 2026-01-17

---

## Goals
- Preserve current N5 schema.
- Add structure to support N4+ with minimal UI changes.
- Keep file naming predictable for static generation.

---

## File Layout

```
/public/data/grammar/
  n5-index.json
  n4-index.json
  n3-index.json
  n2-index.json
  n1-index.json
  points/
    n5/
      001-x-wa-y-desu.json
      ...
    n4/
      ...
  exercises/
    n5/
      001-x-wa-y-desu.json
      ...
    n4/
      ...
```

---

## Index File Schema (Per Level)

**File**: `/public/data/grammar/{level}-index.json`

```json
{
  "version": "1.0.0",
  "jlptLevel": "N5",
  "totalPoints": 80,
  "lastUpdated": "2026-01-17",
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
      "shortDescription": "Basic polite pattern for identity and simple descriptions.",
      "jlptLevel": "N5",
      "difficulty": "beginner"
    }
  ]
}
```

---

## Grammar Point Schema

**File**: `/public/data/grammar/points/{level}/{id}.json`

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
    "en": "...",
    "ja": ""
  },
  "structure": {
    "pattern": "X は Y です",
    "components": [
      {
        "part": "X",
        "explanation": "...",
        "examples": ["私", "これ"]
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
      "notes": "Common self-introduction"
    }
  ],
  "relatedPoints": ["002-x-wa-y-de-wa-arimasen"],
  "commonMistakes": [
    {
      "mistake": "Using を instead of は",
      "correction": "は marks the topic, を marks the direct object",
      "example": "❌ 私を学生です → ✅ 私は学生です"
    }
  ],
  "tags": ["basic", "identity"]
}
```

---

## Exercise File Schema

**File**: `/public/data/grammar/exercises/{level}/{id}.json`

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
        { "id": "a", "text": "は", "romaji": "wa" }
      ],
      "correctAnswer": "a",
      "correctFeedback": "Perfect! は marks the topic in XはYです.",
      "incorrectFeedback": "Not quite. Use は to mark the topic.",
      "explanation": "In XはYです, は marks the topic (X).",
      "difficulty": "easy"
    }
  ]
}
```

---

## URE Mapping (Logical Schema)

When converting grammar exercises to URE items:

```ts
ReviewableContent {
  id: string               // unique exercise id
  contentType: 'grammar'
  prompt: string           // exercise.question
  answer: string           // exercise.correctAnswer or normalized
  difficulty: 'easy'|'medium'|'hard'
  metadata: {
    grammarPointId: string
    exerciseId: string
    exerciseType: 'multiple-choice'|'fill-in-blank'|'sentence-matching'
    level: 'N5'|'N4'|'N3'|'N2'|'N1'
  }
}
```

---

## TypeScript Interface Notes

Ensure types match the data:
- `CommonMistake` must include `example: string` (or rename in data consistently).
- `shortDescription` length must be 50-100 characters.

