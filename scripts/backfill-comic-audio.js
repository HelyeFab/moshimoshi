#!/usr/bin/env node
/**
 * Backfill Comic Audio Script
 *
 * Generates missing audio for published comic episodes following the
 * sentence pre-generation pattern used by articles, stories, and books.
 *
 * Generates:
 * - Per-dialogue audio
 * - Per-narration audio
 * - Full episode audio (all dialogues + narrations combined)
 * - Stores in comic_sentence_data collection
 *
 * Usage:
 *   MODAL_API_KEY=xxx node scripts/backfill-comic-audio.js [--dry-run] [--repair]
 *
 * Examples:
 *   MODAL_API_KEY=xxx node scripts/backfill-comic-audio.js --dry-run    # Count what needs processing
 *   MODAL_API_KEY=xxx node scripts/backfill-comic-audio.js              # Full backfill
 *   MODAL_API_KEY=xxx node scripts/backfill-comic-audio.js --repair     # Fix missing audio
 */

const admin = require('firebase-admin')
const path = require('path')
const crypto = require('crypto')

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccountPath = path.join(__dirname, '../moshimoshi-service-account.json')
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
    projectId: 'moshimoshi-de237',
    storageBucket: 'moshimoshi-de237.firebasestorage.app',
  })
}

const db = admin.firestore()
const bucket = admin.storage().bucket()

// Get Modal API key from environment
const MODAL_API_KEY = process.env.MODAL_API_KEY

// Configuration - same as sentence backfill
const VOICEVOX_CONFIG = {
  endpoint: 'https://emmanuelfabiani23--voicevox-tts-serve.modal.run/v1/audio/speech',
  defaultVoice: '23', // Same voice as other content
  speed: 0.9, // Slightly faster for dialogue
}

// Parse command line arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const repairMode = args.includes('--repair')

/**
 * Generate hash for text (for storage paths)
 */
function hashText(text) {
  return crypto.createHash('md5').update(text).digest('hex').substring(0, 12)
}

/**
 * Call VOICEVOX TTS API to generate audio
 */
