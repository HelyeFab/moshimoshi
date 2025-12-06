/**
 * One-off AI Processing Script for NHK Articles
 *
 * Processes all articles in Firebase with:
 * 1. TTS Audio Generation (via VOICEVOX on Modal)
 * 2. Translations (via Qwen 2.5 on Modal)
 * 3. Word Explanations (via Qwen 2.5 on Modal)
 *
 * Usage: node scripts/process-articles-ai.js [--batch-size=5] [--skip-audio] [--skip-translations] [--skip-words]
 */

const admin = require('firebase-admin')
const fetch = require('node-fetch')

// Configuration
const CONFIG = {
  BATCH_SIZE: parseInt(process.argv.find(a => a.startsWith('--batch-size='))?.split('=')[1] || '3'),
  SKIP_AUDIO: process.argv.includes('--skip-audio'),
  SKIP_TRANSLATIONS: process.argv.includes('--skip-translations'),
  SKIP_WORDS: process.argv.includes('--skip-words'),

  // Qwen 2.5 via Modal
  QWEN_URL: 'https://emmanuelfabiani23--ollama-llm-ollamallm-serve.modal.run/v1/chat/completions',
  QWEN_MODEL: 'qwen2.5:32b',
  QWEN_TIMEOUT: 300000, // 5 minutes

  // VOICEVOX TTS via Modal
  VOICEVOX_URL: 'https://emmanuelfabiani23--voicevox-tts-serve.modal.run/v1/audio/speech',

  // Firebase Storage
  STORAGE_BUCKET: 'moshimoshi-de237.firebasestorage.app',
}

// Get API key from environment or .env.local
const MODAL_API_KEY =
  process.env.MODAL_API_KEY ||
  require('dotenv').config({ path: '.env.local' }).parsed?.MODAL_API_KEY

if (!MODAL_API_KEY) {
  console.error('ERROR: MODAL_API_KEY not found. Set it in environment or .env.local')
  process.exit(1)
}

// Initialize Firebase
const serviceAccount = require('../moshimoshi-service-account.json')
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: CONFIG.STORAGE_BUCKET,
})
const db = admin.firestore()
const storage = admin.storage().bucket()

// Stats tracking
const stats = {
  total: 0,
  processed: 0,
  audioGenerated: 0,
  translationsGenerated: 0,
  wordsGenerated: 0,
  errors: [],
}

/**
 * Call Qwen 2.5 API
 */
async function callQwen(systemPrompt, userPrompt) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.QWEN_TIMEOUT)

  try {
    const response = await fetch(CONFIG.QWEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': MODAL_API_KEY,
      },
      body: JSON.stringify({
        model: CONFIG.QWEN_MODEL,
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
      throw new Error(`Qwen API error: ${response.status}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || '{}'
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * Generate TTS audio for text (OpenAI-compatible endpoint)
 */
async function generateTTS(text, speakerId = 2) {
  try {
    const response = await fetch(CONFIG.VOICEVOX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': MODAL_API_KEY,
      },
      body: JSON.stringify({
        model: 'voicevox',
        input: text.substring(0, 5000), // Limit text length
        voice: String(speakerId),
        speed: 1.0,
      }),
      timeout: 120000,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`VOICEVOX error: ${response.status} - ${errorText}`)
    }

    return await response.buffer()
  } catch (error) {
    throw error
  }
}

/**
 * Upload audio to Firebase Storage
 */
async function uploadAudio(buffer, articleId, type) {
  const path = `news-audio/NHK-Easy/${articleId}/${type}.wav`
  const file = storage.file(path)

  await file.save(buffer, {
    contentType: 'audio/wav',
    metadata: {
      cacheControl: 'public, max-age=31536000',
    },
  })

  await file.makePublic()
  return `https://storage.googleapis.com/${CONFIG.STORAGE_BUCKET}/${path}`
}

/**
 * Generate translations for an article
 */
async function generateTranslations(article) {
  console.log('  📝 Generating translations...')

  const systemPrompt = `You are an expert Japanese-English translator for language learners.
Return JSON: { "title": "...", "summary": "...", "content": "...", "keyVocabulary": [{"word": "...", "meaning": "..."}], "grammarNotes": ["..."] }`

  const userPrompt = `Translate this Japanese article to English:
Title: ${article.title}
Summary: ${article.summary || ''}
Content: ${article.content?.substring(0, 3000) || ''}

Provide educational translation with key vocabulary and grammar notes.`

  const result = await callQwen(systemPrompt, userPrompt)
  const parsed = JSON.parse(result)

  const translation = {
    articleId: article.id,
    title: {
      originalText: article.title,
      translatedText: parsed.title || '',
      type: 'title',
      mode: 'learning',
      confidence: 0.9,
      metadata: {
        keyVocabulary: parsed.keyVocabulary || [],
        grammarNotes: parsed.grammarNotes || [],
      },
    },
    summary: {
      originalText: article.summary || '',
      translatedText: parsed.summary || '',
      type: 'summary',
      mode: 'learning',
      confidence: 0.9,
    },
    content: {
      originalText: article.content || '',
      translatedText: parsed.content || '',
      type: 'content',
      mode: 'full',
      confidence: 0.9,
    },
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    costInfo: { estimatedCost: 0 }, // Qwen is free
  }

  await db.collection('news_article_translations').doc(article.id).set(translation)
  return translation
}

/**
 * Extract top words from article content
 */
function extractWords(content, limit = 50) {
  if (!content) return []

  // Simple extraction: find all Japanese words (kanji + kana sequences)
  const wordPattern = /[\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ff]+/g
  const matches = content.match(wordPattern) || []

  // Count frequency
  const freq = {}
  matches.forEach(w => {
    if (w.length >= 2) {
      // Skip single characters
      freq[w] = (freq[w] || 0) + 1
    }
  })

  // Sort by frequency and return top words
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, frequency]) => ({ word, frequency }))
}

