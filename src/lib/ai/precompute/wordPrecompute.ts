import path from 'path'
import kuromoji from 'kuromoji'
import { AIService } from '../AIService'
import type { WordExplanation, JLPTLevel } from '../types'
import { adminFirestore as db, Timestamp } from '@/lib/firebase/admin'
import { getCachedWordExplanation, setCachedWordExplanation } from '../cache/WordExplanationCache'
import { ExtendedConjugationEngine } from '@/lib/conjugation/engine'
import { enhanceWordWithType } from '@/utils/enhancedWordTypeDetection'

type ContentType = 'article' | 'book' | 'story' | 'video'

const COLLECTION_MAP: Record<ContentType, string> = {
  article: 'news_article_word_explanations',
  book: 'book_word_explanations',
  story: 'story_word_explanations',
  video: 'video_word_explanations',
}

// Build kuromoji tokenizer once (server-side only)
let tokenizerPromise: Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>> | null = null

async function getTokenizer() {
  if (!tokenizerPromise) {
    tokenizerPromise = new Promise((resolve, reject) => {
      kuromoji
        .builder({ dicPath: path.join(process.cwd(), 'node_modules/kuromoji/dict') })
        .build((err, tokenizer) => {
          if (err || !tokenizer) {
            reject(err || new Error('Failed to build kuromoji tokenizer'))
            return
          }
          resolve(tokenizer)
        })
    })
  }
  return tokenizerPromise
}

/**
 * Generate full conjugations for a word if it's a verb or adjective.
 * Uses the ExtendedConjugationEngine for accurate 100+ form generation.
 */
async function generateFullConjugations(
  explanation: WordExplanation
): Promise<WordExplanation['fullConjugations'] | undefined> {
  const pos = explanation.partOfSpeech?.toLowerCase() || ''

  // Check if word is conjugatable (verb or adjective)
  const isConjugatable = pos.match(
    /verb|ichidan|godan|suru|する|adjective|形容詞|形容動詞|adj/
  )

  if (!isConjugatable) {
    return undefined
  }

  try {
    // Convert to JapaneseWord format for the engine
    const baseWord = {
      id: `precompute-${explanation.word}`,
      kanji: explanation.word,
      kana: explanation.reading,
      romaji: explanation.romaji,
      meaning: explanation.meaning,
      type: undefined as string | undefined,
    }

    // Detect verb type from partOfSpeech
    if (pos.includes('ichidan') || pos.includes('ru-verb') || pos.includes('一段')) {
      baseWord.type = 'Ichidan'
    } else if (pos.includes('godan') || pos.includes('u-verb') || pos.includes('五段')) {
      baseWord.type = 'Godan'
    } else if (pos.includes('suru') || pos.includes('する') || pos.includes('irregular')) {
      baseWord.type = 'Irregular'
    } else if (pos.includes('i-adj') || pos.includes('い-adj') || pos.includes('形容詞')) {
      baseWord.type = 'i-adjective'
    } else if (pos.includes('na-adj') || pos.includes('な-adj') || pos.includes('形容動詞')) {
      baseWord.type = 'na-adjective'
    }

    // Use enhanceWordWithType for accurate type detection
    const enhancedWord = enhanceWordWithType(baseWord)

    if (!enhancedWord.isConjugatable) {
      return undefined
    }

    // Generate full conjugations
    const conjugations = await ExtendedConjugationEngine.conjugate(enhancedWord)

    // Check if we got valid conjugations
    if (!conjugations || !conjugations.present) {
      return undefined
    }

    // Convert to plain object (strip any class methods)
    const formsObject: Record<string, string> = {}
    for (const [key, value] of Object.entries(conjugations)) {
      if (typeof value === 'string' && value.trim() !== '') {
        formsObject[key] = value
      }
    }

    return {
      conjugationType: enhancedWord.conjugationType || enhancedWord.type || 'unknown',
      forms: formsObject,
    }
  } catch (error) {
    console.warn('[WordPrecompute] Failed to generate conjugations for:', explanation.word, error)
    return undefined
  }
}

