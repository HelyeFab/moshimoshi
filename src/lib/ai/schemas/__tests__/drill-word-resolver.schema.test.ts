/**
 * Tests for Drill Word Resolver Schema
 *
 * Validates:
 * - Valid outputs parse correctly (main schema for OpenAI)
 * - Lenient schema accepts missing optional fields (for Ollama)
 * - Invalid/malformed outputs are rejected
 * - Missing reading / invalid conjugationType rejected
 * - Confidence enum enforced
 * - Alternatives array validates
 */

import { describe, it, expect } from '@jest/globals';
import {
  DrillWordResolverResultSchema,
  DrillWordResolverResultLenientSchema,
  DrillWordResolverConfidenceSchema,
  DrillWordResolverConjugationTypeSchema,
  DrillWordResolverPartOfSpeechSchema,
} from '../drill-word-resolver.schema';

// ============================================
// Fixtures — complete (for main schema / OpenAI)
// All nullable fields explicitly included
// ============================================

const validIchidanVerb = {
  surface: '食べて',
  lemma: '食べる',
  reading: 'たべる',
  meaning: 'to eat',
  partOfSpeech: 'verb' as const,
  conjugationType: 'Ichidan' as const,
  confidence: 'high' as const,
  alternatives: null,
  notes: null,
};

const validGodanVerb = {
  surface: '書いた',
  lemma: '書く',
  reading: 'かく',
  meaning: 'to write',
  partOfSpeech: 'verb' as const,
  conjugationType: 'Godan' as const,
  confidence: 'high' as const,
  alternatives: null,
  notes: 'ku-ending godan verb',
};

const validIrregularVerb = {
  surface: 'した',
  lemma: 'する',
  reading: 'する',
  meaning: 'to do',
  partOfSpeech: 'verb' as const,
  conjugationType: 'Irregular' as const,
  confidence: 'high' as const,
  alternatives: null,
  notes: 'suru-verb',
};

const validIAdjective = {
  surface: '高くない',
  lemma: '高い',
  reading: 'たかい',
  meaning: 'tall; expensive',
  partOfSpeech: 'i-adjective' as const,
  conjugationType: 'i-adjective' as const,
  confidence: 'high' as const,
  alternatives: null,
  notes: null,
};

const validNaAdjective = {
  surface: '静かな',
  lemma: '静か',
  reading: 'しずか',
  meaning: 'quiet',
  partOfSpeech: 'na-adjective' as const,
  conjugationType: 'na-adjective' as const,
  confidence: 'high' as const,
  alternatives: null,
  notes: null,
};

const validNoun = {
  surface: '学校',
  lemma: '学校',
  reading: 'がっこう',
  meaning: 'school',
  partOfSpeech: 'noun' as const,
  conjugationType: null,
  confidence: 'high' as const,
  alternatives: null,
  notes: null,
};

const validWithAlternatives = {
  surface: 'はし',
  lemma: '橋',
  reading: 'はし',
  meaning: 'bridge',
  partOfSpeech: 'noun' as const,
  conjugationType: null,
  confidence: 'medium' as const,
  alternatives: [
    {
      surface: 'はし',
      lemma: '箸',
      reading: 'はし',
      meaning: 'chopsticks',
      partOfSpeech: 'noun' as const,
      conjugationType: null,
      confidence: 'medium' as const,
    },
    {
      surface: 'はし',
      lemma: '端',
      reading: 'はし',
      meaning: 'edge; end',
      partOfSpeech: 'noun' as const,
      conjugationType: null,
      confidence: 'low' as const,
    },
  ],
  notes: 'Ambiguous without context — could be bridge, chopsticks, or edge',
};

const validMinimalNullable = {
  surface: '猫',
  lemma: '猫',
  reading: 'ねこ',
  meaning: null,
  partOfSpeech: 'noun' as const,
  conjugationType: null,
  confidence: 'high' as const,
  alternatives: null,
  notes: null,
};

// ============================================
// Main Schema Tests (OpenAI — all fields present)
// ============================================

