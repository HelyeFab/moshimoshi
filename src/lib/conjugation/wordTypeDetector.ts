/**
 * Advanced Word Type Detection System
 * Accurately classifies Japanese words for conjugation compatibility
 * Handles JMdict, WaniKani, and other dictionary formats
 */

import { WordType } from '@/types/vocabulary'

export type VerbType = 'Ichidan' | 'Godan' | 'Irregular'
export type AdjectiveType = 'i-adjective' | 'na-adjective'
export type ConjugatableType = VerbType | AdjectiveType

/**
 * Extended word type that includes specific verb classifications
 */
export interface ExtendedWordType {
  baseType: WordType
  conjugationType?: ConjugatableType
  isConjugatable: boolean
  confidence: 'high' | 'medium' | 'low'
  details?: {
    verbEnding?: string
    isCompound?: boolean
    isSuruVerb?: boolean
    isKuruVerb?: boolean
    isIrregular?: boolean
  }
}

/**
 * JMDict part-of-speech codes to verb type mapping
 * Based on JMdict XML entity definitions
 */
const JMDICT_VERB_MAPPINGS: Record<string, VerbType> = {
  // Ichidan verbs
  'v1': 'Ichidan',
  'v1-s': 'Ichidan', // Ichidan verb - kureru special class

  // Godan verbs with specific endings
  'v5u': 'Godan',    // Godan verb with u ending
  'v5u-s': 'Godan',  // Godan verb with u ending (special class)
  'v5k': 'Godan',    // Godan verb with ku ending
  'v5k-s': 'Godan',  // Godan verb with ku ending - iku/yuku special
  'v5g': 'Godan',    // Godan verb with gu ending
  'v5s': 'Godan',    // Godan verb with su ending
  'v5t': 'Godan',    // Godan verb with tsu ending
  'v5n': 'Godan',    // Godan verb with nu ending
  'v5b': 'Godan',    // Godan verb with bu ending
  'v5m': 'Godan',    // Godan verb with mu ending
  'v5r': 'Godan',    // Godan verb with ru ending
  'v5r-i': 'Godan',  // Godan verb with ru ending (irregular verb)
  'v5aru': 'Godan',  // Godan verb - -aru special class

  // Irregular verbs
  'vs-i': 'Irregular',  // suru verb - included
  'vs-s': 'Irregular',  // suru verb - special class
  'vs': 'Irregular',    // Noun or participle taking suru
  'vk': 'Irregular',    // Kuru verb - special class
  'vz': 'Irregular',    // Ichidan verb - zuru verb (considered irregular)
}

/**
 * Verb ending patterns for detection when POS tags are incomplete
 */
const VERB_ENDING_PATTERNS = {
  // Godan verb endings
  godan: {
    'う': { type: 'Godan', confidence: 'high' },
    'く': { type: 'Godan', confidence: 'high' },
    'ぐ': { type: 'Godan', confidence: 'high' },
    'す': { type: 'Godan', confidence: 'high' },
    'つ': { type: 'Godan', confidence: 'high' },
    'ぬ': { type: 'Godan', confidence: 'high' },
    'ぶ': { type: 'Godan', confidence: 'high' },
    'む': { type: 'Godan', confidence: 'high' },
    'る': { type: 'Godan', confidence: 'low' }, // Could be Ichidan
  },

  // Ichidan patterns (need to check the character before る)
  ichidan: [
    // Common Ichidan verb endings (e-ru, i-ru)
    'える', 'いる', 'きる', 'ける', 'げる', 'じる', 'ちる',
    'にる', 'ねる', 'べる', 'める', 'れる', 'せる', 'てる',
    'でる', 'ぺる', 'へる'
  ],

  // Known Godan verbs ending in る (exceptions to Ichidan pattern)
  godanRuExceptions: [
    '帰る', 'かえる',     // to return
    '切る', 'きる',       // to cut
    '知る', 'しる',       // to know
    '入る', 'はいる',     // to enter
    '走る', 'はしる',     // to run
    '減る', 'へる',       // to decrease
    '要る', 'いる',       // to need
    '限る', 'かぎる',     // to limit
    '握る', 'にぎる',     // to grip
    '練る', 'ねる',       // to knead
    '参る', 'まいる',     // to go (humble)
    '滑る', 'すべる',     // to slide
    '喋る', 'しゃべる',   // to chat
    '蹴る', 'ける',       // to kick
    '捻る', 'ひねる',     // to twist
  ],

  // Irregular verbs
  irregular: {
    'する': 'Irregular',
    'くる': 'Irregular',
    '来る': 'Irregular',
    '為る': 'Irregular',
  }
}

/**
 * Main word type detection function
 */
