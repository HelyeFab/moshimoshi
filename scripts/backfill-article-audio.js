/**
 * Backfill Script - Generate Missing Article Audio
 *
 * This script finds all news articles missing audio files and generates them
 * using VOICEVOX TTS via Modal.
 *
 * Usage:
 *   node scripts/backfill-article-audio.js
 *   node scripts/backfill-article-audio.js --dry-run
 *   node scripts/backfill-article-audio.js --batch-size=5
 *   node scripts/backfill-article-audio.js --content-only
 */

const admin = require('firebase-admin')
const path = require('path')

// Load service account
const serviceAccountPath = path.join(__dirname, '..', 'moshimoshi-service-account.json')
const serviceAccount = require(serviceAccountPath)

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'moshimoshi-de237.firebasestorage.app',
  })
}

const db = admin.firestore()
const storage = admin.storage()

// Configuration
const VOICEVOX_TTS_ENDPOINT =
  'https://emmanuelfabiani23--voicevox-tts-serve.modal.run/v1/audio/speech'
const MODAL_API_KEY = process.env.MODAL_API_KEY

if (!MODAL_API_KEY) {
  console.error('❌ MODAL_API_KEY environment variable is required')
  console.error('   Set it with: export MODAL_API_KEY=your_key_here')
  process.exit(1)
}

const DEFAULT_VOICE = '23' // Energetic female
const MAX_TEXT_LENGTH = 5000
const DELAY_BETWEEN_ARTICLES_MS = 2000 // 2 seconds between articles
const DELAY_BETWEEN_AUDIO_MS = 500 // 500ms between audio types

// Parse CLI arguments
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const CONTENT_ONLY = args.includes('--content-only')
const batchSizeArg = args.find(a => a.startsWith('--batch-size='))
const BATCH_SIZE = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : 10

/**
 * Call VOICEVOX TTS API to generate audio
 */
