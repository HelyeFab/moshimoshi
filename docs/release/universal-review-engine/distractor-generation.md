# Distractor Generation System

## Overview

The Universal Review Engine uses sophisticated distractor generation algorithms to create educationally valuable multiple-choice questions. Distractors (incorrect answer options) are not randomly selected but carefully chosen to test genuine understanding and help learners distinguish between similar concepts.

## Architecture

### Base Pattern

All content adapters extend `BaseContentAdapter` and must implement:

```typescript
abstract generateOptions(
  content: ReviewableContent,  // The correct answer
  pool: T[],                   // Pool of all available content
  count: number = 4            // Total options including correct answer
): ReviewableContent[]
```

The method returns `count - 1` distractors plus the correct answer, which are then shuffled before presentation.

## Current Implementation by Content Type

### 1. Kana (Hiragana/Katakana) - Most Sophisticated

**File**: `src/lib/review-engine/adapters/kana.adapter.ts`

**Strategy**: Multi-layered similarity-based selection

#### Selection Priority:
1. **Same Row Characters** (Highest Priority)
   - Characters from the same consonant row (e.g., か row: か, き, く, け, こ)
   - Tests ability to distinguish within a group

2. **Visual Similarity**
   - Identifies visually confusing pairs
   - Examples:
     - れ, わ, ね (similar curved shapes)
     - は, ほ (similar structure with one mark difference)
     - ち, ら (commonly confused shapes)
     - さ, き (similar strokes)

3. **Known Confusion Pairs**
   - Hardcoded pairs that learners commonly mix up
   - Based on empirical learning data
   - Examples:
     - Romaji: 'shi' vs 'chi', 'tsu' vs 'su'
     - Characters: 'n' vs 'so', 'ru' vs 'ro'

4. **Random Fallback**
   - If insufficient similar characters found
   - Ensures always have enough options

#### Implementation Details:
```typescript
generateOptions(content, pool, count = 4) {
  // Filter for similar characters
  const similarChars = pool.filter(k => {
    if (k.row === content.metadata?.row) return true;        // Same row
    if (this.calculateVisualSimilarity(k, content)) return true;  // Visual
    if (this.isConfusionPair(k.id, content.id)) return true; // Known pairs
    return false;
  });

  // Select up to count-1 distractors
  // Fill remaining with random if needed
}
```

### 2. Vocabulary - Semantic & Structural Matching

**File**: `src/lib/review-engine/adapters/vocabulary.adapter.ts`

**Strategy**: Intelligent filtering based on multiple dimensions

#### Selection Priority:
1. **Semantically Similar** (2 max)
   - Words with overlapping meaning categories
   - Categories: motion, emotion, food, time, place
   - Similarity threshold: >60% using Levenshtein distance
   - Tests precise meaning understanding

2. **Structurally Similar** (1 max)
   - Words sharing at least one kanji
   - Same word length (±1 character)
   - Tests ability to distinguish similar-looking words

3. **Contextually Similar**
   - Same part of speech (noun, verb, adjective)
   - Same difficulty level (JLPT level)
   - Ensures appropriate challenge level

4. **Random Fill**
   - Remaining slots filled randomly
   - Maintains variety

#### Implementation Details:
```typescript
generateOptions(content, pool, count = 4) {
  // Multi-stage filtering
  const similarWords = pool.filter(v => {
    if (samePOS) return true;
    if (sameLevel) return true;
    if (similarMeaningCategory) return true;
    if (similarLength) return true;
  });

  // Priority selection
  const semanticallySimilar = findSemanticMatches(similarWords);
  const structurallySimilar = findStructuralMatches(similarWords);

  // Combine with limits
  options.push(...semanticallySimilar.slice(0, 2));
  options.push(...structurallySimilar.slice(0, 1));
  // Fill rest randomly
}
```

### 3. Kanji - Currently Basic (To Be Enhanced)

**File**: `src/lib/review-engine/adapters/kanji.adapter.ts`

**Current State**: Placeholder implementation with dummy meanings