describe('DrillWordResolverResultSchema (OpenAI-compatible)', () => {
  describe('valid outputs', () => {
    it('parses an Ichidan verb', () => {
      const result = DrillWordResolverResultSchema.safeParse(validIchidanVerb);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.conjugationType).toBe('Ichidan');
        expect(result.data.partOfSpeech).toBe('verb');
      }
    });

    it('parses a Godan verb with notes', () => {
      const result = DrillWordResolverResultSchema.safeParse(validGodanVerb);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.conjugationType).toBe('Godan');
        expect(result.data.notes).toBe('ku-ending godan verb');
      }
    });

    it('parses an Irregular verb', () => {
      const result = DrillWordResolverResultSchema.safeParse(validIrregularVerb);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.conjugationType).toBe('Irregular');
      }
    });

    it('parses an i-adjective', () => {
      const result = DrillWordResolverResultSchema.safeParse(validIAdjective);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.conjugationType).toBe('i-adjective');
      }
    });

    it('parses a na-adjective', () => {
      const result = DrillWordResolverResultSchema.safeParse(validNaAdjective);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.conjugationType).toBe('na-adjective');
      }
    });

    it('parses a noun with null conjugationType', () => {
      const result = DrillWordResolverResultSchema.safeParse(validNoun);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.conjugationType).toBeNull();
      }
    });

    it('parses a result with alternatives', () => {
      const result = DrillWordResolverResultSchema.safeParse(validWithAlternatives);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.alternatives).toHaveLength(2);
        expect(result.data.alternatives![0].lemma).toBe('箸');
      }
    });

    it('parses a minimal result with null optional fields', () => {
      const result = DrillWordResolverResultSchema.safeParse(validMinimalNullable);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.meaning).toBeNull();
        expect(result.data.conjugationType).toBeNull();
        expect(result.data.alternatives).toBeNull();
      }
    });
  });

  describe('invalid outputs', () => {
    it('rejects missing surface', () => {
      const { surface, ...rest } = validIchidanVerb;
      const result = DrillWordResolverResultSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects missing lemma', () => {
      const { lemma, ...rest } = validIchidanVerb;
      const result = DrillWordResolverResultSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects missing reading', () => {
      const { reading, ...rest } = validIchidanVerb;
      const result = DrillWordResolverResultSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects missing partOfSpeech', () => {
      const { partOfSpeech, ...rest } = validIchidanVerb;
      const result = DrillWordResolverResultSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects missing confidence', () => {
      const { confidence, ...rest } = validIchidanVerb;
      const result = DrillWordResolverResultSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects invalid conjugationType value', () => {
      const result = DrillWordResolverResultSchema.safeParse({
        ...validIchidanVerb,
        conjugationType: 'ru-verb',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid partOfSpeech value', () => {
      const result = DrillWordResolverResultSchema.safeParse({
        ...validNoun,
        partOfSpeech: 'pronoun',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid confidence value', () => {
      const result = DrillWordResolverResultSchema.safeParse({
        ...validNoun,
        confidence: 'very_high',
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-string surface', () => {
      const result = DrillWordResolverResultSchema.safeParse({
        ...validNoun,
        surface: 123,
      });
      expect(result.success).toBe(false);
    });

    it('rejects null input', () => {
      const result = DrillWordResolverResultSchema.safeParse(null);
      expect(result.success).toBe(false);
    });

    it('rejects empty object', () => {
      const result = DrillWordResolverResultSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('rejects malformed alternatives array', () => {
      const result = DrillWordResolverResultSchema.safeParse({
        ...validNoun,
        alternatives: [{ bad: 'data' }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects alternative with missing reading', () => {
      const result = DrillWordResolverResultSchema.safeParse({
        ...validNoun,
        alternatives: [{
          surface: 'はし',
          lemma: '箸',
          // missing reading
          meaning: null,
          partOfSpeech: 'noun',
          conjugationType: null,
          confidence: 'medium',
        }],
      });
      expect(result.success).toBe(false);
    });
  });
});

// ============================================
// Lenient Schema Tests (Ollama — missing fields OK)
// ============================================

describe('DrillWordResolverResultLenientSchema (Ollama-compatible)', () => {
  it('accepts complete fixture', () => {
    const result = DrillWordResolverResultLenientSchema.safeParse(validIchidanVerb);
    expect(result.success).toBe(true);
  });

  it('accepts missing meaning (undefined)', () => {
    const result = DrillWordResolverResultLenientSchema.safeParse({
      surface: '猫',
      lemma: '猫',
      reading: 'ねこ',
      partOfSpeech: 'noun',
      confidence: 'high',
    });
    expect(result.success).toBe(true);
  });

  it('accepts missing conjugationType, alternatives, notes', () => {
    const result = DrillWordResolverResultLenientSchema.safeParse({
      surface: '学校',
      lemma: '学校',
      reading: 'がっこう',
      meaning: 'school',
      partOfSpeech: 'noun',
      confidence: 'high',
    });
    expect(result.success).toBe(true);
  });

  it('accepts null meaning', () => {
    const result = DrillWordResolverResultLenientSchema.safeParse({
      surface: '猫',
      lemma: '猫',
      reading: 'ねこ',
      meaning: null,
      partOfSpeech: 'noun',
      confidence: 'high',
    });
    expect(result.success).toBe(true);
  });

  it('still rejects missing required fields (surface, lemma, reading)', () => {
    const result = DrillWordResolverResultLenientSchema.safeParse({
      surface: '猫',
      // missing lemma
      reading: 'ねこ',
      partOfSpeech: 'noun',
      confidence: 'high',
    });
    expect(result.success).toBe(false);
  });

  it('still rejects invalid enum values', () => {
    const result = DrillWordResolverResultLenientSchema.safeParse({
      surface: '猫',
      lemma: '猫',
      reading: 'ねこ',
      partOfSpeech: 'pronoun',
      confidence: 'high',
    });
    expect(result.success).toBe(false);
  });
});

// ============================================
// Semantic consistency tests (superRefine)
// partOfSpeech ↔ conjugationType invariant
// ============================================

describe('partOfSpeech ↔ conjugationType consistency (main schema)', () => {
  // Helper to build a complete fixture for the main schema
  const make = (pos: string, ct: string | null) => ({
    surface: 'test',
    lemma: 'test',
    reading: 'てすと',
    meaning: null,
    partOfSpeech: pos,
    conjugationType: ct,
    confidence: 'high',
    alternatives: null,
    notes: null,
  });

  describe('verb requires Ichidan | Godan | Irregular', () => {
    it.each(['Ichidan', 'Godan', 'Irregular'])('accepts verb + %s', (ct) => {
      expect(DrillWordResolverResultSchema.safeParse(make('verb', ct)).success).toBe(true);
    });

    it('rejects verb + null', () => {
      expect(DrillWordResolverResultSchema.safeParse(make('verb', null)).success).toBe(false);
    });

    it('rejects verb + i-adjective', () => {
      expect(DrillWordResolverResultSchema.safeParse(make('verb', 'i-adjective')).success).toBe(false);
    });

    it('rejects verb + na-adjective', () => {
      expect(DrillWordResolverResultSchema.safeParse(make('verb', 'na-adjective')).success).toBe(false);
    });
  });

  describe('i-adjective requires conjugationType "i-adjective"', () => {
    it('accepts i-adjective + i-adjective', () => {
      expect(DrillWordResolverResultSchema.safeParse(make('i-adjective', 'i-adjective')).success).toBe(true);
    });

    it('rejects i-adjective + null', () => {
      expect(DrillWordResolverResultSchema.safeParse(make('i-adjective', null)).success).toBe(false);
    });

    it('rejects i-adjective + Ichidan', () => {
      expect(DrillWordResolverResultSchema.safeParse(make('i-adjective', 'Ichidan')).success).toBe(false);
    });

    it('rejects i-adjective + na-adjective', () => {
      expect(DrillWordResolverResultSchema.safeParse(make('i-adjective', 'na-adjective')).success).toBe(false);
    });
  });

  describe('na-adjective requires conjugationType "na-adjective"', () => {
    it('accepts na-adjective + na-adjective', () => {
      expect(DrillWordResolverResultSchema.safeParse(make('na-adjective', 'na-adjective')).success).toBe(true);
    });

    it('rejects na-adjective + null', () => {
      expect(DrillWordResolverResultSchema.safeParse(make('na-adjective', null)).success).toBe(false);
    });

    it('rejects na-adjective + Godan', () => {
      expect(DrillWordResolverResultSchema.safeParse(make('na-adjective', 'Godan')).success).toBe(false);
    });

    it('rejects na-adjective + i-adjective', () => {
      expect(DrillWordResolverResultSchema.safeParse(make('na-adjective', 'i-adjective')).success).toBe(false);
    });
  });

  describe('non-conjugatable POS must have null conjugationType', () => {
    it.each(['noun', 'adverb', 'particle', 'other'])('%s + null passes', (pos) => {
      expect(DrillWordResolverResultSchema.safeParse(make(pos, null)).success).toBe(true);
    });

    it('rejects noun + Godan', () => {
      expect(DrillWordResolverResultSchema.safeParse(make('noun', 'Godan')).success).toBe(false);
    });

    it('rejects noun + Ichidan', () => {
      expect(DrillWordResolverResultSchema.safeParse(make('noun', 'Ichidan')).success).toBe(false);
    });

    it('rejects adverb + Irregular', () => {
      expect(DrillWordResolverResultSchema.safeParse(make('adverb', 'Irregular')).success).toBe(false);
    });

    it('rejects particle + i-adjective', () => {
      expect(DrillWordResolverResultSchema.safeParse(make('particle', 'i-adjective')).success).toBe(false);
    });

    it('rejects other + na-adjective', () => {
      expect(DrillWordResolverResultSchema.safeParse(make('other', 'na-adjective')).success).toBe(false);
    });
  });

  describe('alternatives also enforce consistency', () => {
    it('rejects alternative with noun + Godan', () => {
      const result = DrillWordResolverResultSchema.safeParse({
        ...make('noun', null),
        alternatives: [{
          surface: 'test',
          lemma: 'test',
          reading: 'てすと',
          meaning: null,
          partOfSpeech: 'noun',
          conjugationType: 'Godan', // invalid for noun
          confidence: 'low',
        }],
      });
      expect(result.success).toBe(false);
    });

    it('accepts alternative with verb + Ichidan', () => {
      const result = DrillWordResolverResultSchema.safeParse({
        ...make('noun', null),
        alternatives: [{
          surface: 'test',
          lemma: 'test',
          reading: 'てすと',
          meaning: null,
          partOfSpeech: 'verb',
          conjugationType: 'Ichidan',
          confidence: 'low',
        }],
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('partOfSpeech ↔ conjugationType consistency (lenient schema)', () => {
  const make = (pos: string, ct?: string | null) => {
    const obj: any = {
      surface: 'test',
      lemma: 'test',
      reading: 'てすと',
      partOfSpeech: pos,
      confidence: 'high',
    };
    if (ct !== undefined) obj.conjugationType = ct;
    return obj;
  };

  it('accepts verb + Godan', () => {
    expect(DrillWordResolverResultLenientSchema.safeParse(make('verb', 'Godan')).success).toBe(true);
  });

  it('rejects verb + missing conjugationType (undefined)', () => {
    // undefined is treated as null by the refinement
    expect(DrillWordResolverResultLenientSchema.safeParse(make('verb')).success).toBe(false);
  });

  it('rejects verb + null conjugationType', () => {
    expect(DrillWordResolverResultLenientSchema.safeParse(make('verb', null)).success).toBe(false);
  });

  it('accepts noun + missing conjugationType (undefined)', () => {
    expect(DrillWordResolverResultLenientSchema.safeParse(make('noun')).success).toBe(true);
  });

  it('accepts noun + null conjugationType', () => {
    expect(DrillWordResolverResultLenientSchema.safeParse(make('noun', null)).success).toBe(true);
  });

  it('rejects noun + Ichidan', () => {
    expect(DrillWordResolverResultLenientSchema.safeParse(make('noun', 'Ichidan')).success).toBe(false);
  });

  it('rejects i-adjective + Godan', () => {
    expect(DrillWordResolverResultLenientSchema.safeParse(make('i-adjective', 'Godan')).success).toBe(false);
  });

  it('accepts i-adjective + i-adjective', () => {
    expect(DrillWordResolverResultLenientSchema.safeParse(make('i-adjective', 'i-adjective')).success).toBe(true);
  });
});

// ============================================
// Enum Schema Tests
// ============================================

describe('DrillWordResolverConfidenceSchema', () => {
  it.each(['high', 'medium', 'low'])('accepts "%s"', (value) => {
    expect(DrillWordResolverConfidenceSchema.safeParse(value).success).toBe(true);
  });

  it.each(['very_high', 'uncertain', ''])('rejects "%s"', (value) => {
    expect(DrillWordResolverConfidenceSchema.safeParse(value).success).toBe(false);
  });
});

describe('DrillWordResolverConjugationTypeSchema', () => {
  it.each(['Ichidan', 'Godan', 'Irregular', 'i-adjective', 'na-adjective'])(
    'accepts "%s"',
    (value) => {
      expect(DrillWordResolverConjugationTypeSchema.safeParse(value).success).toBe(true);
    }
  );

  it.each(['ru-verb', 'u-verb', 'adjective', 'Verb'])('rejects "%s"', (value) => {
    expect(DrillWordResolverConjugationTypeSchema.safeParse(value).success).toBe(false);
  });
});

describe('DrillWordResolverPartOfSpeechSchema', () => {
  it.each(['verb', 'i-adjective', 'na-adjective', 'noun', 'adverb', 'particle', 'other'])(
    'accepts "%s"',
    (value) => {
      expect(DrillWordResolverPartOfSpeechSchema.safeParse(value).success).toBe(true);
    }
  );

  it.each(['pronoun', 'conjunction', 'Verb'])('rejects "%s"', (value) => {
    expect(DrillWordResolverPartOfSpeechSchema.safeParse(value).success).toBe(false);
  });
});