// Basic tokenizer: extracts base forms of content words (nouns/verbs/adjectives)
export async function extractJapaneseWords(text: string): Promise<string[]> {
  const tokenizer = await getTokenizer()
  const tokens = tokenizer.tokenize(text || '')

  const words = tokens
    .map(token => token.basic_form || token.surface_form)
    .filter(Boolean)
    .filter(word => word.length > 1) // filter tiny tokens

  // Deduplicate while preserving order
  const seen = new Set<string>()
  const unique: string[] = []
  for (const word of words) {
    const key = word.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(word)
    }
  }
  return unique
}

interface PrecomputeRequest {
  contentId: string
  contentType: ContentType
  text: string
  limit?: number
  jlptLevel?: JLPTLevel
}

interface PrecomputeResult {
  contentId: string
  contentType: ContentType
  generated: number
  cached: number
  skipped: number
  total: number
}

/**
 * Precompute word explanations for a piece of content and persist to Firestore.
 * - Tokenizes text to unique words
 * - Reuses global cache when possible
 * - Generates missing words via AIService
 * - Stores merged results in per-content collection
 */
export async function precomputeWordExplanations({
  contentId,
  contentType,
  text,
  limit = 400,
  jlptLevel = 'N5',
}: PrecomputeRequest): Promise<PrecomputeResult> {
  if (!db) {
    throw new Error('Firebase Admin not initialized')
  }

  const collection = COLLECTION_MAP[contentType]
  if (!collection) {
    throw new Error(`Unsupported contentType: ${contentType}`)
  }

  // Extract words and apply limit, keeping original order
  const words = (await extractJapaneseWords(text)).slice(0, limit)

  const docRef = db.collection(collection).doc(contentId)
  const existingSnap = await docRef.get()
  const existingWords: WordExplanation[] = (existingSnap.data()?.words as WordExplanation[]) || []
  const existingSet = new Set(
    existingWords.map(w => w.word?.toLowerCase?.() || '').filter(Boolean)
  )

  const missingWords = words.filter(w => !existingSet.has(w.toLowerCase()))

  const aiService = AIService.getInstance()
  const generatedResults: WordExplanation[] = []
  let cachedCount = 0

  // Process in order with small concurrency so earliest tokens finish first
  const concurrency = 3
  let index = 0
  let conjugationsGenerated = 0

  while (index < missingWords.length) {
    const slice = missingWords.slice(index, index + concurrency)
    const results = await Promise.all(
      slice.map(async word => {
        const cached = await getCachedWordExplanation(word)
        if (cached) {
          cachedCount += 1
          // If cached but missing fullConjugations, generate them now
          if (!cached.fullConjugations) {
            const fullConjugations = await generateFullConjugations(cached)
            if (fullConjugations) {
              cached.fullConjugations = fullConjugations
              conjugationsGenerated += 1
              // Update cache with conjugations
              await setCachedWordExplanation(word, cached)
            }
          }
          return cached
        }

        const aiResponse = await aiService.explainWord({ word }, { jlptLevel })
        if (!aiResponse.success || !aiResponse.data) {
          throw new Error(aiResponse.error || `Failed to generate explanation for ${word}`)
        }

        const explanation = aiResponse.data

        // Generate full conjugations for verbs/adjectives
        const fullConjugations = await generateFullConjugations(explanation)
        if (fullConjugations) {
          explanation.fullConjugations = fullConjugations
          conjugationsGenerated += 1
        }

        await setCachedWordExplanation(word, explanation)
        return explanation
      })
    )
    generatedResults.push(...results)
    index += concurrency
  }

  console.log(`[WordPrecompute] Generated ${conjugationsGenerated} full conjugation tables`)

  const merged = [...existingWords, ...generatedResults]

  await docRef.set(
    {
      words: merged,
      wordCount: merged.length,
      updatedAt: Timestamp.now(),
      source: 'precompute',
    },
    { merge: true }
  )

  return {
    contentId,
    contentType,
    generated: generatedResults.length - cachedCount,
    cached: cachedCount,
    skipped: existingWords.length,
    total: merged.length,
  }
}