**Issues**:
- Uses hardcoded list of meanings
- No similarity calculation
- No educational value in distractor selection

### 4. Sentences - Pattern Matching

**File**: `src/lib/review-engine/adapters/sentence.adapter.ts`

**Strategy**: Grammar and topic-based selection

#### Selection Criteria:
- Similar sentence length
- Same grammar patterns
- Same topic/context
- Similar vocabulary level

## Planned Improvements for Kanji

### Enhanced Selection Strategy

#### 1. Semantic Similarity (Priority 1)
```typescript
// Find kanji with related meanings
// Example: 水(water) → 海(sea), 川(river), 湖(lake), 雨(rain)
findSimilarByMeaning(kanji, pool) {
  const categories = getMeaningCategories(kanji.meanings);
  return pool.filter(k => {
    const kCategories = getMeaningCategories(k.meanings);
    return hasOverlap(categories, kCategories);
  });
}
```

#### 2. Structural Similarity (Priority 2)
```typescript
// Kanji sharing radicals or components
// Example: 持(hold) → 待(wait) - both have 手 radical
findSimilarByRadical(kanji, pool) {
  return pool.filter(k => {
    const sharedRadicals = kanji.radicals.filter(r =>
      k.radicals.includes(r)
    );
    return sharedRadicals.length > 0;
  });
}

// Similar stroke count (±2)
findSimilarByStrokes(kanji, pool) {
  return pool.filter(k =>
    Math.abs(k.strokeCount - kanji.strokeCount) <= 2
  );
}
```

#### 3. Phonetic Similarity (Priority 3)
```typescript
// Same or similar readings
// Example: 生(せい) → 正(せい), 性(せい), 成(せい)
findSimilarByReading(kanji, pool) {
  return pool.filter(k => {
    const hasCommonOn = kanji.onyomi.some(o => k.onyomi.includes(o));
    const hasCommonKun = kanji.kunyomi.some(ku => k.kunyomi.includes(ku));
    return hasCommonOn || hasCommonKun;
  });
}
```

#### 4. Common Confusion Patterns (Priority 4)
```typescript
// Known confusion pairs from learning data
const CONFUSION_PAIRS = [
  ['末', '未'],  // end vs not yet
  ['土', '士'],  // earth vs samurai
  ['千', '干'],  // thousand vs dry
  ['大', '犬'],  // big vs dog
  ['人', '入'],  // person vs enter
  ['日', '曰'],  // day vs say
];

getConfusionPairs(kanji) {
  return CONFUSION_PAIRS
    .filter(pair => pair.includes(kanji.character))
    .flat()
    .filter(k => k !== kanji.character);
}
```

#### 5. Learning Level (Priority 5)
```typescript
// Same JLPT level or grade for appropriate difficulty
findSimilarByLevel(kanji, pool) {
  return pool.filter(k =>
    k.jlpt === kanji.jlpt ||
    Math.abs(k.grade - kanji.grade) <= 1
  );
}
```

### Complete Implementation

```typescript
generateOptions(content, pool, count = 4) {
  const metadata = content.metadata;
  const usedIds = new Set([content.id]);
  const options = [];

  // Priority 1: Semantic similarity
  const semanticMatches = this.findSimilarByMeaning(content, pool)
    .filter(k => !usedIds.has(k.id));
  this.addOptions(options, semanticMatches, 1, usedIds);

  // Priority 2: Structural similarity
  const structuralMatches = this.findSimilarByRadical(content, pool)
    .filter(k => !usedIds.has(k.id));
  this.addOptions(options, structuralMatches, 1, usedIds);

  // Priority 3: Phonetic similarity
  const phoneticMatches = this.findSimilarByReading(content, pool)
    .filter(k => !usedIds.has(k.id));
  this.addOptions(options, phoneticMatches, 1, usedIds);

  // Priority 4: Known confusions
  const confusions = this.getConfusionPairs(content)
    .filter(k => !usedIds.has(k.id));
  this.addOptions(options, confusions, count, usedIds);

  // Fill remaining with level-appropriate random
  if (options.length < count - 1) {
    const levelMatches = this.findSimilarByLevel(content, pool)
      .filter(k => !usedIds.has(k.id));
    this.addRandomOptions(options, levelMatches, count - 1 - options.length, usedIds);
  }

  return options.map(k => this.transform(k));
}
```

