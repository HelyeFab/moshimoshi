import path from 'path'
import kuromoji from 'kuromoji'
import { AIService } from '../AIService'
import type { WordExplanation, JLPTLevel } from '../types'
import { getAdminDb, Timestamp } from '@/lib/firebase/admin'
import type { Firestore } from 'firebase-admin/firestore'
import { getCachedWordExplanation, setCachedWordExplanation } from '../cache/WordExplanationCache'
import { ExtendedConjugationEngine } from '@/lib/conjugation/engine'
import { enhanceWordWithType } from '@/utils/enhancedWordTypeDetection'
import { ttsService } from '@/lib/tts/service'

type ContentType = 'article' | 'book' | 'story' | 'youtube' | 'video' | 'comic'

const COLLECTION_MAP: Record<ContentType, string> = {
  article: 'news_article_word_explanations',
  book: 'book_word_explanations',
  story: 'story_word_explanations',
  youtube: 'youtube_word_explanations',
  video: 'video_word_explanations',
  comic: 'comic_word_explanations',
}

let ttsServiceInstance = ttsService
async function getTtsServiceSafe() {
  if (ttsServiceInstance && typeof ttsServiceInstance.synthesize === 'function') {
    return ttsServiceInstance
  }
  try {
    const mod = await import('@/lib/tts/service')
    ttsServiceInstance = mod.ttsService
    return ttsServiceInstance
  } catch (error) {
    console.warn('[WordPrecompute] TTS service import failed', error)
    return null
  }
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

function normalizeWord(value: string): string {
  let normalized = value.trim()
  try {
    normalized = normalized.normalize('NFKC')
  } catch {
    // ignore
  }
  return normalized.toLowerCase()
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

/**
 * Split text into rough sentences for context extraction
 */
function splitSentences(text: string): string[] {
  return (text || '')
    .split(/(?<=[。！？!?.\n])/)
    .map(s => s.trim())
    .filter(s => s.length > 3)
}

/**
 * Find the first sentence containing the word
 */
function findContextSentence(word: string, sentences: string[]): string | undefined {
  if (!word) return undefined
  return sentences.find(sentence => sentence.includes(word))
}

const MAX_CONTEXT_TRANSLATIONS = 40

// Remove undefined fields to satisfy Firestore
function sanitizeExplanation(explanation: WordExplanation): WordExplanation {
  const copy: any = { ...explanation }
  Object.keys(copy).forEach(key => {
    if (copy[key] === undefined) {
      delete copy[key]
    }
  })
  return copy as WordExplanation
}

/**
 * Enrich explanation with context translation and precomputed audio when possible
 */
async function ensureExtras(
  explanation: WordExplanation,
  word: string,
  sentences: string[],
  translationCache: Map<string, string>,
  jlptLevel: JLPTLevel
) {
  // Context sentence + translation
  if (!explanation.contextSentence) {
    explanation.contextSentence = findContextSentence(word, sentences)
  }

  if (explanation.contextSentence && !explanation.contextTranslation) {
    const cachedTranslation = translationCache.get(explanation.contextSentence)
    if (cachedTranslation) {
      explanation.contextTranslation = cachedTranslation
    } else if (translationCache.size < MAX_CONTEXT_TRANSLATIONS) {
      try {
        const aiService = AIService.getInstance()
        const result = await aiService.translateText(explanation.contextSentence, 'learning', {
          jlptLevel,
          cacheResults: true,
        } as any)
        if (result.success && result.data?.translatedText) {
          translationCache.set(explanation.contextSentence, result.data.translatedText)
          explanation.contextTranslation = result.data.translatedText
        }
      } catch (err) {
        console.warn('[WordPrecompute] Context translation failed', { word, err })
      }
    }
  }

  // Precompute audio for short words (skip if already present)
  if (!explanation.audioUrl && explanation.word && explanation.word.length <= 12) {
    try {
      const tts = await getTtsServiceSafe()
      if (!tts || typeof tts.synthesize !== 'function') {
        console.warn('[WordPrecompute] TTS service unavailable - skipping audio', { word })
        return
      }
      const audio = await tts.synthesize(explanation.word, {
        provider: 'voicevox',
        speed: 1.0,
      })
      if (audio?.audioUrl) {
        explanation.audioUrl = audio.audioUrl
      }
    } catch (err) {
      console.warn('[WordPrecompute] Audio synth failed', { word, err })
    }
  }
}

// Basic tokenizer: extracts base forms of words (optionally including particles and single-kanji)
export async function extractJapaneseWords(
  text: string,
  options: { includeParticles?: boolean; minLength?: number } = {}
): Promise<Array<{ word: string; surfaceForms: string[] }>> {
  const tokenizer = await getTokenizer()
  const tokens = tokenizer.tokenize(text || '')

  const minLength =
    typeof options.minLength === 'number'
      ? options.minLength
      : options.includeParticles
        ? 1
        : 2
  const isJapaneseToken = (word: string) =>
    /[\u3040-\u30ff\u4e00-\u9fff]/.test(word)

  // Deduplicate while preserving order + collect surface forms
  const seen = new Set<string>()
  const unique: Array<{ word: string; surfaceForms: string[] }> = []
  const surfaceMap = new Map<string, Set<string>>()

  for (const token of tokens) {
    const base = token.basic_form || token.surface_form
    const surface = token.surface_form || token.basic_form || base
    if (!base) continue
    if (!isJapaneseToken(base)) continue
    if (base.length < minLength) continue

    const key = normalizeWord(base)
    if (!surfaceMap.has(key)) surfaceMap.set(key, new Set())
    surfaceMap.get(key)!.add(base)
    if (surface) surfaceMap.get(key)!.add(surface)

    if (!seen.has(key)) {
      seen.add(key)
      unique.push({
        word: base,
        surfaceForms: Array.from(surfaceMap.get(key) || []),
      })
    }
  }

  // Ensure surfaceForms are up to date
  return unique.map(entry => ({
    word: entry.word,
    surfaceForms: Array.from(surfaceMap.get(normalizeWord(entry.word)) || []),
  }))
}

interface PrecomputeRequest {
  contentId: string
  contentType: ContentType
  text: string
  limit?: number
  jlptLevel?: JLPTLevel
  includeParticles?: boolean
  minLength?: number
  chunkIndex?: number
  onProgress?: (current: number, total: number, word: string, status: 'success' | 'failed') => void | Promise<void>
  db?: Firestore
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
  limit = 1000, // Increased from 400 to 1000 for better completeness
  jlptLevel = 'N5',
  includeParticles,
  minLength,
  chunkIndex,
  onProgress,
  db: dbOverride,
}: PrecomputeRequest): Promise<PrecomputeResult> {
  // Use provided db when available to avoid duplicate admin init
  const db = dbOverride || getAdminDb()

  const collection = COLLECTION_MAP[contentType]
  if (!collection) {
    throw new Error(`Unsupported contentType: ${contentType}`)
  }

  // Extract words and apply limit, keeping original order
  const words = (
    await extractJapaneseWords(text, { includeParticles, minLength })
  ).slice(0, limit)

  const docRef = db.collection(collection).doc(contentId)
  const existingSnap = await docRef.get()
  const existingWords: WordExplanation[] = (existingSnap.data()?.words as WordExplanation[]) || []
  const normalize = (v?: string) => (v ? normalizeWord(v) : '')
  const hasWord = (target: string) => {
    const normalized = normalize(target)
    if (!normalized) return false
    return existingWords.some(w => {
      const surfaceForms = (w as any).surfaceForms as string[] | undefined
      return (
        normalize(w.word) === normalized ||
        normalize(w.reading) === normalized ||
        (surfaceForms || []).some(sf => normalize(sf) === normalized)
      )
    })
  }

  const missingWords = words.filter(w => !hasWord(w.word))

  const aiService = AIService.getInstance()
  const generatedResults: WordExplanation[] = []
  let cachedCount = 0
  const sentences = splitSentences(text)
  const translationCache = new Map<string, string>()

  // Process in order with configurable concurrency
  // Default: 10 (optimal balance of speed and API limits)
  // Range: 3-20 (3=conservative, 10=recommended, 20=aggressive)
  const rawConcurrency = parseInt(process.env.WORD_PRECOMPUTE_CONCURRENCY || '10', 10)
  const concurrency = Math.max(3, Math.min(20, rawConcurrency)) // Clamp to safe range

  console.log(`[WordPrecompute] Using concurrency: ${concurrency} (env: ${process.env.WORD_PRECOMPUTE_CONCURRENCY || 'default'})`)

  let index = 0
  let conjugationsGenerated = 0

  while (index < missingWords.length) {
    const slice = missingWords.slice(index, index + concurrency)
    const results = await Promise.all(
      slice.map(async (wordObj, sliceIndex) => {
        const globalIndex = index + sliceIndex
        const word = wordObj.word
        try {
          const cached = await getCachedWordExplanation(word, db)
          if (cached) {
            cachedCount += 1
            if (!cached.surfaceForms && wordObj.surfaceForms) {
              cached.surfaceForms = wordObj.surfaceForms
              await setCachedWordExplanation(word, cached, db)
            }
            await ensureExtras(cached, word, sentences, translationCache, jlptLevel)
            // If cached but missing fullConjugations, generate them now
            if (!cached.fullConjugations) {
              const fullConjugations = await generateFullConjugations(cached)
              if (fullConjugations) {
                cached.fullConjugations = fullConjugations
                conjugationsGenerated += 1
                // Update cache with conjugations
                await setCachedWordExplanation(word, cached, db)
              }
            }

            // Call progress callback on success
            if (onProgress) {
              await onProgress(globalIndex + 1, missingWords.length, word, 'success')
            }

            return cached
          }

          const aiResponse = await aiService.explainWord({ word }, { jlptLevel })
          if (!aiResponse.success || !aiResponse.data) {
            throw new Error(aiResponse.error || `Failed to generate explanation for ${word}`)
          }

          const explanation = aiResponse.data
          if (!explanation.surfaceForms && wordObj.surfaceForms) {
            explanation.surfaceForms = wordObj.surfaceForms
          }

          // Generate full conjugations for verbs/adjectives
          const fullConjugations = await generateFullConjugations(explanation)
          if (fullConjugations) {
            explanation.fullConjugations = fullConjugations
            conjugationsGenerated += 1
          }

          await ensureExtras(explanation, word, sentences, translationCache, jlptLevel)

          await setCachedWordExplanation(word, explanation, db)

          // Call progress callback on success
          if (onProgress) {
            await onProgress(globalIndex + 1, missingWords.length, word, 'success')
          }

          return explanation
        } catch (error) {
          // Call progress callback on failure
          if (onProgress) {
            await onProgress(globalIndex + 1, missingWords.length, word, 'failed')
          }

          console.error(`[WordPrecompute] Failed to process word: ${word}`, error)
          return null  // Continue processing other words
        }
      })
    )
    generatedResults.push(...results.filter(r => r !== null) as WordExplanation[])
    index += concurrency
  }

  console.log(`[WordPrecompute] Generated ${conjugationsGenerated} full conjugation tables`)

  const merged = [...existingWords, ...generatedResults].map(sanitizeExplanation)

  // Firestore document size limit is 1MB
  // Estimated size: ~500 bytes per word explanation
  // 1000 words ≈ 500KB, well within limit
  if (merged.length > 1000) {
    console.warn(
      `[WordPrecompute] Large word count detected (${merged.length}). ` +
      `May approach Firestore 1MB document limit. Consider implementing sharding.`
    )
  }

  await docRef.set(
    {
      words: merged,
      wordCount: merged.length,
      updatedAt: Timestamp.now(),
      source: 'precompute',
      ...(typeof chunkIndex === 'number' ? { chunkIndex } : {}),
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
