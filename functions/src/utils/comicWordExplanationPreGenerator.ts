/**
 * Word Explanation Pre-Generator for Comic Episodes
 * Pre-generates comprehensive word explanations for comic vocabulary
 * Stores in Firestore for instant retrieval by frontend
 *
 * Follows the same pattern as news articles (wordExplanationPreGenerator.ts)
 * Uses Qwen 2.5 32B via Modal Ollama endpoint for cost-effective AI processing
 */

import * as admin from 'firebase-admin'
import * as logger from 'firebase-functions/logger'
import { defineSecret } from 'firebase-functions/params'
import { extractTopWords, ExtractedWord } from './wordExtractor'
import crypto from 'crypto'

// Initialize Firestore
const db = admin.firestore()

// Define Modal API key for Qwen 2.5 access
const MODAL_API_KEY = defineSecret('MODAL_API_KEY')

/**
 * Get API key - supports both Cloud Functions and local environments
 */
function getModalApiKey(): string {
  try {
    // In Cloud Functions runtime, use defineSecret
    const secretValue = MODAL_API_KEY.value()
    if (secretValue) return secretValue
  } catch (error) {
    // defineSecret not available or not configured
  }

  // Fall back to environment variable for local execution
  return process.env.MODAL_API_KEY || ''
}

// Qwen 2.5 configuration via Modal Ollama
const QWEN_CONFIG = {
  baseUrl: 'https://emmanuelfabiani23--ollama-llm-ollamallm-serve.modal.run',
  model: 'qwen2.5:32b',
  timeout: 300000, // 5 minutes for 32B model
}

interface QwenChatResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

function hashWord(word: string): string {
  return crypto.createHash('sha256').update(word.trim().toLowerCase()).digest('hex')
}

async function getGlobalCache(
  words: ExtractedWord[]
): Promise<Map<string, WordExplanation>> {
  const cache = new Map<string, WordExplanation>()
  if (words.length === 0) return cache

  const docRefs = words.map(word =>
    db.collection('wordExplanationCache').doc(hashWord(word.word))
  )
  const docs = await db.getAll(...docRefs)

  docs.forEach((doc, idx) => {
    if (!doc.exists) return
    const data = doc.data() as { explanation?: WordExplanation }
    if (data?.explanation) {
      cache.set(words[idx].word.trim().toLowerCase(), data.explanation)
    }
  })

  return cache
}

export interface WordExplanation {
  word: string
  reading: string
  romaji: string
  meaning: string
  partOfSpeech: string
  kanjiBreakdown?: Array<{
    kanji: string
    meaning: string
    kunYomi: string[]
    onYomi: string[]
  }>
  conjugation?: {
    dictionary: string
    present: string
    past: string
    negative: string
    teForm: string
  }
  relatedWords: {
    synonyms: string[]
    antonyms: string[]
    compounds: string[]
  }
  jlptLevel?: string
  formality: string
  usageNotes?: string
  examples: Array<{
    japanese: string
    furigana: string
    translation: string
    notes?: string
  }>
}

export interface ComicWordExplanations {
  episodeId: string
  words: WordExplanation[]
  wordCount: number
  generatedAt: admin.firestore.Timestamp
  costInfo: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    estimatedCost: number
  }
}

/**
 * Call Qwen 2.5 via Modal Ollama endpoint
 */
async function callQwen(
  systemPrompt: string,
  userPrompt: string
): Promise<{
  content: string
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
}> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), QWEN_CONFIG.timeout)

  try {
    const response = await fetch(`${QWEN_CONFIG.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': getModalApiKey(),
      },
      body: JSON.stringify({
        model: QWEN_CONFIG.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Qwen API error: ${response.status} - ${errorText}`)
    }

    const data = (await response.json()) as QwenChatResponse
    const content = data.choices[0]?.message?.content || '{}'

    return {
      content,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Qwen API timeout after 5 minutes')
    }
    throw error
  }
}

/**
 * Generate comprehensive explanation for a single word
 */