/**
 * Generate word explanations for an article
 */
async function generateWordExplanations(article) {
  console.log('  📚 Generating word explanations...')

  const words = extractWords(article.content, 30) // Top 30 words
  if (words.length === 0) {
    console.log('    No words to explain')
    return null
  }

  console.log(`    Found ${words.length} words to explain`)

  const explanations = []

  // Process in small batches to avoid timeout
  for (let i = 0; i < words.length; i += 5) {
    const batch = words.slice(i, i + 5)
    const wordList = batch.map(w => w.word).join(', ')

    console.log(`    Processing words ${i + 1}-${Math.min(i + 5, words.length)}...`)

    const systemPrompt = `You are a Japanese dictionary. For each word, provide:
- reading (hiragana)
- romaji
- meaning (English)
- partOfSpeech
- jlptLevel (N5-N1)
- examples (2 sentences with translations)

Return JSON array: [{ "word": "...", "reading": "...", "romaji": "...", "meaning": "...", "partOfSpeech": "...", "jlptLevel": "N4", "examples": [{"japanese": "...", "translation": "..."}] }]`

    const userPrompt = `Explain these Japanese words: ${wordList}`

    try {
      const result = await callQwen(systemPrompt, userPrompt)
      const parsed = JSON.parse(result)

      if (Array.isArray(parsed)) {
        explanations.push(...parsed)
      } else if (parsed.words) {
        explanations.push(...parsed.words)
      }
    } catch (error) {
      console.log(`    Error processing batch: ${error.message}`)
    }

    // Small delay between batches
    await new Promise(r => setTimeout(r, 1000))
  }

  const articleExplanations = {
    articleId: article.id,
    words: explanations,
    wordCount: explanations.length,
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    costInfo: { estimatedCost: 0 },
  }

  await db.collection('news_article_word_explanations').doc(article.id).set(articleExplanations)
  return articleExplanations
}

/**
 * Generate audio for an article
 */
async function generateAudio(article) {
  console.log('  🔊 Generating TTS audio...')

  const audioUrls = {}

  // Title audio
  if (article.title) {
    try {
      console.log('    Generating title audio...')
      const titleBuffer = await generateTTS(article.title)
      audioUrls.title = await uploadAudio(titleBuffer, article.id, 'title')
    } catch (error) {
      console.log(`    Title audio failed: ${error.message}`)
    }
  }

  // Summary audio
  if (article.summary) {
    try {
      console.log('    Generating summary audio...')
      const summaryBuffer = await generateTTS(article.summary)
      audioUrls.summary = await uploadAudio(summaryBuffer, article.id, 'summary')
    } catch (error) {
      console.log(`    Summary audio failed: ${error.message}`)
    }
  }

  // Content audio (if not too long)
  if (article.content && article.content.length < 3000) {
    try {
      console.log('    Generating content audio...')
      const contentBuffer = await generateTTS(article.content)
      audioUrls.content = await uploadAudio(contentBuffer, article.id, 'content')
    } catch (error) {
      console.log(`    Content audio failed: ${error.message}`)
    }
  }

  // Update article with audio URLs
  if (Object.keys(audioUrls).length > 0) {
    await db
      .collection('news_articles')
      .doc(article.id)
      .update({
        generatedTitleAudioUrl: audioUrls.title || null,
        generatedSummaryAudioUrl: audioUrls.summary || null,
        generatedContentAudioUrl: audioUrls.content || null,
        audioStatus: 'generated',
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      })
  }

  return audioUrls
}