async function generateAudio(text) {
  const truncatedText = text.length > MAX_TEXT_LENGTH ? text.substring(0, MAX_TEXT_LENGTH) : text

  const response = await fetch(VOICEVOX_TTS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': MODAL_API_KEY.trim(),
    },
    body: JSON.stringify({
      model: 'voicevox',
      input: truncatedText,
      voice: DEFAULT_VOICE,
      speed: 0.85,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`VOICEVOX TTS API error (${response.status}): ${errorText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Upload audio buffer to Firebase Storage
 */
async function uploadAudio(audioBuffer, articleId, source, audioType) {
  const bucket = storage.bucket()
  const storagePath = `news-audio/${source}/${articleId}/${audioType}.mp3`
  const file = bucket.file(storagePath)

  await file.save(audioBuffer, {
    metadata: {
      contentType: 'audio/mpeg',
      cacheControl: 'public, max-age=31536000',
      metadata: {
        articleId,
        source,
        provider: 'voicevox',
        voice: DEFAULT_VOICE,
        audioType,
        generatedAt: new Date().toISOString(),
        generatedBy: 'backfill-script',
      },
    },
  })

  await file.makePublic()
  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`
}

/**
 * Process a single article
 */
async function processArticle(article) {
  const generated = []
  const errors = []

  const needsTitle = !article.generatedTitleAudioUrl && !CONTENT_ONLY
  const needsSummary = !article.generatedSummaryAudioUrl && !CONTENT_ONLY
  const needsContent = !article.generatedContentAudioUrl

  if (!needsTitle && !needsSummary && !needsContent) {
    return { success: true, generated: [], errors: [] }
  }

  console.log(`  📝 Processing: ${article.title?.substring(0, 50)}...`)

  const updateData = {}

  // Generate title audio
  if (needsTitle && article.title) {
    try {
      console.log(`    🎵 Generating title audio...`)
      if (!DRY_RUN) {
        const audioBuffer = await generateAudio(article.title)
        const url = await uploadAudio(audioBuffer, article.id, article.source, 'title')
        updateData.generatedTitleAudioUrl = url
        generated.push('title')
        console.log(`    ✅ Title audio generated`)
      } else {
        console.log(`    🔍 [DRY RUN] Would generate title audio`)
        generated.push('title')
      }
      await sleep(DELAY_BETWEEN_AUDIO_MS)
    } catch (error) {
      const msg = `Title audio failed: ${error.message || 'Unknown'}`
      errors.push(msg)
      console.log(`    ❌ ${msg}`)
    }
  }

  // Generate summary audio
  if (needsSummary && article.summary) {
    try {
      console.log(`    🎵 Generating summary audio...`)
      if (!DRY_RUN) {
        const audioBuffer = await generateAudio(article.summary)
        const url = await uploadAudio(audioBuffer, article.id, article.source, 'summary')
        updateData.generatedSummaryAudioUrl = url
        generated.push('summary')
        console.log(`    ✅ Summary audio generated`)
      } else {
        console.log(`    🔍 [DRY RUN] Would generate summary audio`)
        generated.push('summary')
      }
      await sleep(DELAY_BETWEEN_AUDIO_MS)
    } catch (error) {
      const msg = `Summary audio failed: ${error.message || 'Unknown'}`
      errors.push(msg)
      console.log(`    ❌ ${msg}`)
    }
  }

  // Generate content audio
  if (needsContent && article.content) {
    try {
      console.log(`    🎵 Generating content audio (${article.content.length} chars)...`)
      if (!DRY_RUN) {
        const audioBuffer = await generateAudio(article.content)
        const url = await uploadAudio(audioBuffer, article.id, article.source, 'content')
        updateData.generatedContentAudioUrl = url
        generated.push('content')
        console.log(`    ✅ Content audio generated`)
      } else {
        console.log(`    🔍 [DRY RUN] Would generate content audio`)
        generated.push('content')
      }
    } catch (error) {
      const msg = `Content audio failed: ${error.message || 'Unknown'}`
      errors.push(msg)
      console.log(`    ❌ ${msg}`)
    }
  }

  // Update Firestore
  if (!DRY_RUN && Object.keys(updateData).length > 0) {
    updateData.audioGeneratedAt = admin.firestore.FieldValue.serverTimestamp()
    updateData.audioProvider = 'voicevox'
    updateData.audioVoice = DEFAULT_VOICE

    // Determine status
    const hasTitle = updateData.generatedTitleAudioUrl || article.generatedTitleAudioUrl
    const hasSummary = updateData.generatedSummaryAudioUrl || article.generatedSummaryAudioUrl
    const hasContent = updateData.generatedContentAudioUrl || article.generatedContentAudioUrl

    if (hasTitle && hasSummary && hasContent) {
      updateData.audioStatus = 'generated'
    } else if (hasTitle || hasSummary || hasContent) {
      updateData.audioStatus = 'partial'
    }

    await db.collection('news_articles').doc(article.id).update(updateData)
  }

  return {
    success: errors.length === 0,
    generated,
    errors,
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Main backfill function
 */
async function backfillAudio() {
  console.log('🚀 Article Audio Backfill Script')
  console.log('================================')
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '⚡ LIVE (making changes)'}`)
  console.log(`Audio scope: ${CONTENT_ONLY ? 'Content only' : 'Title + Summary + Content'}`)
  console.log(`Batch size: ${BATCH_SIZE}`)
  console.log('')

  // Find articles needing audio
  const snapshot = await db.collection('news_articles').get()

  const articlesNeedingAudio = []

  snapshot.forEach(doc => {
    const data = doc.data()
    const article = {
      id: doc.id,
      title: data.title || '',
      summary: data.summary || '',
      content: data.content || '',
      source: data.source || 'NHK-Easy',
      nhkAudioUrl: data.nhkAudioUrl,
      generatedTitleAudioUrl: data.generatedTitleAudioUrl,
      generatedSummaryAudioUrl: data.generatedSummaryAudioUrl,
      generatedContentAudioUrl: data.generatedContentAudioUrl,
      audioStatus: data.audioStatus,
    }

    // Check what's missing
    const missingTitle = !article.generatedTitleAudioUrl && !CONTENT_ONLY
    const missingSummary = !article.generatedSummaryAudioUrl && !CONTENT_ONLY
    const missingContent = !article.generatedContentAudioUrl

    if (missingTitle || missingSummary || missingContent) {
      articlesNeedingAudio.push(article)
    }
  })

  console.log(`📊 Found ${articlesNeedingAudio.length} articles needing audio generation`)
  console.log('')

  if (articlesNeedingAudio.length === 0) {
    console.log('✅ All articles have complete audio!')
    return
  }

  // Process in batches
  let totalGenerated = 0
  let totalErrors = 0
  let processed = 0

  for (let i = 0; i < articlesNeedingAudio.length; i += BATCH_SIZE) {
    const batch = articlesNeedingAudio.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(articlesNeedingAudio.length / BATCH_SIZE)

    console.log(`\n📦 Batch ${batchNum}/${totalBatches} (${batch.length} articles)`)
    console.log('─'.repeat(50))

    for (const article of batch) {
      processed++
      console.log(`\n[${processed}/${articlesNeedingAudio.length}] Article: ${article.id}`)

      const result = await processArticle(article)
      totalGenerated += result.generated.length
      totalErrors += result.errors.length

      // Delay between articles
      if (processed < articlesNeedingAudio.length) {
        await sleep(DELAY_BETWEEN_ARTICLES_MS)
      }
    }
  }

  // Summary
  console.log('\n')
  console.log('═'.repeat(50))
  console.log('📊 BACKFILL COMPLETE')
  console.log('═'.repeat(50))
  console.log(`Total articles processed: ${processed}`)
  console.log(`Audio files generated: ${totalGenerated}`)
  console.log(`Errors: ${totalErrors}`)
  if (DRY_RUN) {
    console.log('\n🔍 This was a DRY RUN - no changes were made')
    console.log('   Run without --dry-run to generate audio')
  }
}

// Run the backfill
backfillAudio()
  .then(() => {
    console.log('\n✅ Done!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  })