## Similarity Calculations

### Levenshtein Distance
Used for string similarity (meanings, readings):
```typescript
calculateSimilarity(a: string, b: string): number {
  // Returns 0-1 score (1 = identical)
  // Implementation in base.adapter.ts
}
```

### Semantic Categories
Meaning categorization for grouping related concepts:
```typescript
const MEANING_CATEGORIES = {
  'nature': ['water', 'fire', 'earth', 'wind', 'tree', 'mountain'],
  'time': ['day', 'month', 'year', 'hour', 'minute', 'time'],
  'people': ['person', 'man', 'woman', 'child', 'friend'],
  'movement': ['go', 'come', 'walk', 'run', 'stop', 'turn'],
  // ... more categories
};
```

## Educational Principles

### 1. **Test Understanding, Not Luck**
- Distractors should be plausible wrong answers
- Random selection only as last resort

### 2. **Progressive Difficulty**
- Easier: Obviously different distractors
- Harder: Subtle differences requiring deep knowledge

### 3. **Learn from Mistakes**
- Similar distractors help identify knowledge gaps
- Confusion pairs highlight common errors

### 4. **Contextual Appropriateness**
- Match learner's level (JLPT, grade)
- Avoid mixing beginner and advanced content

### 5. **Variety and Fairness**
- Shuffle final options to prevent patterns
- Ensure no duplicate options
- Balance difficulty across questions

## Performance Considerations

### Target Metrics
- Generation time: <100ms for up to 1000 items
- Memory usage: Minimal - reuse pool data
- Cache similarity calculations when possible

### Optimization Strategies
1. **Pre-filtering**: Narrow pool before detailed analysis
2. **Early termination**: Stop when enough good distractors found
3. **Indexed lookups**: Use maps for radical/component matching
4. **Lazy evaluation**: Calculate similarity only when needed

## Testing Strategy

### Unit Tests
- Each selection strategy independently
- Edge cases (empty pool, single item)
- Performance benchmarks

### Integration Tests
- Full generation with real data
- Mode-specific generation (recognition vs recall)
- Cross-adapter consistency

### Educational Validation
- A/B testing with learners
- Track confusion patterns
- Adjust algorithms based on data

## Future Enhancements

### 1. Machine Learning Integration
- Learn confusion patterns from user data
- Personalized distractor difficulty
- Adaptive selection based on user history

### 2. Context-Aware Generation
- Consider review session history
- Avoid recently seen distractors
- Focus on user's weak points

### 3. Multi-Modal Distractors
- Audio distractors for listening mode
- Visual distractors for character recognition
- Stroke order distractors for writing

### 4. Explanation Generation
- Why each distractor is wrong
- What makes it different from correct answer
- Learning tips for avoiding confusion

## Configuration

Distractor generation can be configured per content type:

```typescript
const config = {
  kana: {
    prioritizeSameRow: true,
    useVisualSimilarity: true,
    useConfusionPairs: true,
    maxRandomFallback: 1
  },
  kanji: {
    prioritizeRadicals: true,
    prioritizeMeaning: true,
    prioritizeReading: false,  // Can be toggled
    maxSimilarityGroups: 3
  },
  vocabulary: {
    semanticWeight: 0.5,
    structuralWeight: 0.3,
    contextualWeight: 0.2
  }
};
```

## Debugging

Enable debug logging for distractor generation:
```javascript
localStorage.setItem('debug:distractors', 'true');
```

This will log:
- Pool size and filtering steps
- Similarity scores for each candidate
- Final selection reasoning
- Performance metrics

## Conclusion

The distractor generation system is a critical component of the Universal Review Engine, directly impacting learning effectiveness. By carefully selecting distractors based on similarity, confusion patterns, and educational principles, we create a more engaging and valuable learning experience that helps users truly master the content rather than just memorize answers.