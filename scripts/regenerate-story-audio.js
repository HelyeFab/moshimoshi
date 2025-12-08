/**
 * Regenerate per-page audio for stories missing audio
 * Run with: node scripts/regenerate-story-audio.js
 */

const admin = require('firebase-admin')
const serviceAccount = require('../moshimoshi-service-account.json')
require('dotenv').config({ path: '.env.local' })

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'moshimoshi-de237.firebasestorage.app',
  })
}

const db = admin.firestore()
const storage = admin.storage()

// TTS Configuration
const VOICEVOX_TTS_ENDPOINT =
  'https://emmanuelfabiani23--voicevox-tts-serve.modal.run/v1/audio/speech'
const VOICEVOX_VOICE_ID = '11' // Nemo - natural female voice
const MODAL_API_KEY = process.env.MODAL_API_KEY

// Stories to regenerate
const STORY_IDS = [
  'story_1765042854197_8onZzlQg3tQxkw8pinSF9ow4Q6j2',
  'story_1765047642422_8onZzlQg3tQxkw8pinSF9ow4Q6j2',
  'story_1765056918654_scheduler-system',
]

/**
 * Clean text for TTS (remove HTML tags, ruby annotations, etc.)
 */
function cleanTextForTTS(text) {
  return text
    .replace(/<ruby>([^<]+)<rt>[^<]+<\/rt><\/ruby>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\{\{MOODKANJI\}\}/g, '')
    .replace(/\{\{\/MOODKANJI\}\}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Call VOICEVOX TTS API
 */
async function generateAudio(text) {
  const response = await fetch(VOICEVOX_TTS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': MODAL_API_KEY,
    },
    body: JSON.stringify({
      model: 'voicevox',
      input: text,
      voice: VOICEVOX_VOICE_ID,
      speed: 0.95,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`VOICEVOX API error (${response.status}): ${errorText}`)
  }

  return Buffer.from(await response.arrayBuffer())
}

/**
 * Upload audio to Firebase Storage
 */
async function uploadToStorage(audioBuffer, storagePath) {
  const bucket = storage.bucket()
  const file = bucket.file(storagePath)

  await file.save(audioBuffer, {
    metadata: {
      contentType: 'audio/mpeg',
      cacheControl: 'public, max-age=31536000',
    },
  })

  await file.makePublic()
  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`
}

/**
 * Process a single story
 */
async function processStory(storyId) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Processing: ${storyId}`)
  console.log('='.repeat(60))

  // Fetch story
  const storyDoc = await db.collection('stories').doc(storyId).get()
  if (!storyDoc.exists) {
    console.log(`  [ERROR] Story not found: ${storyId}`)
    return { success: false, error: 'Story not found' }
  }

  const story = storyDoc.data()
  const title = story.titleJa || story.title || 'Untitled'
  const pages = story.pages || []

  console.log(`  Title: ${title}`)
  console.log(`  Pages: ${pages.length}`)

  const results = {
    fullAudio: null,
    pageAudio: [],
    errors: [],
  }

  // Generate full story audio
  console.log(`\n  Generating full story audio...`)
  try {
    const fullText = pages
      .map(p => cleanTextForTTS(p.text || p.textJa || ''))
      .filter(t => t.length > 0)
      .join('\n\n')

    if (fullText.length > 0) {
      const audioBuffer = await generateAudio(fullText)
      const storagePath = `ai-stories/${storyId}/audio/full-story.mp3`
      const url = await uploadToStorage(audioBuffer, storagePath)
      results.fullAudio = { url, textLength: fullText.length }
      console.log(`  [OK] Full audio: ${(audioBuffer.length / 1024).toFixed(1)} KB`)
    }
  } catch (error) {
    const errorMsg = `Full audio failed: ${error.message}`
    results.errors.push(errorMsg)
    console.log(`  [ERROR] ${errorMsg}`)
  }

  // Generate per-page audio
  console.log(`\n  Generating per-page audio...`)
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    const pageNumber = page.pageNumber || i + 1
    const pageText = cleanTextForTTS(page.text || page.textJa || '')

    if (pageText.length === 0) {
      console.log(`  [SKIP] Page ${pageNumber}: No text`)
      continue
    }

    try {
      const audioBuffer = await generateAudio(pageText)
      const storagePath = `ai-stories/${storyId}/audio/page-${pageNumber}.mp3`
      const url = await uploadToStorage(audioBuffer, storagePath)
      results.pageAudio.push({ pageNumber, url, textLength: pageText.length })
      console.log(`  [OK] Page ${pageNumber}: ${(audioBuffer.length / 1024).toFixed(1)} KB`)

      // Small delay between requests
      if (i < pages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } catch (error) {
      const errorMsg = `Page ${pageNumber} failed: ${error.message}`
      results.errors.push(errorMsg)
      console.log(`  [ERROR] ${errorMsg}`)
    }
  }

  // Update Firestore
  console.log(`\n  Updating Firestore...`)
  try {
    const updateData = {
      audioGeneratedAt: new Date(),
      audioProvider: 'voicevox',
      audioVoice: 'nemo',
    }

    if (results.fullAudio?.url) {
      updateData.fullAudioUrl = results.fullAudio.url
    }

    // Update pages with audio URLs
    if (results.pageAudio.length > 0) {
      const pagesWithAudio = pages.map((page, index) => {
        const pageNumber = page.pageNumber || index + 1
        const pageAudioResult = results.pageAudio.find(pa => pa.pageNumber === pageNumber)
        return {
          ...page,
          audioUrl: pageAudioResult?.url || page.audioUrl,
        }
      })
      updateData.pages = pagesWithAudio
    }

    // Determine audio status
    const hasFullAudio = !!results.fullAudio?.url
    const hasAllPageAudio = results.pageAudio.length === pages.length

    if (hasFullAudio && hasAllPageAudio) {
      updateData.audioStatus = 'complete'
    } else if (hasFullAudio || results.pageAudio.length > 0) {
      updateData.audioStatus = 'partial'
    } else {
      updateData.audioStatus = 'failed'
      updateData.audioError = results.errors.join('; ')
    }

    await db.collection('stories').doc(storyId).update(updateData)
    console.log(`  [OK] Firestore updated (status: ${updateData.audioStatus})`)

    return {
      success: true,
      storyId,
      title,
      fullAudio: !!results.fullAudio,
      pageAudio: results.pageAudio.length,
      totalPages: pages.length,
      errors: results.errors,
    }
  } catch (error) {
    console.log(`  [ERROR] Firestore update failed: ${error.message}`)
    return { success: false, error: error.message }
  }
}

async function main() {
  console.log('Story Audio Regeneration Script')
  console.log('================================\n')

  if (!MODAL_API_KEY) {
    console.error('ERROR: MODAL_API_KEY not found in .env.local')
    process.exit(1)
  }

  console.log(`Stories to process: ${STORY_IDS.length}`)

  const results = []
  for (const storyId of STORY_IDS) {
    const result = await processStory(storyId)
    results.push(result)

    // Delay between stories
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))

  const successful = results.filter(r => r.success)
  const failed = results.filter(r => !r.success)

  console.log(`\nSuccessful: ${successful.length}/${results.length}`)
  successful.forEach(r => {
    console.log(`  [OK] ${r.title}`)
    console.log(`       Full audio: ${r.fullAudio ? 'Yes' : 'No'}`)
    console.log(`       Page audio: ${r.pageAudio}/${r.totalPages}`)
  })

  if (failed.length > 0) {
    console.log(`\nFailed: ${failed.length}`)
    failed.forEach(r => {
      console.log(`  [FAILED] ${r.storyId}: ${r.error}`)
    })
  }

  console.log('\nDone!')
  process.exit(0)
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
