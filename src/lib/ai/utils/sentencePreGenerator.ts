/**
 * Sentence Pre-Generator for Books
 * Pre-generates audio and translations for individual sentences
 * Used during book generation for instant playback/translation
 */

import { db } from '@/lib/firebase/admin'
import { getStorage } from 'firebase-admin/storage'
import crypto from 'crypto'

// ============================================
// Types
// ============================================

export interface GrammarNote {
  pattern: string
  explanation: string
  example?: string
}

export interface KeyVocabulary {
  word: string
  reading: string
  meaning: string
  jlptLevel?: string
  partOfSpeech?: string
}

export interface SentenceTranslation {
  originalText: string
  translatedText: string
  grammarNotes: GrammarNote[]
  keyVocabulary: KeyVocabulary[]
  confidence: number
}

export interface SentenceData {
  index: number
  text: string
  audioUrl: string
  translation: SentenceTranslation
}

// ============================================
// Sentence Splitting
// ============================================

/**
 * Split Japanese text into sentences by 。
 */
export function splitIntoSentences(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return []
  }

  const parts = text.split(/(。)/)
  const sentences: string[] = []
  let current = ''

  for (const part of parts) {
    if (!part) continue

    if (part === '。') {
      current += part
      if (current.trim()) {
        sentences.push(current.trim())
        current = ''
      }
    } else {
      current += part
    }
  }

  if (current.trim()) {
    sentences.push(current.trim())
  }

  return sentences
}

// ============================================
// Audio Generation
// ============================================

/**
 * Generate TTS audio for a sentence using the synthesize API
 */
async function generateSentenceAudio(
  sentence: string,
  contentId: string,
  sentenceIndex: number,
  contentType: 'book' | 'news_article' | 'story',
  baseUrl: string
): Promise<string> {
  const sentenceHash = crypto
    .createHash('md5')
    .update(`${contentId}-${sentenceIndex}-${sentence}`)
    .digest('hex')

  const storagePath = `sentence-audio/${contentType}/${contentId}/${sentenceHash}.mp3`

  // Check if already exists in storage
  try {
    const storage = getStorage()
    const bucket = storage.bucket()
    const file = bucket.file(storagePath)
    const [exists] = await file.exists()

    if (exists) {
      console.log(`[SentencePreGen] Using cached audio for sentence ${sentenceIndex}`)
      return `https://storage.googleapis.com/${bucket.name}/${storagePath}`
    }
  } catch (error) {
    // If storage check fails, continue with generation
    console.warn('[SentencePreGen] Storage check failed, generating new audio')
  }

  // Generate audio via API
  console.log(`[SentencePreGen] Generating audio for sentence ${sentenceIndex}`)

  const response = await fetch(`${baseUrl}/api/tts/generate-sentence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: sentence,
      articleId: contentId,
      contentType,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`TTS API error (${response.status}): ${errorText}`)
  }

  const result = await response.json()
  return result.audioUrl || ''
}

// ============================================
// Translation Generation
// ============================================

/**
 * Generate translation with grammar notes for a sentence
 * Includes retry logic for transient failures
 */
async function generateSentenceTranslation(
  sentence: string,
  baseUrl: string,
  maxRetries: number = 3
): Promise<SentenceTranslation> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sentence,
          mode: 'learning',
          userLevel: 'N4',
          includeGrammarNotes: true,
          preserveGrammarStructure: true,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Translation API error (${response.status}): ${errorText}`)
      }

      const result = await response.json()

      if (result.success && result.data && result.data.translatedText) {
        return {
          originalText: sentence,
          translatedText: result.data.translatedText,
          grammarNotes: result.data.grammarNotes || [],
          keyVocabulary: result.data.keyVocabulary || [],
          confidence: result.data.confidence || 0.9,
        }
      }

      // If response is successful but no translation, treat as error for retry
      throw new Error('Translation API returned empty result')
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`[SentencePreGen] Translation attempt ${attempt}/${maxRetries} failed:`, lastError.message)

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  // All retries failed - throw to let caller handle
  console.error(`[SentencePreGen] Translation failed after ${maxRetries} attempts for: ${sentence.substring(0, 50)}...`)
  throw lastError || new Error('Translation failed after all retries')
}

// ============================================
// Main Pre-Generation Function
// ============================================

/**
 * Pre-generate audio and translations for all sentences in content
 */
export async function preGenerateSentences(
  contentId: string,
  content: string,
  contentType: 'book' | 'news_article' | 'story',
  baseUrl: string,
  progressCallback?: (current: number, total: number) => Promise<void>
): Promise<SentenceData[]> {
  console.log(`[SentencePreGen] Starting for ${contentType}: ${contentId}`)

  const sentences = splitIntoSentences(content)
  console.log(`[SentencePreGen] Found ${sentences.length} sentences`)

  const sentenceData: SentenceData[] = []

  for (let index = 0; index < sentences.length; index++) {
    const sentence = sentences[index]

    try {
      // Generate audio
      const audioUrl = await generateSentenceAudio(
        sentence,
        contentId,
        index,
        contentType,
        baseUrl
      )

      // Generate translation
      const translation = await generateSentenceTranslation(sentence, baseUrl)

      sentenceData.push({
        index,
        text: sentence,
        audioUrl,
        translation,
      })

      // Report progress
      if (progressCallback) {
        await progressCallback(index + 1, sentences.length)
      }

      console.log(`[SentencePreGen] Processed sentence ${index + 1}/${sentences.length}`)

      // Small delay to avoid rate limiting
      if (index < sentences.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error(`[SentencePreGen] FAILED sentence ${index} after retries:`, errorMsg)

      // Track failed sentences but continue processing
      // Mark with confidence: -1 to indicate failure (distinct from untranslated)
      sentenceData.push({
        index,
        text: sentence,
        audioUrl: '',
        translation: {
          originalText: sentence,
          translatedText: '',
          grammarNotes: [],
          keyVocabulary: [],
          confidence: -1, // Negative indicates failed, not just empty
        },
      })
    }
  }

  // Log summary of failures
  const failedCount = sentenceData.filter(s => s.translation.confidence === -1).length
  if (failedCount > 0) {
    console.warn(`[SentencePreGen] Completed with ${failedCount}/${sentenceData.length} failed translations`)
  }

  return sentenceData
}

// ============================================
// Storage Functions
// ============================================

/**
 * Store sentence data for a book
 */
export async function storeBookSentenceData(
  bookId: string,
  sentenceData: SentenceData[]
): Promise<void> {
  if (!db) {
    throw new Error('Database not initialized')
  }

  const docRef = db.collection('book_sentence_data').doc(bookId)

  await docRef.set({
    bookId,
    sentences: sentenceData,
    sentenceCount: sentenceData.length,
    generatedAt: new Date(),
  })

  console.log(`[SentencePreGen] Stored ${sentenceData.length} sentences for book ${bookId}`)
}

/**
 * High-level function to pre-generate and store book sentences
 */
export async function preGenerateBookSentences(
  bookId: string,
  content: string,
  baseUrl: string,
  progressCallback?: (current: number, total: number) => Promise<void>
): Promise<void> {
  const sentenceData = await preGenerateSentences(
    bookId,
    content,
    'book',
    baseUrl,
    progressCallback
  )

  await storeBookSentenceData(bookId, sentenceData)
}