/**
 * Check if article already has cached data
 */
async function checkExistingCache(articleId) {
  const [translationDoc, wordDoc] = await Promise.all([
    db.collection('news_article_translations').doc(articleId).get(),
    db.collection('news_article_word_explanations').doc(articleId).get(),
  ])

  return {
    hasTranslation: translationDoc.exists,
    hasWords: wordDoc.exists,
  }
}

/**
 * Process a single article
 */
async function processArticle(article, index, total) {
  console.log(`\n[${index + 1}/${total}] Processing: ${article.title?.substring(0, 40)}...`)

  try {
    // Check existing cache
    const cache = await checkExistingCache(article.id)

    // Generate translations
    if (!CONFIG.SKIP_TRANSLATIONS && !cache.hasTranslation) {
      await generateTranslations(article)
      stats.translationsGenerated++
    } else if (cache.hasTranslation) {
      console.log('  📝 Translation already cached')
    }

    // Generate word explanations
    if (!CONFIG.SKIP_WORDS && !cache.hasWords) {
      await generateWordExplanations(article)
      stats.wordsGenerated++
    } else if (cache.hasWords) {
      console.log('  📚 Word explanations already cached')
    }

    // Generate audio
    if (!CONFIG.SKIP_AUDIO && article.audioStatus !== 'generated') {
      await generateAudio(article)
      stats.audioGenerated++
    } else if (article.audioStatus === 'generated') {
      console.log('  🔊 Audio already generated')
    }

    stats.processed++
    console.log(`  ✅ Done`)
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`)
    stats.errors.push({ articleId: article.id, error: error.message })
  }
}

/**
 * Main function
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║     NHK Articles AI Processing Script                      ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log('')
  console.log('Configuration:')
  console.log(`  Batch size: ${CONFIG.BATCH_SIZE}`)
  console.log(`  Skip audio: ${CONFIG.SKIP_AUDIO}`)
  console.log(`  Skip translations: ${CONFIG.SKIP_TRANSLATIONS}`)
  console.log(`  Skip words: ${CONFIG.SKIP_WORDS}`)
  console.log('')

  // Get all articles
  console.log('Fetching articles from Firebase...')
  const snapshot = await db.collection('news_articles').orderBy('publishDate', 'desc').get()
  const articles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

  stats.total = articles.length
  console.log(`Found ${articles.length} articles to process\n`)

  // Process in batches
  for (let i = 0; i < articles.length; i += CONFIG.BATCH_SIZE) {
    const batch = articles.slice(i, i + CONFIG.BATCH_SIZE)

    console.log(
      `\n━━━ Batch ${Math.floor(i / CONFIG.BATCH_SIZE) + 1}/${Math.ceil(articles.length / CONFIG.BATCH_SIZE)} ━━━`
    )

    for (let j = 0; j < batch.length; j++) {
      await processArticle(batch[j], i + j, articles.length)
    }

    // Delay between batches
    if (i + CONFIG.BATCH_SIZE < articles.length) {
      console.log('\n⏳ Waiting 5s before next batch...')
      await new Promise(r => setTimeout(r, 5000))
    }
  }

  // Print summary
  console.log('\n')
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║                       SUMMARY                              ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log(`  Total articles:        ${stats.total}`)
  console.log(`  Successfully processed: ${stats.processed}`)
  console.log(`  Translations generated: ${stats.translationsGenerated}`)
  console.log(`  Word explanations:      ${stats.wordsGenerated}`)
  console.log(`  Audio generated:        ${stats.audioGenerated}`)
  console.log(`  Errors:                 ${stats.errors.length}`)

  if (stats.errors.length > 0) {
    console.log('\nErrors:')
    stats.errors.forEach(e => console.log(`  - ${e.articleId}: ${e.error}`))
  }

  console.log('\n✨ Done!')
}

// Run
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
