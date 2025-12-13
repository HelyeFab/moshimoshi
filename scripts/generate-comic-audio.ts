/**
 * Generate audio for a comic draft
 * Usage: npx tsx scripts/generate-comic-audio.ts <draftId>
 */

import * as admin from 'firebase-admin'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import * as crypto from 'crypto'
import * as serviceAccount from '../moshimoshi-service-account.json'

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  initializeApp({
    credential: cert(serviceAccount as admin.ServiceAccount),
    storageBucket: 'moshimoshi-de237.firebasestorage.app',
  })
}

const db = getFirestore()
const storage = getStorage()

// VOICEVOX configuration
const VOICEVOX_CONFIG = {
  endpoint: 'https://emmanuelfabiani23--voicevox-tts-serve.modal.run/v1/audio/speech',
  defaultVoice: '23',
  speed: 0.9,
}

const MODAL_API_KEY = process.env.MODAL_API_KEY || 'ABpCKvpQru292DdXC5wm2tPbS6wZR3edeqlqt6A'

function hashText(text: string, contentId: string, index: number): string {
  return crypto
    .createHash('md5')
    .update(`${contentId}-${index}-${text}`)
    .digest('hex')
}

async function generateSentenceAudio(
  sentence: string,
  contentId: string,
  sentenceIndex: number
): Promise<string> {
  const sentenceHash = hashText(sentence, contentId, sentenceIndex)
  const storagePath = `sentence-audio/comic/${contentId}/${sentenceHash}.mp3`

  const bucket = storage.bucket()
  const file = bucket.file(storagePath)
  const [exists] = await file.exists()

  if (exists) {
    console.log(`  Audio already exists: ${storagePath}`)
    return `https://storage.googleapis.com/${bucket.name}/${storagePath}`
  }

  console.log(`  Generating audio for: "${sentence.substring(0, 30)}..."`)

  const response = await fetch(VOICEVOX_CONFIG.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': MODAL_API_KEY,
    },
    body: JSON.stringify({
      model: 'voicevox',
      input: sentence.trim(),
      voice: VOICEVOX_CONFIG.defaultVoice,
      speed: VOICEVOX_CONFIG.speed,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`VOICEVOX API error (${response.status}): ${errorText.substring(0, 100)}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  await file.save(buffer, {
    metadata: {
      contentType: 'audio/mpeg',
      cacheControl: 'public, max-age=31536000',
      metadata: {
        generatedBy: 'comic-audio-script',
        provider: 'voicevox',
        voice: VOICEVOX_CONFIG.defaultVoice,
        generatedAt: new Date().toISOString(),
      },
    },
  })

  await file.makePublic()
  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`
}

async function generateAudioForDraft(draftId: string) {
  console.log(`\n=== Generating Audio for Draft: ${draftId} ===\n`)

  // Get the draft
  const draftDoc = await db.collection('comic_drafts').doc(draftId).get()
  if (!draftDoc.exists) {
    throw new Error(`Draft not found: ${draftId}`)
  }

  const draft = draftDoc.data()!
  const { panels, outline, seriesId, episodeNumber } = draft

  console.log(`Episode ${episodeNumber}: ${outline?.title || draft.title}`)
  console.log(`Panels: ${panels?.length || 0}`)

  if (!panels?.length) {
    throw new Error('No panels in draft')
  }

  const episodeId = `${seriesId || 'moshi-goes-to-japan'}-ep${String(episodeNumber).padStart(3, '0')}`
  console.log(`Episode ID: ${episodeId}\n`)

  const dialogueSentences: any[] = []
  const narrationSentences: any[] = []
  const allTextForFullAudio: string[] = []

  // Process each panel
  for (let pIndex = 0; pIndex < panels.length; pIndex++) {
    const panel = panels[pIndex]
    const panelNumber = pIndex + 1
    console.log(`\nPanel ${panelNumber}:`)

    // Process dialogues
    if (panel.dialogues?.length) {
      for (let dIndex = 0; dIndex < panel.dialogues.length; dIndex++) {
        const dialogue = panel.dialogues[dIndex]
        if (dialogue.textJa) {
          allTextForFullAudio.push(dialogue.textJa)

          try {
            const audioUrl = await generateSentenceAudio(
              dialogue.textJa,
              episodeId,
              panelNumber * 100 + dIndex
            )

            dialogueSentences.push({
              panelNumber,
              dialogueIndex: dIndex,
              characterId: dialogue.characterId || 'moshi',
              characterName: dialogue.characterName || 'Moshi',
              text: dialogue.textJa,
              textEn: dialogue.textEn || '',
              audioUrl,
              emotion: dialogue.emotion,
            })

            console.log(`  ✓ Dialogue ${dIndex + 1} audio generated`)
          } catch (error) {
            console.error(`  ✗ Dialogue ${dIndex + 1} failed:`, error)
            dialogueSentences.push({
              panelNumber,
              dialogueIndex: dIndex,
              characterId: dialogue.characterId || 'moshi',
              characterName: dialogue.characterName || 'Moshi',
              text: dialogue.textJa,
              textEn: dialogue.textEn || '',
              audioUrl: '',
              emotion: dialogue.emotion,
            })
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 500))
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
          panelNumber * 100 + 99
        )

        narrationSentences.push({
          panelNumber,
          text: panel.narration.textJa,
          textEn: panel.narration.textEn || '',
          audioUrl,
        })

        console.log(`  ✓ Narration audio generated`)
      } catch (error) {
        console.error(`  ✗ Narration failed:`, error)
        narrationSentences.push({
          panelNumber,
          text: panel.narration.textJa,
          textEn: panel.narration.textEn || '',
          audioUrl: '',
        })
      }

      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  // Generate full episode audio
  console.log('\nGenerating full episode audio...')
  let fullAudioUrl = ''
  if (allTextForFullAudio.length > 0) {
    try {
      const fullText = allTextForFullAudio.join('。\n')
      fullAudioUrl = await generateSentenceAudio(fullText, episodeId, 9999)
      console.log('✓ Full episode audio generated')
    } catch (error) {
      console.error('✗ Full episode audio failed:', error)
    }
  }

  // Store sentence data
  console.log('\nStoring sentence data...')
  await db.collection('comic_sentence_data').doc(episodeId).set({
    episodeId,
    title: outline?.title || draft.title || `Episode ${episodeNumber}`,
    titleJa: outline?.titleJa || '',
    dialogues: dialogueSentences,
    narrations: narrationSentences,
    fullAudioUrl,
    generatedAt: new Date(),
  })

  // Update panels in draft with audio URLs
  console.log('Updating draft panels with audio URLs...')
  const updatedPanels = panels.map((panel: any, pIndex: number) => {
    const panelNumber = pIndex + 1

    const updatedDialogues = panel.dialogues?.map((dialogue: any, dIndex: number) => {
      const sentenceDialogue = dialogueSentences.find(
        d => d.panelNumber === panelNumber && d.dialogueIndex === dIndex
      )
      return {
        ...dialogue,
        audioUrl: sentenceDialogue?.audioUrl || dialogue.audioUrl || '',
      }
    })

    const sentenceNarration = narrationSentences.find(n => n.panelNumber === panelNumber)
    const updatedNarration = panel.narration
      ? {
          ...panel.narration,
          audioUrl: sentenceNarration?.audioUrl || panel.narration.audioUrl || '',
        }
      : null

    return {
      ...panel,
      dialogues: updatedDialogues,
      narration: updatedNarration,
    }
  })

  await db.collection('comic_drafts').doc(draftId).update({
    panels: updatedPanels,
    fullAudioUrl,
    audioStatus: fullAudioUrl ? 'complete' : 'partial',
    audioProvider: 'voicevox',
    currentStep: 'audio',
    progress: 95,
    updatedAt: new Date(),
  })

  console.log('\n=== Audio Generation Complete ===')
  console.log(`Dialogues: ${dialogueSentences.length}`)
  console.log(`Narrations: ${narrationSentences.length}`)
  console.log(`Full audio: ${fullAudioUrl ? 'Yes' : 'No'}`)
}

// Main
const draftId = process.argv[2] || 'comic_draft_1765621513217_2'
generateAudioForDraft(draftId)
  .then(() => {
    console.log('\nDone!')
    process.exit(0)
  })
  .catch(err => {
    console.error('\nError:', err)
    process.exit(1)
  })