export function detectWordType(
  word: string,
  reading?: string,
  partsOfSpeech?: string[]
): ExtendedWordType {
  // First check parts of speech if available
  if (partsOfSpeech && partsOfSpeech.length > 0) {
    const posResult = detectFromPartsOfSpeech(partsOfSpeech, word)
    if (posResult.confidence === 'high') {
      return posResult
    }
    // If medium/low confidence, continue to pattern matching
  }

  // Fallback to pattern matching
  return detectFromPattern(word, reading)
}

/**
 * Detect word type from parts of speech tags
 */
function detectFromPartsOfSpeech(
  partsOfSpeech: string[],
  word?: string
): ExtendedWordType {
  const posStr = partsOfSpeech.join(' ').toLowerCase()

  // Check for specific JMDict codes first (highest confidence)
  for (const pos of partsOfSpeech) {
    if (JMDICT_VERB_MAPPINGS[pos]) {
      const verbType = JMDICT_VERB_MAPPINGS[pos]
      return {
        baseType: verbType as WordType,
        conjugationType: verbType,
        isConjugatable: true,
        confidence: 'high',
        details: {
          verbEnding: word ? word.slice(-1) : undefined,
          isIrregular: verbType === 'Irregular',
          isSuruVerb: pos.includes('vs'),
          isKuruVerb: pos === 'vk'
        }
      }
    }
  }

  // Check for adjectives with JMDict codes
  if (partsOfSpeech.includes('adj-i')) {
    return {
      baseType: 'i-adjective',
      conjugationType: 'i-adjective',
      isConjugatable: true,
      confidence: 'high'
    }
  }

  if (partsOfSpeech.includes('adj-na')) {
    return {
      baseType: 'na-adjective',
      conjugationType: 'na-adjective',
      isConjugatable: true,
      confidence: 'high'
    }
  }

  // Fallback to text-based detection (medium confidence)
  // Check for する verbs
  if ((posStr.includes('suru') || posStr.includes('する')) ||
      (word && word.endsWith('する'))) {
    return {
      baseType: 'Irregular',
      conjugationType: 'Irregular',
      isConjugatable: true,
      confidence: 'medium',
      details: {
        isSuruVerb: true,
        isIrregular: true
      }
    }
  }

  // Check for 来る verb
  if (posStr.includes('kuru') || word === '来る' || word === 'くる') {
    return {
      baseType: 'Irregular',
      conjugationType: 'Irregular',
      isConjugatable: true,
      confidence: 'high',
      details: {
        isKuruVerb: true,
        isIrregular: true
      }
    }
  }

  // Text-based verb type detection
  if (posStr.includes('ichidan') || posStr.includes('ru verb') ||
      posStr.includes('る verb') || posStr.includes('v1')) {
    return {
      baseType: 'Ichidan',
      conjugationType: 'Ichidan',
      isConjugatable: true,
      confidence: 'medium'
    }
  }

  if (posStr.includes('godan') || posStr.includes('u verb') ||
      posStr.includes('う verb') || posStr.includes('v5')) {
    return {
      baseType: 'Godan',
      conjugationType: 'Godan',
      isConjugatable: true,
      confidence: 'medium'
    }
  }

  // Check for i-adjectives (text-based)
  if (posStr.includes('i-adj') || posStr.includes('i adj') ||
      posStr.includes('い adjective')) {
    return {
      baseType: 'i-adjective',
      conjugationType: 'i-adjective',
      isConjugatable: true,
      confidence: 'medium'
    }
  }

  // Check for na-adjectives (text-based)
  if (posStr.includes('na-adj') || posStr.includes('na adj') ||
      posStr.includes('な adjective')) {
    return {
      baseType: 'na-adjective',
      conjugationType: 'na-adjective',
      isConjugatable: true,
      confidence: 'medium'
    }
  }

  // Check for generic verb
  if (posStr.includes('verb') || posStr.includes('v')) {
    // Try to determine specific type from word pattern
    if (word) {
      return detectFromPattern(word)
    }
    return {
      baseType: 'verb',
      isConjugatable: false, // Can't conjugate without knowing specific type
      confidence: 'low'
    }
  }

  // Non-conjugatable types
  if (posStr.includes('noun') || posStr.includes('n')) {
    return {
      baseType: 'noun',
      isConjugatable: false,
      confidence: 'high'
    }
  }

  if (posStr.includes('adv') || posStr.includes('adverb')) {
    return {
      baseType: 'adverb',
      isConjugatable: false,
      confidence: 'high'
    }
  }

  if (posStr.includes('particle')) {
    return {
      baseType: 'particle',
      isConjugatable: false,
      confidence: 'high'
    }
  }

  return {
    baseType: 'other',
    isConjugatable: false,
    confidence: 'low'
  }
}

/**
 * Detect verb type from word pattern
 */
