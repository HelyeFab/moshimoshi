/**
 * Word Explanation Pre-Generator for Story Content
 * Pre-generates comprehensive word explanations for story vocabulary
 * Stores in Firestore for instant retrieval by frontend
 *
 * Follows the same pattern as news articles (wordExplanationPreGenerator.ts)
 * Uses Qwen 2.5 32B via Modal Ollama endpoint for cost-effective AI processing
 */

import * as admin from 'firebase-admin'
import * as logger from 'firebase-functions/logger'
import { defineSecret } from 'firebase-functions/params'
import { extractWords, ExtractedWord } from './wordExtractor'
import crypto from 'crypto'

// Initialize Firebase Admin if needed (scripts may not share app instance)
if (!admin.apps.length) {
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    })
  } else {
    admin.initializeApp()
  }
}

// Initialize Firestore
const db = admin.firestore()

// Define Modal API key for Qwen 2.5 access
const MODAL_API_KEY = defineSecret('MODAL_API_KEY')

/**
 * Get Modal API key with fallback for local execution
 * Supports both Cloud Functions runtime and local development
 */
function getModalApiKey(): string {
  // Prefer direct env var for local/script execution
  if (process.env.MODAL_API_KEY) {
    return process.env.MODAL_API_KEY
  }

  // Only access secrets when running inside Functions runtime/emulator
  const inFunctionsRuntime =
    !!process.env.FUNCTION_TARGET ||
    !!process.env.K_SERVICE ||
    process.env.FUNCTIONS_EMULATOR === 'true'

  if (inFunctionsRuntime) {
    try {
      const secretValue = MODAL_API_KEY.value()
      if (secretValue) return secretValue
    } catch (error) {
      // defineSecret not available or not configured
    }
  }

  return ''
}

// Qwen 2.5 configuration via Modal Ollama
const QWEN_CONFIG = {
  baseUrl:
    process.env.OLLAMA_BASE_URL ||
    'https://emmanuelfabiani23--ollama-llm-ollamallm-serve.modal.run',
  model: process.env.OLLAMA_MODEL || 'qwen2.5:32b',
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
  surfaceForms?: string[]
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

export interface StoryWordExplanations {
  storyId: string
  words: WordExplanation[]
  wordCount: number
  total: number // For compatibility with existing story scheduler code
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
    const apiKey = getModalApiKey()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiKey) {
      headers['X-API-Key'] = apiKey
    }

    const response = await fetch(`${QWEN_CONFIG.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers,
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
export async function generateWordExplanation(
  word: ExtractedWord,
  context?: string
): Promise<{ explanation: WordExplanation; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
  const systemPrompt = `You are a Japanese language expert helping learners understand vocabulary from stories.

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

  const userPrompt = `Provide a comprehensive explanation for this Japanese word from a story episode:

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
    logger.error('[StoryWordPreGen] Error generating explanation with Qwen', {
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
  storyContext?: string
): Promise<{ explanations: WordExplanation[]; totalCost: number; totalTokens: number }> {
  const startTime = Date.now()

  logger.info('[StoryWordPreGen] Starting word explanation generation', {
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
        logger.debug('[StoryWordPreGen] Cache hit', {
          word: word.word,
        })
        continue
      }

      const { explanation, usage } = await generateWordExplanation(word, storyContext)

      explanations.push(explanation)

      totalPromptTokens += usage.promptTokens
      totalCompletionTokens += usage.completionTokens
      totalTokens += usage.totalTokens

      logger.debug('[StoryWordPreGen] Word explanation generated', {
        word: word.word,
        meaning: explanation.meaning,
        tokensUsed: usage.totalTokens,
      })
    } catch (error) {
      logger.error('[StoryWordPreGen] Failed to generate explanation for word', {
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

  logger.info('[StoryWordPreGen] Word explanation generation completed', {
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
 * Generate and store word explanations for a story episode
 */
export async function generateStoryWordExplanations(
  storyId: string,
  storyText: string,
  topWordCount?: number,
  options?: { includeParticles?: boolean; minLength?: number }
): Promise<StoryWordExplanations> {
  const startTime = Date.now()

  logger.info('[StoryWordPreGen] Starting story word explanations', {
    storyId,
    textLength: storyText.length,
    topWordCount: typeof topWordCount === 'number' ? topWordCount : 'all_filtered',
  })

  try {
    // Extract words from story text using Kuromoji
    const { words } = await extractWords(storyText, {
      ...(typeof topWordCount === 'number' ? { limit: topWordCount } : {}),
      ...(options || {}),
    })

    logger.info('[StoryWordPreGen] Words extracted', {
      storyId,
      wordCount: words.length,
    })

    // Generate explanations for all words
    const { explanations, totalCost, totalTokens } = await generateWordExplanations(
      words,
      storyText.substring(0, 500) // Use first 500 chars as context
    )

    // Calculate token breakdown (rough estimate)
    const promptTokens = Math.floor(totalTokens * 0.4)
    const completionTokens = totalTokens - promptTokens

    const storyExplanations: StoryWordExplanations = {
      storyId,
      words: explanations,
      wordCount: explanations.length,
      total: explanations.length, // For compatibility with existing story scheduler code
      generatedAt: admin.firestore.Timestamp.now(),
      costInfo: {
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCost: totalCost,
      },
    }

    // Store in Firestore (story_word_explanations collection)
    const docRef = db.collection('story_word_explanations').doc(storyId)

    // Clean undefined values before storing
    const cleanedExplanations = removeUndefinedValues(storyExplanations)

    await docRef.set({
      ...cleanedExplanations,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    })

    logger.info('[StoryWordPreGen] Word explanations stored', {
      storyId,
      wordCount: explanations.length,
      collection: 'story_word_explanations',
    })

    const duration = Date.now() - startTime

    logger.info('[StoryWordPreGen] Story word explanations completed', {
      storyId,
      wordCount: explanations.length,
      durationMs: duration,
      estimatedCost: totalCost.toFixed(4),
    })

    return storyExplanations
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('[StoryWordPreGen] Story word explanations failed', {
      storyId,
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: duration,
    })

    throw error
  }
}