async function generateVoicevoxAudio(text, speed = VOICEVOX_CONFIG.speed) {
  if (!text || text.trim().length === 0) {
    return null
  }

  try {
    const response = await fetch(VOICEVOX_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': MODAL_API_KEY.trim(),
      },
      body: JSON.stringify({
        model: 'voicevox',
        input: text.trim(),
        voice: VOICEVOX_CONFIG.defaultVoice,
        speed,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`    VOICEVOX API error (${response.status}): ${errorText.substring(0, 100)}`)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    console.error(`    TTS generation failed: ${error.message}`)
    return null
  }
}

/**
 * Upload audio buffer to Firebase Storage
 */
async function uploadAudioToStorage(buffer, storagePath) {
  const file = bucket.file(storagePath)

  await file.save(buffer, {
    metadata: {
      contentType: 'audio/mpeg',
      cacheControl: 'public, max-age=31536000',
      metadata: {
        generatedBy: 'comic-backfill',
        provider: 'voicevox',
        voice: VOICEVOX_CONFIG.defaultVoice,
        generatedAt: new Date().toISOString(),
      },
    },
  })

  await file.makePublic()
  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`
}

/**
 * Generate audio and upload to storage
 */
async function generateAndUploadAudio(text, storagePath, speed = VOICEVOX_CONFIG.speed) {
  const buffer = await generateVoicevoxAudio(text, speed)
  if (!buffer) return null

  try {
    return await uploadAudioToStorage(buffer, storagePath)
  } catch (error) {
    console.error(`    Upload failed: ${error.message}`)
    return null
  }
}

/**
 * Process a single comic episode
 */
async function processEpisode(episodeDoc) {
  const episode = episodeDoc.data()
  const episodeId = episodeDoc.id

  console.log(`\n📖 Processing: ${episode.title} (${episodeId})`)

  // Check existing sentence data
  const sentenceDataRef = db.collection('comic_sentence_data').doc(episodeId)
  const existingData = await sentenceDataRef.get()

  if (existingData.exists && !repairMode) {
    console.log(`  ⏭️  Sentence data already exists (use --repair to update)`)
    return { updated: false, skipped: true }
  }

  if (dryRun) {
    console.log(`  📋 Would process ${episode.panels?.length || 0} panels`)
    return { updated: false, skipped: false, wouldProcess: true }
  }

  let updated = false
  const updatedPanels = JSON.parse(JSON.stringify(episode.panels || []))
  const allTextForFullAudio = []

  // Use flat structure matching ComicSentenceData interface from comicSentencePreGenerator.ts
  const dialogues = []
  const narrations = []

  // Process each panel
  for (let i = 0; i < updatedPanels.length; i++) {
    const panel = updatedPanels[i]
    const panelNumber = i + 1
    console.log(`  Panel ${panelNumber}/${updatedPanels.length}`)

    // Process dialogues
    if (panel.dialogues) {
      for (let j = 0; j < panel.dialogues.length; j++) {
        const dialogue = panel.dialogues[j]
        if (dialogue.textJa) {
          allTextForFullAudio.push(dialogue.textJa)

          const needsAudio = !dialogue.audioUrl || repairMode

          if (needsAudio) {
            console.log(`    🎤 Dialogue ${j + 1}: "${dialogue.textJa.substring(0, 30)}..."`)
            const textHash = hashText(dialogue.textJa)
            const storagePath = `comics/${episodeId}/audio/dialogue-${panelNumber}-${j + 1}-${textHash}.mp3`
            const audioUrl = await generateAndUploadAudio(dialogue.textJa, storagePath)

            if (audioUrl) {
              updatedPanels[i].dialogues[j].audioUrl = audioUrl
              updated = true
              console.log(`    ✅ Audio generated`)
            }

            // Rate limiting delay
            await new Promise(resolve => setTimeout(resolve, 300))
          }

          // Add to flat dialogues array (matching ComicSentenceData interface)
          dialogues.push({
            panelNumber,
            dialogueIndex: j,
            characterId: dialogue.characterId,
            characterName: dialogue.characterName,
            text: dialogue.textJa,
            textEn: dialogue.textEn,
            audioUrl: updatedPanels[i].dialogues[j].audioUrl || '',
            emotion: dialogue.emotion,
          })
        }
      }
    }

    // Process narration
    if (panel.narration?.textJa) {
      allTextForFullAudio.push(panel.narration.textJa)

      const needsAudio = !panel.narration.audioUrl || repairMode

      if (needsAudio) {
        console.log(`    📜 Narration: "${panel.narration.textJa.substring(0, 30)}..."`)
        const textHash = hashText(panel.narration.textJa)
        const storagePath = `comics/${episodeId}/audio/narration-${panelNumber}-${textHash}.mp3`
        const audioUrl = await generateAndUploadAudio(panel.narration.textJa, storagePath)

        if (audioUrl) {
          updatedPanels[i].narration = {
            ...panel.narration,
            audioUrl,
          }
          updated = true
          console.log(`    ✅ Narration audio generated`)
        }

        await new Promise(resolve => setTimeout(resolve, 300))
      }

      // Add to flat narrations array (matching ComicSentenceData interface)
      narrations.push({
        panelNumber,
        text: panel.narration.textJa,
        textEn: panel.narration.textEn,
        audioUrl: updatedPanels[i].narration?.audioUrl || '',
      })
    }
  }

  // Generate full episode audio
  let fullAudioUrl = episode.fullAudioUrl || ''
  const needsFullAudio = !fullAudioUrl || repairMode

  if (needsFullAudio && allTextForFullAudio.length > 0) {
    console.log(`  🎵 Generating full episode audio (${allTextForFullAudio.length} segments)...`)
    const fullText = allTextForFullAudio.join('。\n')
    const storagePath = `comics/${episodeId}/audio/full-episode.mp3`
    fullAudioUrl = await generateAndUploadAudio(fullText, storagePath, 0.85)

    if (fullAudioUrl) {
      updated = true
      console.log(`  ✅ Full episode audio generated`)
    }
  }

  // Build sentence data with flat structure (matching ComicSentenceData interface)
  const sentenceData = {
    episodeId,
    title: episode.title,
    titleJa: episode.titleJa,
    dialogues,
    narrations,
    fullAudioUrl,
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }

  // Update Firestore
  if (updated) {
    // Update comics collection
    await db.collection('comics').doc(episodeId).update({
      panels: updatedPanels,
      fullAudioUrl: fullAudioUrl || '',
      audioStatus: fullAudioUrl ? 'complete' : 'partial',
      audioProvider: 'voicevox',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    // Save sentence data (following the pattern from comicSentencePreGenerator.ts)
    await sentenceDataRef.set(sentenceData)

    console.log(`  💾 Episode and sentence data saved`)
  } else {
    console.log(`  ⏭️  No updates needed`)
  }

  return { updated, skipped: false }
}

/**
 * Main backfill function
 */
async function backfillComicAudio() {
  const modeLabel = repairMode ? ' (REPAIR MODE)' : ''

  console.log('🎬 Comic Audio Backfill Script' + modeLabel)
  console.log('==============================')
  console.log(`Dry Run: ${dryRun}`)
  console.log(`Repair Mode: ${repairMode}`)
  console.log('==============================\n')

  if (!MODAL_API_KEY) {
    console.error('❌ Error: MODAL_API_KEY environment variable is required')
    console.log('\nUsage: MODAL_API_KEY=xxx node scripts/backfill-comic-audio.js')
    process.exit(1)
  }

  try {
    // Get all published comics
    const comicsSnapshot = await db
      .collection('comics')
      .where('status', '==', 'published')
      .get()

    if (comicsSnapshot.empty) {
      console.log('No published comics found.')
      process.exit(0)
    }

    console.log(`Found ${comicsSnapshot.size} published comic(s)`)

    let updatedCount = 0
    let skippedCount = 0
    let errorCount = 0
    let wouldProcessCount = 0

    for (const doc of comicsSnapshot.docs) {
      try {
        const result = await processEpisode(doc)
        if (result.updated) updatedCount++
        if (result.skipped) skippedCount++
        if (result.wouldProcess) wouldProcessCount++
      } catch (error) {
        console.error(`  ❌ Error processing ${doc.id}:`, error.message)
        errorCount++
      }
    }

    console.log('\n==============================')
    console.log('📊 Summary:')
    console.log(`   Total episodes: ${comicsSnapshot.size}`)
    if (dryRun) {
      console.log(`   Would process: ${wouldProcessCount}`)
      console.log(`   Already done: ${skippedCount}`)
    } else {
      console.log(`   Updated: ${updatedCount}`)
      console.log(`   Skipped: ${skippedCount}`)
      console.log(`   Errors: ${errorCount}`)
    }
    console.log('\n✅ Backfill complete!')

    process.exit(0)
  } catch (error) {
    console.error('\n❌ Backfill failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run backfill
backfillComicAudio()
