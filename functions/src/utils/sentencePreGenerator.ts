/**
 * Sentence Pre-Generator
 * Pre-generates audio and translations for individual sentences
 * Used by news articles, stories, and books for instant playback/translation
 *
 * Features:
 * - VOICEVOX TTS audio generation for each sentence
 * - Translation with grammar notes and vocabulary
 * - Firebase Storage for audio, Firestore for translations
 */

import * as admin from 'firebase-admin'
import * as logger from 'firebase-functions/logger'
import { defineSecret } from 'firebase-functions/params'
import crypto from 'crypto'

// Initialize Firestore and Storage
const db = admin.firestore()

// Define secrets
const MODAL_API_KEY = defineSecret('MODAL_API_KEY')

// VOICEVOX configuration
const VOICEVOX_CONFIG = {
  endpoint: 'https://emmanuelfabiani23--voicevox-tts-serve.modal.run/v1/audio/speech',
  defaultVoice: '23', // Energetic female (same as news audio)
  speed: 0.85,
}

// Qwen 2.5 configuration for translations
const QWEN_CONFIG = {
  baseUrl: 'https://emmanuelfabiani23--ollama-llm-ollamallm-serve.modal.run',
  model: 'qwen2.5:32b',
  timeout: 120000, // 2 minutes per sentence (shorter than article)
}

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

export interface SentencePreGenResult {
  contentId: string
  contentType: 'news_article' | 'story' | 'book'
  sentences: SentenceData[]
  generatedAt: admin.firestore.Timestamp
  costInfo: {
    audioCount: number
    translationTokens: number
    estimatedCost: number
  }
}

// ============================================
// Sentence Splitting
// ============================================

/**
 * Split Japanese text into sentences by 。
 * Preserves the sentence-ending punctuation
 */
export function splitIntoSentences(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return []
  }

  // Split by Japanese period, keeping the delimiter
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

  // Add any remaining text (sentence without ending period)
  if (current.trim()) {
    sentences.push(current.trim())
  }

  return sentences
}

// ============================================
// Audio Generation
// ============================================

/**
 * Generate VOICEVOX audio for a sentence
 */
async function generateSentenceAudio(
  sentence: string,
  contentId: string,
  sentenceIndex: number,
  contentType: string
): Promise<string> {
  const sentenceHash = crypto
    .createHash('md5')
    .update(`${contentId}-${sentenceIndex}-${sentence}`)
    .digest('hex')

  const storagePath = `sentence-audio/${contentType}/${contentId}/${sentenceHash}.mp3`

  // Check if already exists
  const bucket = admin.storage().bucket()
  const file = bucket.file(storagePath)
  const [exists] = await file.exists()

  if (exists) {
    logger.debug('[SentencePreGen] Using cached audio', {
      contentId,
      sentenceIndex,
      cached: true,
    })
    return `https://storage.googleapis.com/${bucket.name}/${storagePath}`
  }

  // Generate new audio
  logger.debug('[SentencePreGen] Generating audio', {
    contentId,
    sentenceIndex,
    textLength: sentence.length,
  })

  const response = await fetch(VOICEVOX_CONFIG.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': MODAL_API_KEY.value().trim(),
    },
    body: JSON.stringify({
      model: 'voicevox',
      input: sentence,
      voice: VOICEVOX_CONFIG.defaultVoice,
      speed: VOICEVOX_CONFIG.speed,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`VOICEVOX API error (${response.status}): ${errorText}`)
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer())

  if (audioBuffer.length === 0) {
    throw new Error('VOICEVOX returned empty audio')
  }

  // Upload to Firebase Storage
  await file.save(audioBuffer, {
    metadata: {
      contentType: 'audio/mpeg',
      cacheControl: 'public, max-age=31536000',
      metadata: {
        contentId,
        contentType,
        sentenceIndex: String(sentenceIndex),
        sentenceHash,
        generatedAt: new Date().toISOString(),
        provider: 'voicevox',
        voice: VOICEVOX_CONFIG.defaultVoice,
      },
    },
  })

  await file.makePublic()

  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`
}

// ============================================
// Translation Generation
// ============================================

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

/**
 * Generate translation with grammar notes and vocabulary for a sentence
 */
async function generateSentenceTranslation(
  sentence: string
): Promise<{ translation: SentenceTranslation; tokens: number }> {
  const systemPrompt = `You are an expert Japanese-English translator for language learners.
For each sentence, provide:
1. A natural English translation
2. Key grammar patterns with explanations
3. Important vocabulary with readings and meanings

Return a JSON object:
{
  "translatedText": "English translation",
  "confidence": 0.95,
  "grammarNotes": [
    {
      "pattern": "〜ている",
      "explanation": "Progressive/continuous action",
      "example": "食べている (is eating)"
    }
  ],
  "keyVocabulary": [
    {
      "word": "食べる",
      "reading": "たべる",
      "meaning": "to eat",
      "jlptLevel": "N5",
      "partOfSpeech": "verb"
    }
  ]
}`

  const userPrompt = `Translate this Japanese sentence for language learners:

"${sentence}"

Focus on educational value. Return valid JSON.`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), QWEN_CONFIG.timeout)

  try {
    const response = await fetch(`${QWEN_CONFIG.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': MODAL_API_KEY.value().trim(),
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
    const parsed = JSON.parse(content)

    const translation: SentenceTranslation = {
      originalText: sentence,
      translatedText: parsed.translatedText || '',
      grammarNotes: parsed.grammarNotes || [],
      keyVocabulary: parsed.keyVocabulary || [],
      confidence: parsed.confidence || 0.9,
    }

    return {
      translation,
      tokens: data.usage?.total_tokens || 0,
    }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Qwen API timeout')
    }
    throw error
  }
}