function detectFromPattern(word: string, reading?: string): ExtendedWordType {
  const checkWord = reading || word

  // Check for irregular verbs first
  if (VERB_ENDING_PATTERNS.irregular[checkWord]) {
    return {
      baseType: 'Irregular',
      conjugationType: 'Irregular',
      isConjugatable: true,
      confidence: 'high',
      details: {
        isIrregular: true,
        isSuruVerb: checkWord.endsWith('する'),
        isKuruVerb: checkWord === 'くる' || checkWord === '来る'
      }
    }
  }

  // Check for する compound verbs
  if (checkWord.endsWith('する')) {
    return {
      baseType: 'Irregular',
      conjugationType: 'Irregular',
      isConjugatable: true,
      confidence: 'high',
      details: {
        isCompound: true,
        isSuruVerb: true,
        isIrregular: true
      }
    }
  }

  // Check for i-adjectives
  if (checkWord.endsWith('い') && !checkWord.endsWith('ない')) {
    // Common i-adjective endings
    const commonEndings = ['しい', 'たい', 'ない', 'らしい', 'すい', 'よい']
    const hasCommonEnding = commonEndings.some(ending => checkWord.endsWith(ending))

    return {
      baseType: 'i-adjective',
      conjugationType: 'i-adjective',
      isConjugatable: true,
      confidence: hasCommonEnding ? 'high' : 'medium'
    }
  }

  // Check if it's a verb ending in る
  if (checkWord.endsWith('る')) {
    // Check against known Godan exceptions
    if (VERB_ENDING_PATTERNS.godanRuExceptions.includes(checkWord)) {
      return {
        baseType: 'Godan',
        conjugationType: 'Godan',
        isConjugatable: true,
        confidence: 'high',
        details: {
          verbEnding: 'る'
        }
      }
    }

    // Check for Ichidan patterns
    const beforeRu = checkWord.slice(-2)
    if (VERB_ENDING_PATTERNS.ichidan.includes(beforeRu)) {
      return {
        baseType: 'Ichidan',
        conjugationType: 'Ichidan',
        isConjugatable: true,
        confidence: 'high',
        details: {
          verbEnding: 'る'
        }
      }
    }

    // Special case: 行く (iku)
    if (word === '行く' || reading === 'いく') {
      return {
        baseType: 'Godan',
        conjugationType: 'Godan',
        isConjugatable: true,
        confidence: 'high',
        details: {
          verbEnding: 'く',
          isIrregular: false // It's Godan but with special te-form
        }
      }
    }

    // Default る verbs to Ichidan (more common)
    return {
      baseType: 'Ichidan',
      conjugationType: 'Ichidan',
      isConjugatable: true,
      confidence: 'low',
      details: {
        verbEnding: 'る'
      }
    }
  }

  // Check for other Godan endings
  const lastChar = checkWord.slice(-1)
  const godanEnding = VERB_ENDING_PATTERNS.godan[lastChar]

  if (godanEnding && lastChar !== 'る') {
    return {
      baseType: 'Godan',
      conjugationType: 'Godan',
      isConjugatable: true,
      confidence: godanEnding.confidence as 'high' | 'medium' | 'low',
      details: {
        verbEnding: lastChar
      }
    }
  }

  // Default to non-conjugatable
  return {
    baseType: 'other',
    isConjugatable: false,
    confidence: 'low'
  }
}

/**
 * Enhanced detection with context clues
 */
export function detectWordTypeWithContext(
  word: string,
  reading?: string,
  partsOfSpeech?: string[],
  meaning?: string
): ExtendedWordType {
  // Get base detection
  let result = detectWordType(word, reading, partsOfSpeech)

  // Use meaning as additional context for low confidence results
  if (result.confidence === 'low' && meaning) {
    const lowerMeaning = meaning.toLowerCase()

    // Check if meaning suggests it's a verb
    if (lowerMeaning.startsWith('to ')) {
      // Try to refine verb type
      if (word.endsWith('る')) {
        // Use statistical likelihood: Ichidan is more common for る verbs
        result = {
          ...result,
          baseType: 'Ichidan',
          conjugationType: 'Ichidan',
          isConjugatable: true,
          confidence: 'medium'
        }
      }
    }
  }

  return result
}

/**
 * Batch detection for multiple words
 */
export function detectWordTypes(
  words: Array<{
    word: string
    reading?: string
    partsOfSpeech?: string[]
    meaning?: string
  }>
): ExtendedWordType[] {
  return words.map(w =>
    detectWordTypeWithContext(w.word, w.reading, w.partsOfSpeech, w.meaning)
  )
}

/**
 * Check if a word type is conjugatable
 */
export function isConjugatableType(type: WordType | string): boolean {
  const conjugatableTypes = ['Ichidan', 'Godan', 'Irregular', 'i-adjective', 'na-adjective']
  return conjugatableTypes.includes(type)
}

/**
 * Get conjugation type from base word type
 */
export function getConjugationType(type: WordType | string): ConjugatableType | null {
  if (type === 'Ichidan' || type === 'Godan' || type === 'Irregular') {
    return type as VerbType
  }
  if (type === 'i-adjective' || type === 'na-adjective') {
    return type as AdjectiveType
  }
  return null
}