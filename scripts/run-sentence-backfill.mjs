#!/usr/bin/env node
/**
 * Run Sentence Data Backfill
 * Directly executes the backfill logic using Firebase Admin SDK
 *
 * Usage:
 *   node scripts/run-sentence-backfill.mjs [contentType] [--dry-run] [--repair] [--rebackfill-corrupted]
 *
 * Modes:
 *   (default)             Backfill new content that doesn't have sentence data
 *   --repair              Fix missing audio/translations in existing sentence data
 *   --rebackfill-corrupted  Delete and regenerate articles with corrupted data (no text field)
 *
 * Examples:
 *   node scripts/run-sentence-backfill.mjs all --dry-run              # Count all content
 *   node scripts/run-sentence-backfill.mjs articles                   # Backfill articles only
 *   node scripts/run-sentence-backfill.mjs all                        # Backfill everything
 *   node scripts/run-sentence-backfill.mjs all --repair               # Fix missing audio/translations
 *   node scripts/run-sentence-backfill.mjs --rebackfill-corrupted     # Delete & regenerate corrupted articles
 *   node scripts/run-sentence-backfill.mjs --rebackfill-corrupted --dry-run  # List corrupted articles
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { readFileSync } from 'fs'
import { createHash } from 'crypto'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load service account
const serviceAccountPath = join(__dirname, '..', 'moshimoshi-service-account.json')
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))

// Initialize Firebase Admin
const app = initializeApp({
  credential: cert(serviceAccount),
  storageBucket: `${serviceAccount.project_id}.firebasestorage.app`
})

const db = getFirestore(app)
const bucket = getStorage(app).bucket()

// Get Modal API key from environment
const MODAL_API_KEY = process.env.MODAL_API_KEY
if (!MODAL_API_KEY) {
  console.error('Error: MODAL_API_KEY environment variable is required')
  console.error('Usage: MODAL_API_KEY=your_key node scripts/run-sentence-backfill.mjs [contentType]')
  process.exit(1)
}

// Configuration
const VOICEVOX_CONFIG = {
  endpoint: 'https://emmanuelfabiani23--voicevox-tts-serve.modal.run/v1/audio/speech',
  defaultVoice: '23',
  speed: 0.85,
}

const QWEN_CONFIG = {
  baseUrl: 'https://emmanuelfabiani23--ollama-llm-ollamallm-serve.modal.run',
  model: 'qwen2.5:32b',
  timeout: 120000,
}

// Parse command line arguments
const args = process.argv.slice(2)
const contentType = args.find(a => !a.startsWith('--')) || 'all'
const dryRun = args.includes('--dry-run')
const repairMode = args.includes('--repair')
const rebackfillCorrupted = args.includes('--rebackfill-corrupted')

const modeLabel = rebackfillCorrupted ? ' (REBACKFILL CORRUPTED)' : repairMode ? ' (REPAIR MODE)' : ''

console.log(`\n========================================`)
console.log(`Sentence Data Backfill${modeLabel}`)
console.log(`========================================`)
console.log(`Content Type: ${contentType}`)
console.log(`Dry Run: ${dryRun}`)
console.log(`Repair Mode: ${repairMode}`)
console.log(`Rebackfill Corrupted: ${rebackfillCorrupted}`)
console.log(`========================================\n`)

// ============================================
// Sentence Splitting
// ============================================

function splitIntoSentences(text) {
  if (!text || text.trim().length === 0) return []

  const parts = text.split(/(。)/)
  const sentences = []
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

async function generateSentenceAudio(sentence, contentId, sentenceIndex, contentType) {
  const sentenceHash = createHash('md5')
    .update(`${contentId}-${sentenceIndex}-${sentence}`)
    .digest('hex')

  const storagePath = `sentence-audio/${contentType}/${contentId}/${sentenceHash}.mp3`
  const file = bucket.file(storagePath)

  // Check if already exists
  const [exists] = await file.exists()
  if (exists) {
    console.log(`    [Cache Hit] Sentence ${sentenceIndex}`)
    return `https://storage.googleapis.com/${bucket.name}/${storagePath}`
  }

  // Generate new audio
  console.log(`    [Generating] Sentence ${sentenceIndex} audio...`)

  const response = await fetch(VOICEVOX_CONFIG.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': MODAL_API_KEY,
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
    },
  })

  await file.makePublic()

  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`
}

// ============================================
// Translation Generation
// ============================================

async function generateSentenceTranslation(sentence) {
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
        'X-API-Key': MODAL_API_KEY,
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

    const data = await response.json()
    const content = data.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(content)

    return {
      translation: {
        originalText: sentence,
        translatedText: parsed.translatedText || '',
        grammarNotes: parsed.grammarNotes || [],
        keyVocabulary: parsed.keyVocabulary || [],
        confidence: parsed.confidence || 0.9,
      },
      tokens: data.usage?.total_tokens || 0,
    }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error('Qwen API timeout')
    }
    throw error
  }
}

// ============================================
// Process Single Content Item
// ============================================

async function processSentences(contentId, content, contentType) {
  const sentences = splitIntoSentences(content)
  console.log(`  Found ${sentences.length} sentences`)

  const sentenceData = []

  for (let index = 0; index < sentences.length; index++) {
    const sentence = sentences[index]

    try {
      // Generate audio
      const audioUrl = await generateSentenceAudio(sentence, contentId, index, contentType)

      // Generate translation
      console.log(`    [Translating] Sentence ${index}...`)
      const { translation } = await generateSentenceTranslation(sentence)

      sentenceData.push({
        index,
        text: sentence,
        audioUrl,
        translation,
      })

      // Small delay to avoid rate limiting
      if (index < sentences.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } catch (error) {
      console.error(`    [Error] Sentence ${index}: ${error.message}`)
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

  return sentenceData
}

// ============================================
// Repair Functions (fix missing audio/translations)
// ============================================

async function repairSentence(sentence, contentId, index, contentType) {
  // Get the text from various possible locations
  const text = sentence.text || sentence.translation?.originalText

  if (!text) {
    console.log(`    [Skip] Sentence ${index} - no text available`)
    return { ...sentence, repaired: false }
  }

  let audioUrl = sentence.audioUrl
  let translation = sentence.translation
  let repaired = false

  // Repair missing audio
  if (!audioUrl || audioUrl === '') {
    try {
      console.log(`    [Repairing Audio] Sentence ${index}...`)
      audioUrl = await generateSentenceAudio(text, contentId, index, contentType)
      repaired = true
    } catch (error) {
      console.error(`    [Audio Repair Failed] Sentence ${index}: ${error.message}`)
    }
  }

  // Repair missing translation
  if (!translation?.translatedText || translation.translatedText === '') {
    try {
      console.log(`    [Repairing Translation] Sentence ${index}...`)
      const result = await generateSentenceTranslation(text)
      translation = result.translation
      repaired = true
    } catch (error) {
      console.error(`    [Translation Repair Failed] Sentence ${index}: ${error.message}`)
    }
  }

  // Small delay between repairs
  if (repaired) {
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  // Ensure text field is set
  return { ...sentence, text, audioUrl, translation, repaired }
}

async function repairArticles() {
  console.log('\n--- Repairing Articles ---\n')

  const translationsSnapshot = await db.collection('news_article_translations').get()
  console.log(`Found ${translationsSnapshot.size} article translation documents`)

  let repaired = 0, skipped = 0, failed = 0

  for (const doc of translationsSnapshot.docs) {
    const articleId = doc.id
    const data = doc.data()

    if (!data.sentences || data.sentences.length === 0) {
      skipped++
      continue
    }

    // Find sentences needing repair
    const needsRepair = data.sentences.filter(s =>
      !s.audioUrl || s.audioUrl === '' ||
      !s.translation?.translatedText || s.translation.translatedText === ''
    )

    if (needsRepair.length === 0) {
      skipped++
      continue
    }

    console.log(`\n[Article] ${articleId}`)
    console.log(`  Found ${needsRepair.length} sentences needing repair`)

    if (dryRun) {
      repaired++
      continue
    }

    try {
      const repairedSentences = []
      let anyRepaired = false

      for (const sentence of data.sentences) {
        const needsAudio = !sentence.audioUrl || sentence.audioUrl === ''
        const needsTranslation = !sentence.translation?.translatedText || sentence.translation.translatedText === ''

        if (needsAudio || needsTranslation) {
          const result = await repairSentence(sentence, articleId, sentence.index, 'news_article')
          repairedSentences.push(result)
          if (result.repaired) anyRepaired = true
        } else {
          repairedSentences.push(sentence)
        }
      }

      if (anyRepaired) {
        await db.collection('news_article_translations').doc(articleId).update({
          sentences: repairedSentences,
          lastRepairedAt: new Date(),
        })
        console.log(`  [Success] Repaired article`)
        repaired++
      } else {
        console.log(`  [No changes] All repairs failed`)
        failed++
      }

      // Delay between articles
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch (error) {
      console.error(`  [Failed] ${error.message}`)
      failed++
    }
  }

  return { repaired, skipped, failed, total: translationsSnapshot.size }
}

async function repairStories() {
  console.log('\n--- Repairing Stories ---\n')

  const storiesSnapshot = await db.collection('story_sentence_data').get()
  console.log(`Found ${storiesSnapshot.size} story sentence documents`)

  let repaired = 0, skipped = 0, failed = 0

  for (const doc of storiesSnapshot.docs) {
    const storyId = doc.id
    const data = doc.data()

    if (!data.pages || data.pages.length === 0) {
      skipped++
      continue
    }

    // Count sentences needing repair across all pages
    let totalNeedsRepair = 0
    for (const page of data.pages) {
      if (!page.sentences) continue
      totalNeedsRepair += page.sentences.filter(s =>
        !s.audioUrl || s.audioUrl === '' ||
        !s.translation?.translatedText || s.translation.translatedText === ''
      ).length
    }

    if (totalNeedsRepair === 0) {
      skipped++
      continue
    }

    console.log(`\n[Story] ${storyId}`)
    console.log(`  Found ${totalNeedsRepair} sentences needing repair across ${data.pages.length} pages`)

    if (dryRun) {
      repaired++
      continue
    }

    try {
      const repairedPages = []
      let anyRepaired = false

      for (const page of data.pages) {
        const repairedSentences = []

        for (const sentence of (page.sentences || [])) {
          const needsAudio = !sentence.audioUrl || sentence.audioUrl === ''
          const needsTranslation = !sentence.translation?.translatedText || sentence.translation.translatedText === ''

          if (needsAudio || needsTranslation) {
            const result = await repairSentence(
              sentence,
              `${storyId}_page${page.pageNumber}`,
              sentence.index,
              'story'
            )
            repairedSentences.push(result)
            if (result.repaired) anyRepaired = true
          } else {
            repairedSentences.push(sentence)
          }
        }

        repairedPages.push({ ...page, sentences: repairedSentences })
      }

      if (anyRepaired) {
        await db.collection('story_sentence_data').doc(storyId).update({
          pages: repairedPages,
          lastRepairedAt: new Date(),
        })
        console.log(`  [Success] Repaired story`)
        repaired++
      } else {
        console.log(`  [No changes] All repairs failed`)
        failed++
      }

      // Delay between stories
      await new Promise(resolve => setTimeout(resolve, 3000))
    } catch (error) {
      console.error(`  [Failed] ${error.message}`)
      failed++
    }
  }

  return { repaired, skipped, failed, total: storiesSnapshot.size }
}

async function repairBooks() {
  console.log('\n--- Repairing Books ---\n')

  const booksSnapshot = await db.collection('book_sentence_data').get()
  console.log(`Found ${booksSnapshot.size} book sentence documents`)

  let repaired = 0, skipped = 0, failed = 0

  for (const doc of booksSnapshot.docs) {
    const bookId = doc.id
    const data = doc.data()

    if (!data.sentences || data.sentences.length === 0) {
      skipped++
      continue
    }

    // Find sentences needing repair
    const needsRepair = data.sentences.filter(s =>
      !s.audioUrl || s.audioUrl === '' ||
      !s.translation?.translatedText || s.translation.translatedText === ''
    )

    if (needsRepair.length === 0) {
      skipped++
      continue
    }

    console.log(`\n[Book] ${bookId}`)
    console.log(`  Found ${needsRepair.length} sentences needing repair`)

    if (dryRun) {
      repaired++
      continue
    }

    try {
      const repairedSentences = []
      let anyRepaired = false

      for (const sentence of data.sentences) {
        const needsAudio = !sentence.audioUrl || sentence.audioUrl === ''
        const needsTranslation = !sentence.translation?.translatedText || sentence.translation.translatedText === ''

        if (needsAudio || needsTranslation) {
          const result = await repairSentence(sentence, bookId, sentence.index, 'book')
          repairedSentences.push(result)
          if (result.repaired) anyRepaired = true
        } else {
          repairedSentences.push(sentence)
        }
      }

      if (anyRepaired) {
        await db.collection('book_sentence_data').doc(bookId).update({
          sentences: repairedSentences,
          lastRepairedAt: new Date(),
        })
        console.log(`  [Success] Repaired book`)
        repaired++
      } else {
        console.log(`  [No changes] All repairs failed`)
        failed++
      }

      // Delay between books
      await new Promise(resolve => setTimeout(resolve, 3000))
    } catch (error) {
      console.error(`  [Failed] ${error.message}`)
      failed++
    }
  }

  return { repaired, skipped, failed, total: booksSnapshot.size }
}

// ============================================
// Rebackfill Corrupted Functions
// ============================================

async function rebackfillCorruptedArticles() {
  console.log('\n--- Rebackfilling Corrupted Articles ---\n')

  // First, find all articles with corrupted sentence data
  const translationsSnapshot = await db.collection('news_article_translations').get()
  console.log(`Found ${translationsSnapshot.size} article translation documents`)

  // Find corrupted entries (sentences without text field)
  const corruptedArticleIds = []
  for (const doc of translationsSnapshot.docs) {
    const data = doc.data()
    if (!data.sentences || data.sentences.length === 0) continue

    // Check if any sentence is missing the text field
    const hasCorrupted = data.sentences.some(s => !s.text && !s.translation?.originalText)
    if (hasCorrupted) {
      corruptedArticleIds.push(doc.id)
    }
  }

  console.log(`Found ${corruptedArticleIds.length} articles with corrupted sentence data\n`)

  if (corruptedArticleIds.length === 0) {
    console.log('No corrupted articles found!')
    return { deleted: 0, reprocessed: 0, failed: 0, total: 0 }
  }

  if (dryRun) {
    console.log('Corrupted article IDs:')
    corruptedArticleIds.forEach(id => console.log(`  - ${id}`))
    return { deleted: 0, reprocessed: corruptedArticleIds.length, failed: 0, total: corruptedArticleIds.length }
  }

  let deleted = 0, reprocessed = 0, failed = 0

  for (const articleId of corruptedArticleIds) {
    console.log(`\n[Article] ${articleId}`)

    // Get the original article content
    const articleDoc = await db.collection('news_articles').doc(articleId).get()
    if (!articleDoc.exists) {
      console.log(`  [Skip] Article not found in news_articles collection`)
      failed++
      continue
    }

    const articleData = articleDoc.data()
    if (!articleData.content || articleData.content.trim().length === 0) {
      console.log(`  [Skip] No content in original article`)
      failed++
      continue
    }

    try {
      // Step 1: Delete the corrupted translation document
      console.log(`  [Deleting] Corrupted sentence data...`)
      await db.collection('news_article_translations').doc(articleId).delete()
      deleted++

      // Step 2: Regenerate sentence data
      console.log(`  [Regenerating] Processing ${splitIntoSentences(articleData.content).length} sentences...`)
      const sentenceData = await processSentences(articleId, articleData.content, 'news_article')

      // Step 3: Store fresh sentence data
      await db.collection('news_article_translations').doc(articleId).set({
        articleId,
        sentences: sentenceData,
        sentencesGeneratedAt: new Date(),
        rebackfilledAt: new Date(),
      })

      console.log(`  [Success] Rebackfilled ${sentenceData.length} sentences`)
      reprocessed++

      // Delay between articles
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch (error) {
      console.error(`  [Failed] ${error.message}`)
      failed++
    }
  }

  return { deleted, reprocessed, failed, total: corruptedArticleIds.length }
}

// ============================================
// Backfill Functions
// ============================================

async function backfillArticles() {
  console.log('\n--- Backfilling Articles ---\n')

  const articlesSnapshot = await db.collection('news_articles').get()
  console.log(`Found ${articlesSnapshot.size} articles`)

  let processed = 0, skipped = 0, failed = 0

  for (const articleDoc of articlesSnapshot.docs) {
    const articleId = articleDoc.id
    const articleData = articleDoc.data()

    console.log(`\n[Article] ${articleId}`)

    // Check if already has sentence data
    const translationDoc = await db.collection('news_article_translations').doc(articleId).get()
    if (translationDoc.exists && translationDoc.data()?.sentences?.length > 0) {
      console.log(`  Skipping - already has ${translationDoc.data().sentences.length} sentences`)
      skipped++
      continue
    }

    if (!articleData.content || articleData.content.trim().length === 0) {
      console.log(`  Skipping - no content`)
      skipped++
      continue
    }

    if (dryRun) {
      const sentenceCount = splitIntoSentences(articleData.content).length
      console.log(`  [Dry Run] Would process ${sentenceCount} sentences`)
      processed++
      continue
    }

    try {
      const sentenceData = await processSentences(articleId, articleData.content, 'news_article')

      // Store sentence data
      const docRef = db.collection('news_article_translations').doc(articleId)
      const doc = await docRef.get()

      if (doc.exists) {
        await docRef.update({
          sentences: sentenceData,
          sentencesGeneratedAt: new Date(),
        })
      } else {
        await docRef.set({
          articleId,
          sentences: sentenceData,
          sentencesGeneratedAt: new Date(),
        })
      }

      console.log(`  [Success] Stored ${sentenceData.length} sentences`)
      processed++

      // Delay between articles
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch (error) {
      console.error(`  [Failed] ${error.message}`)
      failed++
    }
  }

  return { processed, skipped, failed, total: articlesSnapshot.size }
}

async function backfillStories() {
  console.log('\n--- Backfilling Stories ---\n')

  const storiesSnapshot = await db.collection('stories').get()
  console.log(`Found ${storiesSnapshot.size} stories`)

  let processed = 0, skipped = 0, failed = 0

  for (const storyDoc of storiesSnapshot.docs) {
    const storyId = storyDoc.id
    const storyData = storyDoc.data()

    console.log(`\n[Story] ${storyId}`)

    // Check if already has sentence data
    const sentenceDoc = await db.collection('story_sentence_data').doc(storyId).get()
    if (sentenceDoc.exists && sentenceDoc.data()?.pages?.length > 0) {
      console.log(`  Skipping - already has ${sentenceDoc.data().pages.length} pages with sentences`)
      skipped++
      continue
    }

    if (!storyData.pages || !Array.isArray(storyData.pages) || storyData.pages.length === 0) {
      console.log(`  Skipping - no pages`)
      skipped++
      continue
    }

    const pages = storyData.pages
      .map((page, index) => ({
        pageNumber: page.pageNumber || index + 1,
        text: page.text || '',
      }))
      .filter(page => page.text.length > 0)

    if (pages.length === 0) {
      console.log(`  Skipping - no text content in pages`)
      skipped++
      continue
    }

    if (dryRun) {
      const totalSentences = pages.reduce((acc, p) => acc + splitIntoSentences(p.text).length, 0)
      console.log(`  [Dry Run] Would process ${pages.length} pages with ${totalSentences} total sentences`)
      processed++
      continue
    }

    try {
      const pagesData = []

      for (const page of pages) {
        console.log(`  Processing page ${page.pageNumber}...`)
        const sentenceData = await processSentences(
          `${storyId}_page${page.pageNumber}`,
          page.text,
          'story'
        )

        pagesData.push({
          pageNumber: page.pageNumber,
          sentences: sentenceData,
          generatedAt: new Date(),
        })
      }

      // Store sentence data
      await db.collection('story_sentence_data').doc(storyId).set({
        storyId,
        pages: pagesData,
        createdAt: new Date(),
        lastUpdated: new Date(),
      })

      console.log(`  [Success] Stored sentences for ${pagesData.length} pages`)
      processed++

      // Delay between stories
      await new Promise(resolve => setTimeout(resolve, 3000))
    } catch (error) {
      console.error(`  [Failed] ${error.message}`)
      failed++
    }
  }

  return { processed, skipped, failed, total: storiesSnapshot.size }
}

async function backfillBooks() {
  console.log('\n--- Backfilling Books ---\n')

  const booksSnapshot = await db.collection('books').get()
  console.log(`Found ${booksSnapshot.size} books`)

  let processed = 0, skipped = 0, failed = 0

  for (const bookDoc of booksSnapshot.docs) {
    const bookId = bookDoc.id
    const bookData = bookDoc.data()

    console.log(`\n[Book] ${bookId}`)

    // Check if already has sentence data
    const sentenceDoc = await db.collection('book_sentence_data').doc(bookId).get()
    if (sentenceDoc.exists && sentenceDoc.data()?.sentences?.length > 0) {
      console.log(`  Skipping - already has ${sentenceDoc.data().sentences.length} sentences`)
      skipped++
      continue
    }

    if (!bookData.content || bookData.content.trim().length === 0) {
      console.log(`  Skipping - no content`)
      skipped++
      continue
    }

    if (dryRun) {
      const sentenceCount = splitIntoSentences(bookData.content).length
      console.log(`  [Dry Run] Would process ${sentenceCount} sentences`)
      processed++
      continue
    }

    try {
      const sentenceData = await processSentences(bookId, bookData.content, 'book')

      // Store sentence data
      await db.collection('book_sentence_data').doc(bookId).set({
        bookId,
        sentences: sentenceData,
        generatedAt: new Date(),
      })

      console.log(`  [Success] Stored ${sentenceData.length} sentences`)
      processed++

      // Delay between books
      await new Promise(resolve => setTimeout(resolve, 3000))
    } catch (error) {
      console.error(`  [Failed] ${error.message}`)
      failed++
    }
  }

  return { processed, skipped, failed, total: booksSnapshot.size }
}

// ============================================
// Main
// ============================================

async function main() {
  const results = {}

  try {
    if (rebackfillCorrupted) {
      // REBACKFILL CORRUPTED MODE: Delete and regenerate corrupted sentence data
      console.log('Finding and rebackfilling corrupted articles...')
      results.articles = await rebackfillCorruptedArticles()

      console.log('\n========================================')
      console.log('Rebackfill Corrupted Complete!')
      console.log('========================================')
    } else if (repairMode) {
      // REPAIR MODE: Fix missing audio/translations in existing data
      if (contentType === 'articles' || contentType === 'all') {
        results.articles = await repairArticles()
      }

      if (contentType === 'stories' || contentType === 'all') {
        results.stories = await repairStories()
      }

      if (contentType === 'books' || contentType === 'all') {
        results.books = await repairBooks()
      }

      console.log('\n========================================')
      console.log('Repair Complete!')
      console.log('========================================')
    } else {
      // BACKFILL MODE: Process new content
      if (contentType === 'articles' || contentType === 'all') {
        results.articles = await backfillArticles()
      }

      if (contentType === 'stories' || contentType === 'all') {
        results.stories = await backfillStories()
      }

      if (contentType === 'books' || contentType === 'all') {
        results.books = await backfillBooks()
      }

      console.log('\n========================================')
      console.log('Backfill Complete!')
      console.log('========================================')
    }

    console.log(JSON.stringify(results, null, 2))
    console.log('========================================\n')

  } catch (error) {
    console.error('\nFatal error:', error)
    process.exit(1)
  }

  process.exit(0)
}

main()