// ============================================
// Main Pre-Generation Functions
// ============================================

/**
 * Pre-generate audio and translations for all sentences in content
 */
export async function preGenerateSentences(
  contentId: string,
  content: string,
  contentType: 'news_article' | 'story' | 'book'
): Promise<SentencePreGenResult> {
  const startTime = Date.now()

  logger.info('[SentencePreGen] Starting sentence pre-generation', {
    contentId,
    contentType,
    contentLength: content.length,
  })

  const sentences = splitIntoSentences(content)

  logger.info('[SentencePreGen] Split content into sentences', {
    contentId,
    sentenceCount: sentences.length,
  })

  const sentenceData: SentenceData[] = []
  let totalTokens = 0
  let audioCount = 0

  for (let index = 0; index < sentences.length; index++) {
    const sentence = sentences[index]

    try {
      // Generate audio
      const audioUrl = await generateSentenceAudio(
        sentence,
        contentId,
        index,
        contentType
      )
      audioCount++

      // Generate translation
      const { translation, tokens } = await generateSentenceTranslation(sentence)
      totalTokens += tokens

      sentenceData.push({
        index,
        text: sentence,
        audioUrl,
        translation,
      })

      logger.debug('[SentencePreGen] Sentence processed', {
        contentId,
        index,
        sentenceLength: sentence.length,
        hasAudio: !!audioUrl,
        hasTranslation: !!translation.translatedText,
      })

      // Small delay to avoid rate limiting
      if (index < sentences.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } catch (error) {
      logger.error('[SentencePreGen] Error processing sentence', {
        contentId,
        index,
        sentence: sentence.substring(0, 50) + '...',
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      // Continue with next sentence even if one fails
      // Add partial data without audio/translation if needed
      sentenceData.push({
        index,
        text: sentence,
        audioUrl: '',
        translation: {
          originalText: sentence,
          translatedText: '',
          grammarNotes: [],
          keyVocabulary: [],
          confidence: 0,
        },
      })
    }
  }

  const duration = Date.now() - startTime

  logger.info('[SentencePreGen] Pre-generation completed', {
    contentId,
    contentType,
    sentenceCount: sentences.length,
    successCount: sentenceData.filter(s => s.audioUrl && s.translation.translatedText).length,
    durationMs: duration,
    totalTokens,
    audioCount,
  })

  return {
    contentId,
    contentType,
    sentences: sentenceData,
    generatedAt: admin.firestore.Timestamp.now(),
    costInfo: {
      audioCount,
      translationTokens: totalTokens,
      estimatedCost: 0, // Self-hosted = $0
    },
  }
}

// ============================================
// Storage Functions
// ============================================

/**
 * Store sentence data for a news article
 * Extends the existing news_article_translations document
 */
export async function storeSentenceDataForArticle(
  articleId: string,
  sentenceData: SentenceData[]
): Promise<void> {
  try {
    const docRef = db.collection('news_article_translations').doc(articleId)
    const doc = await docRef.get()

    if (doc.exists) {
      // Update existing document with sentence data
      await docRef.update({
        sentences: sentenceData,
        sentencesGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    } else {
      // Create new document with just sentence data
      await docRef.set({
        articleId,
        sentences: sentenceData,
        sentencesGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }

    logger.info('[SentencePreGen] Sentence data stored for article', {
      articleId,
      sentenceCount: sentenceData.length,
    })
  } catch (error) {
    logger.error('[SentencePreGen] Error storing sentence data for article', {
      articleId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

/**
 * Store sentence data for a story page
 */
export async function storeSentenceDataForStory(
  storyId: string,
  pageNumber: number,
  sentenceData: SentenceData[]
): Promise<void> {
  try {
    const docRef = db.collection('story_sentence_data').doc(storyId)
    const doc = await docRef.get()

    const pageData = {
      pageNumber,
      sentences: sentenceData,
      generatedAt: admin.firestore.Timestamp.now(),  // Use Timestamp.now() for nested array elements
    }

    if (doc.exists) {
      // Update existing document - add/update page data
      const existingData = doc.data()
      const existingPages = existingData?.pages || []

      // Find and replace page or add new
      const pageIndex = existingPages.findIndex((p: any) => p.pageNumber === pageNumber)
      if (pageIndex >= 0) {
        existingPages[pageIndex] = pageData
      } else {
        existingPages.push(pageData)
      }

      await docRef.update({
        pages: existingPages,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      })
    } else {
      // Create new document
      await docRef.set({
        storyId,
        pages: [pageData],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      })
    }

    logger.info('[SentencePreGen] Sentence data stored for story page', {
      storyId,
      pageNumber,
      sentenceCount: sentenceData.length,
    })
  } catch (error) {
    logger.error('[SentencePreGen] Error storing sentence data for story', {
      storyId,
      pageNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

/**
 * Store sentence data for a book
 */
export async function storeSentenceDataForBook(
  bookId: string,
  sentenceData: SentenceData[]
): Promise<void> {
  try {
    const docRef = db.collection('book_sentence_data').doc(bookId)

    await docRef.set({
      bookId,
      sentences: sentenceData,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    logger.info('[SentencePreGen] Sentence data stored for book', {
      bookId,
      sentenceCount: sentenceData.length,
    })
  } catch (error) {
    logger.error('[SentencePreGen] Error storing sentence data for book', {
      bookId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

// ============================================
// High-Level Integration Functions
// ============================================

/**
 * Pre-generate sentences for a news article and store
 */
export async function preGenerateArticleSentences(
  articleId: string,
  content: string
): Promise<void> {
  const result = await preGenerateSentences(articleId, content, 'news_article')
  await storeSentenceDataForArticle(articleId, result.sentences)
}

/**
 * Pre-generate sentences for all pages of a story and store
 */
export async function preGenerateStorySentences(
  storyId: string,
  pages: Array<{ pageNumber: number; text: string }>
): Promise<void> {
  for (const page of pages) {
    const result = await preGenerateSentences(
      `${storyId}_page${page.pageNumber}`,
      page.text,
      'story'
    )
    await storeSentenceDataForStory(storyId, page.pageNumber, result.sentences)
  }
}

/**
 * Pre-generate sentences for a book and store
 */
export async function preGenerateBookSentences(
  bookId: string,
  content: string
): Promise<void> {
  const result = await preGenerateSentences(bookId, content, 'book')
  await storeSentenceDataForBook(bookId, result.sentences)
}

// ============================================
// Comic Support
// ============================================

export interface ComicDialogueSentence {
  panelNumber: number
  dialogueIndex: number
  characterId: string
  characterName: string
  text: string
  textEn: string
  audioUrl: string
  emotion?: string
}

export interface ComicNarrationSentence {
  panelNumber: number
  text: string
  textEn: string
  audioUrl: string
}

export interface ComicSentenceData {
  episodeId: string
  title: string
  titleJa: string
  dialogues: ComicDialogueSentence[]
  narrations: ComicNarrationSentence[]
  fullAudioUrl: string
  generatedAt: admin.firestore.Timestamp
}

/**
 * Store sentence data for a comic episode
 */
export async function storeSentenceDataForComic(
  episodeId: string,
  data: Omit<ComicSentenceData, 'generatedAt'>
): Promise<void> {
  try {
    const docRef = db.collection('comic_sentence_data').doc(episodeId)

    await docRef.set({
      ...data,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    logger.info('[SentencePreGen] Sentence data stored for comic', {
      episodeId,
      dialogueCount: data.dialogues.length,
      narrationCount: data.narrations.length,
    })
  } catch (error) {
    logger.error('[SentencePreGen] Error storing sentence data for comic', {
      episodeId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

/**
 * Pre-generate audio for all dialogues and narrations in a comic episode
 */
export async function preGenerateComicSentences(
  episodeId: string,
  panels: Array<{
    panelNumber: number
    dialogues?: Array<{
      characterId: string
      characterName: string
      textJa: string
      textEn: string
      emotion?: string
    }>
    narration?: {
      textJa: string
      textEn: string
    }
  }>,
  title: string,
  titleJa: string
): Promise<{ fullAudioUrl: string; dialogueCount: number; narrationCount: number }> {
  logger.info('[SentencePreGen] Starting comic sentence pre-generation', {
    episodeId,
    panelCount: panels.length,
  })

  const dialogueSentences: ComicDialogueSentence[] = []
  const narrationSentences: ComicNarrationSentence[] = []
  const allTextForFullAudio: string[] = []

  for (const panel of panels) {
    // Process dialogues
    if (panel.dialogues) {
      for (let dIndex = 0; dIndex < panel.dialogues.length; dIndex++) {
        const dialogue = panel.dialogues[dIndex]
        if (dialogue.textJa) {
          allTextForFullAudio.push(dialogue.textJa)

          try {
            const audioUrl = await generateSentenceAudio(
              dialogue.textJa,
              episodeId,
              panel.panelNumber * 100 + dIndex, // Unique index
              'comic'
            )

            dialogueSentences.push({
              panelNumber: panel.panelNumber,
              dialogueIndex: dIndex,
              characterId: dialogue.characterId,
              characterName: dialogue.characterName,
              text: dialogue.textJa,
              textEn: dialogue.textEn,
              audioUrl,
              emotion: dialogue.emotion,
            })

            logger.debug('[SentencePreGen] Comic dialogue audio generated', {
              episodeId,
              panelNumber: panel.panelNumber,
              dialogueIndex: dIndex,
            })
          } catch (error) {
            logger.error('[SentencePreGen] Error generating dialogue audio', {
              episodeId,
              panelNumber: panel.panelNumber,
              dialogueIndex: dIndex,
              error: error instanceof Error ? error.message : 'Unknown',
            })

            // Add with empty audioUrl
            dialogueSentences.push({
              panelNumber: panel.panelNumber,
              dialogueIndex: dIndex,
              characterId: dialogue.characterId,
              characterName: dialogue.characterName,
              text: dialogue.textJa,
              textEn: dialogue.textEn,
              audioUrl: '',
              emotion: dialogue.emotion,
            })
          }

          // Rate limiting delay
          await new Promise(resolve => setTimeout(resolve, 300))
        }
      }
    }

    // Process narration
    if (panel.narration?.textJa) {
      allTextForFullAudio.push(panel.narration.textJa)

      try {
        const audioUrl = await generateSentenceAudio(
          panel.narration.textJa,
          episodeId,
          panel.panelNumber * 100 + 99, // Use 99 for narration
          'comic'
        )

        narrationSentences.push({
          panelNumber: panel.panelNumber,
          text: panel.narration.textJa,
          textEn: panel.narration.textEn,
          audioUrl,
        })

        logger.debug('[SentencePreGen] Comic narration audio generated', {
          episodeId,
          panelNumber: panel.panelNumber,
        })
      } catch (error) {
        logger.error('[SentencePreGen] Error generating narration audio', {
          episodeId,
          panelNumber: panel.panelNumber,
          error: error instanceof Error ? error.message : 'Unknown',
        })

        narrationSentences.push({
          panelNumber: panel.panelNumber,
          text: panel.narration.textJa,
          textEn: panel.narration.textEn,
          audioUrl: '',
        })
      }

      await new Promise(resolve => setTimeout(resolve, 300))
    }
  }

  // Generate full episode audio
  let fullAudioUrl = ''
  if (allTextForFullAudio.length > 0) {
    try {
      const fullText = allTextForFullAudio.join('。\n')
      fullAudioUrl = await generateSentenceAudio(
        fullText,
        episodeId,
        9999, // Special index for full audio
        'comic'
      )
      logger.info('[SentencePreGen] Full episode audio generated', { episodeId })
    } catch (error) {
      logger.error('[SentencePreGen] Error generating full episode audio', {
        episodeId,
        error: error instanceof Error ? error.message : 'Unknown',
      })
    }
  }

  // Store sentence data
  await storeSentenceDataForComic(episodeId, {
    episodeId,
    title,
    titleJa,
    dialogues: dialogueSentences,
    narrations: narrationSentences,
    fullAudioUrl,
  })

  logger.info('[SentencePreGen] Comic sentence pre-generation completed', {
    episodeId,
    dialogueCount: dialogueSentences.length,
    narrationCount: narrationSentences.length,
    hasFullAudio: !!fullAudioUrl,
  })

  return {
    fullAudioUrl,
    dialogueCount: dialogueSentences.length,
    narrationCount: narrationSentences.length,
  }
}
