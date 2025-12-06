/**
 * Reprocess a single NHK article
 *
 * Usage: node scripts/reprocess-article.js <article-id>
 *
 * Example: node scripts/reprocess-article.js 1e3ca8e2b174b8d190487fed56cf8307
 */

const admin = require('firebase-admin')
const fetch = require('node-fetch')

// Configuration
const CONFIG = {
  QWEN_URL: 'https://emmanuelfabiani23--ollama-llm-ollamallm-serve.modal.run/v1/chat/completions',
  QWEN_MODEL: 'qwen2.5:32b',
  VOICEVOX_URL: 'https://emmanuelfabiani23--voicevox-tts-serve.modal.run/v1/audio/speech',
  STORAGE_BUCKET: 'moshimoshi-de237.firebasestorage.app',
}

// Get article ID from command line
const ARTICLE_ID = process.argv[2]

if (!ARTICLE_ID) {
  console.error('Usage: node scripts/reprocess-article.js <article-id>')
  console.error('Example: node scripts/reprocess-article.js 1e3ca8e2b174b8d190487fed56cf8307')
  process.exit(1)
}

// Get API key from environment or .env.local
require('dotenv').config({ path: '.env.local' })
const MODAL_API_KEY = process.env.MODAL_API_KEY

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

/**
 * Call Qwen 2.5 API
 */
async function callQwen(systemPrompt, userPrompt) {
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
  })

  if (!response.ok) {
    throw new Error(`Qwen API error: ${response.status}`)
  }

  const data = await response.json()
  let content = data.choices[0]?.message?.content || '{}'

  // Strip markdown code blocks if present
  content = content
    .replace(/^```json\n?/, '')
    .replace(/\n?```$/, '')
    .trim()

  return content
}

/**
 * Generate TTS audio for text (OpenAI-compatible endpoint)
 */
async function generateTTS(text, speakerId = 2) {
  const response = await fetch(CONFIG.VOICEVOX_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': MODAL_API_KEY,
    },
    body: JSON.stringify({
      model: 'voicevox',
      input: text.substring(0, 5000),
      voice: String(speakerId),
      speed: 1.0,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`VOICEVOX error: ${response.status} - ${errorText}`)
  }

  return await response.buffer()
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
 * Extract words from content
 */
function extractWords(content, limit = 20) {
  if (!content) return []

  const wordPattern = /[\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ff]+/g
  const matches = content.match(wordPattern) || []

  const freq = {}
  matches.forEach(w => {
    if (w.length >= 2) {
      freq[w] = (freq[w] || 0) + 1
    }
  })

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word)
}

/**
 * Main function
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║     NHK Article Reprocessor                                ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log('')
  console.log(`Article ID: ${ARTICLE_ID}`)
  console.log('')

  // Fetch article
  const doc = await db.collection('news_articles').doc(ARTICLE_ID).get()

  if (!doc.exists) {
    console.error('Article not found!')
    process.exit(1)
  }

  const article = { id: doc.id, ...doc.data() }
  console.log(`Title: ${article.title}`)
  console.log('')

  // Generate Translation
  console.log('📝 Generating translation...')
  const translationSystemPrompt = `You are an expert Japanese-English translator for language learners.
Return ONLY valid JSON (no markdown code blocks): { "title": "...", "summary": "...", "content": "...", "keyVocabulary": [{"word": "...", "meaning": "..."}], "grammarNotes": ["..."] }`

  const translationUserPrompt = `Translate this Japanese article to English:
Title: ${article.title}
Summary: ${article.summary || ''}
Content: ${article.content?.substring(0, 3000) || ''}

Provide educational translation with key vocabulary and grammar notes.`

  try {
    const translationResult = await callQwen(translationSystemPrompt, translationUserPrompt)
    const translationParsed = JSON.parse(translationResult)

    const translation = {
      articleId: article.id,
      title: {
        originalText: article.title,
        translatedText: translationParsed.title || '',
        type: 'title',
        mode: 'learning',
        confidence: 0.9,
        metadata: {
          keyVocabulary: translationParsed.keyVocabulary || [],
          grammarNotes: translationParsed.grammarNotes || [],
        },
      },
      summary: {
        originalText: article.summary || '',
        translatedText: translationParsed.summary || '',
        type: 'summary',
        mode: 'learning',
        confidence: 0.9,
      },
      content: {
        originalText: article.content || '',
        translatedText: translationParsed.content || '',
        type: 'content',
        mode: 'full',
        confidence: 0.9,
      },
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      costInfo: { estimatedCost: 0 },
    }

    await db.collection('news_article_translations').doc(article.id).set(translation)
    console.log('  ✅ Translation saved')
  } catch (error) {
    console.log(`  ❌ Translation failed: ${error.message}`)
  }

  // Generate Word Explanations
  console.log('')
  console.log('📚 Generating word explanations...')

  const words = extractWords(article.content, 20)
  console.log(`  Found ${words.length} words to explain`)

  if (words.length > 0) {
    try {
      const wordSystemPrompt = `You are a Japanese dictionary. For each word, provide reading, romaji, meaning, partOfSpeech, jlptLevel, and examples.
Return ONLY valid JSON array (no markdown): [{ "word": "...", "reading": "...", "romaji": "...", "meaning": "...", "partOfSpeech": "...", "jlptLevel": "N4", "examples": [{"japanese": "...", "translation": "..."}] }]`

      const wordResult = await callQwen(
        wordSystemPrompt,
        `Explain these Japanese words: ${words.join(', ')}`
      )
      const wordsParsed = JSON.parse(wordResult)

      await db
        .collection('news_article_word_explanations')
        .doc(article.id)
        .set({
          articleId: article.id,
          words: Array.isArray(wordsParsed) ? wordsParsed : wordsParsed.words || [],
          wordCount: words.length,
          generatedAt: admin.firestore.FieldValue.serverTimestamp(),
          costInfo: { estimatedCost: 0 },
        })
      console.log('  ✅ Word explanations saved')
    } catch (error) {
      console.log(`  ❌ Word explanations failed: ${error.message}`)
    }
  }

  // Generate TTS Audio
  console.log('')
  console.log('🔊 Generating TTS audio...')

  const audioUrls = {}

  if (article.title) {
    try {
      console.log('  Generating title audio...')
      const titleBuffer = await generateTTS(article.title)
      audioUrls.title = await uploadAudio(titleBuffer, article.id, 'title')
    } catch (error) {
      console.log(`  ❌ Title audio failed: ${error.message}`)
    }
  }

  if (article.summary) {
    try {
      console.log('  Generating summary audio...')
      const summaryBuffer = await generateTTS(article.summary)
      audioUrls.summary = await uploadAudio(summaryBuffer, article.id, 'summary')
    } catch (error) {
      console.log(`  ❌ Summary audio failed: ${error.message}`)
    }
  }

  if (article.content && article.content.length < 3000) {
    try {
      console.log('  Generating content audio...')
      const contentBuffer = await generateTTS(article.content)
      audioUrls.content = await uploadAudio(contentBuffer, article.id, 'content')
    } catch (error) {
      console.log(`  ❌ Content audio failed: ${error.message}`)
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
    console.log('  ✅ Audio URLs saved to article')
  }

  console.log('')
  console.log('✨ Article reprocessed successfully!')
}

// Run
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