async function generateWordExplanation(
  word: ExtractedWord,
  context?: string
): Promise<{ explanation: WordExplanation; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
  const systemPrompt = `You are a Japanese language expert helping learners understand vocabulary from comic episodes.

Generate a comprehensive explanation for the given Japanese word in JSON format with this EXACT structure:

{
  "word": "The word in original form (kanji/hiragana/katakana)",
  "reading": "Hiragana reading",
  "romaji": "Romanized pronunciation",
  "meaning": "Clear English definition",
  "partOfSpeech": "noun/verb/adjective/particle/etc.",
  "kanjiBreakdown": [
    {
      "kanji": "Single kanji character",
      "meaning": "Kanji meaning",
      "kunYomi": ["kun readings"],
      "onYomi": ["on readings"]
    }
  ],
  "conjugation": {
    "dictionary": "Dictionary form",
    "present": "Present form",
    "past": "Past form",
    "negative": "Negative form",
    "teForm": "Te-form"
  },
  "relatedWords": {
    "synonyms": ["Similar words"],
    "antonyms": ["Opposite words"],
    "compounds": ["Compound words"]
  },
  "jlptLevel": "N5/N4/N3/N2/N1",
  "formality": "casual/formal/neutral/both",
  "usageNotes": "When and how to use this word",
  "examples": [
    {
      "japanese": "Example sentence",
      "furigana": "With furigana",
      "translation": "English translation",
      "notes": "Context note"
    }
  ]
}

IMPORTANT:
- Always include kanjiBreakdown if the word contains any kanji
- Always include conjugation for verbs and adjectives
- Include at least 2-3 examples
- Make explanations appropriate for N5-N3 learners`

  const userPrompt = `Provide a comprehensive explanation for this Japanese word from a comic episode:

"${word.word}"

${context ? `Context where this word appears:\n"${context}"\n\n` : ''}
${word.estimatedJLPT ? `Estimated JLPT Level: ${word.estimatedJLPT}\n` : ''}
Word frequency in episode: ${word.frequency}

Return a valid JSON object as specified.`

  try {
    const { content, usage } = await callQwen(systemPrompt, userPrompt)
    const parsed = JSON.parse(content)

    // Ensure required fields
    const explanation: WordExplanation = {
      word: parsed.word || word.word,
      reading: parsed.reading || '',
      romaji: parsed.romaji || '',
      meaning: parsed.meaning || '',
      partOfSpeech: parsed.partOfSpeech || 'unknown',
      surfaceForms: word.surfaceForms,
      kanjiBreakdown: parsed.kanjiBreakdown || [],
      conjugation: parsed.conjugation,
      relatedWords: parsed.relatedWords || { synonyms: [], antonyms: [], compounds: [] },
      jlptLevel: parsed.jlptLevel || word.estimatedJLPT,
      formality: parsed.formality || 'neutral',
      usageNotes: parsed.usageNotes,
      examples: parsed.examples || [],
    }

    return { explanation, usage }
  } catch (error) {
    logger.error('[ComicWordPreGen] Error generating explanation with Qwen', {
      word: word.word,
      model: QWEN_CONFIG.model,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    throw error
  }
}

/**
 * Generate explanations for multiple words
 */
async function generateWordExplanations(
  words: ExtractedWord[],
  comicContext?: string
): Promise<{ explanations: WordExplanation[]; totalCost: number; totalTokens: number }> {
  const startTime = Date.now()

  logger.info('[ComicWordPreGen] Starting word explanation generation', {
    wordCount: words.length,
  })

  const explanations: WordExplanation[] = []
  const cacheMap = await getGlobalCache(words)
  let totalPromptTokens = 0
  let totalCompletionTokens = 0
  let totalTokens = 0

  for (const word of words) {
    try {
      const cached = cacheMap.get(word.word.trim().toLowerCase())
      if (cached) {
        if (!cached.surfaceForms && word.surfaceForms) {
          cached.surfaceForms = word.surfaceForms
        }
        explanations.push(cached)
        logger.debug('[ComicWordPreGen] Cache hit', {
          word: word.word,
        })
        continue
      }

      const { explanation, usage } = await generateWordExplanation(word, comicContext)

      explanations.push(explanation)

      totalPromptTokens += usage.promptTokens
      totalCompletionTokens += usage.completionTokens
      totalTokens += usage.totalTokens

      logger.debug('[ComicWordPreGen] Word explanation generated', {
        word: word.word,
        meaning: explanation.meaning,
        tokensUsed: usage.totalTokens,
      })
    } catch (error) {
      logger.error('[ComicWordPreGen] Failed to generate explanation for word', {
        word: word.word,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      // Continue with next word
    }
  }

  // Qwen 2.5 via Modal Ollama is self-hosted = $0 cost
  // Keeping token tracking for monitoring purposes
  const totalCost = 0

  const duration = Date.now() - startTime

  logger.info('[ComicWordPreGen] Word explanation generation completed', {
    wordsRequested: words.length,
    wordsGenerated: explanations.length,
    durationMs: duration,
    tokensUsed: totalTokens,
    estimatedCost: totalCost.toFixed(4),
    avgTimePerWord: Math.round(duration / words.length),
  })

  return {
    explanations,
    totalCost,
    totalTokens,
  }
}

/**
 * Recursively remove undefined values from an object (Firestore doesn't accept undefined)
 */
function removeUndefinedValues<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedValues(item)) as T
  }

  if (typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefinedValues(value)
      }
    }
    return cleaned as T
  }

  return obj
}

/**
 * Generate and store word explanations for a comic episode
 */
export async function generateComicWordExplanations(
  episodeId: string,
  comicText: string,
  topWordCount: number = 100
): Promise<ComicWordExplanations> {
  const startTime = Date.now()

  logger.info('[ComicWordPreGen] Starting comic word explanations', {
    episodeId,
    textLength: comicText.length,
    topWordCount,
  })

  try {
    // Extract top words from comic text using Kuromoji
    const { words } = await extractTopWords(comicText, topWordCount)

    logger.info('[ComicWordPreGen] Words extracted', {
      episodeId,
      wordCount: words.length,
    })

    // Generate explanations for all words
    const { explanations, totalCost, totalTokens } = await generateWordExplanations(
      words,
      comicText.substring(0, 500) // Use first 500 chars as context
    )

    // Calculate token breakdown (rough estimate)
    const promptTokens = Math.floor(totalTokens * 0.4)
    const completionTokens = totalTokens - promptTokens

    const comicExplanations: ComicWordExplanations = {
      episodeId,
      words: explanations,
      wordCount: explanations.length,
      generatedAt: admin.firestore.Timestamp.now(),
      costInfo: {
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCost: totalCost,
      },
    }

    // Store in Firestore (comic_word_explanations collection)
    const docRef = db.collection('comic_word_explanations').doc(episodeId)

    // Clean undefined values before storing
    const cleanedExplanations = removeUndefinedValues(comicExplanations)

    await docRef.set({
      ...cleanedExplanations,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    })

    logger.info('[ComicWordPreGen] Word explanations stored', {
      episodeId,
      wordCount: explanations.length,
      collection: 'comic_word_explanations',
    })

    const duration = Date.now() - startTime

    logger.info('[ComicWordPreGen] Comic word explanations completed', {
      episodeId,
      wordCount: explanations.length,
      durationMs: duration,
      estimatedCost: totalCost.toFixed(4),
    })

    return comicExplanations
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('[ComicWordPreGen] Comic word explanations failed', {
      episodeId,
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: duration,
    })

    throw error
  }
}
