/**
 * Comic Sentence Pre-Generator (Local Version)
 *
 * Pre-generates audio for comic dialogues and narrations
 * Used by the comic generation API route
 *
 * Following the same pattern as sentencePreGenerator.ts for stories/books
 */

import { adminFirestore, initAdmin } from '@/lib/firebase/admin'
import { getStorage } from 'firebase-admin/storage'
import crypto from 'crypto'

// Initialize Firebase Admin
initAdmin()

// VOICEVOX configuration
const VOICEVOX_CONFIG = {
  endpoint: 'https://emmanuelfabiani23--voicevox-tts-serve.modal.run/v1/audio/speech',
  defaultVoice: '23', // Same voice as other content
  speed: 0.9, // Slightly faster for dialogue
}

// Types
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
  generatedAt: Date
}

/**
 * Generate hash for text (for storage paths)
 */
function hashText(text: string, contentId: string, index: number): string {
  return crypto
    .createHash('md5')
    .update(`${contentId}-${index}-${text}`)
    .digest('hex')
}

/**
 * Generate VOICEVOX audio for a sentence
 */
async function generateSentenceAudio(
  sentence: string,
  contentId: string,
  sentenceIndex: number,
  modalApiKey: string
): Promise<string> {
  const sentenceHash = hashText(sentence, contentId, sentenceIndex)
  const storagePath = `sentence-audio/comic/${contentId}/${sentenceHash}.mp3`

  // Check if already exists
  const storage = getStorage()
  const bucket = storage.bucket()
  const file = bucket.file(storagePath)
  const [exists] = await file.exists()

  if (exists) {
    return `https://storage.googleapis.com/${bucket.name}/${storagePath}`
  }

  // Generate audio with VOICEVOX
  const response = await fetch(VOICEVOX_CONFIG.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': modalApiKey.trim(),
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

  // Upload to Firebase Storage
  await file.save(buffer, {
    metadata: {
      contentType: 'audio/mpeg',
      cacheControl: 'public, max-age=31536000',
      metadata: {
        generatedBy: 'comic-sentence-pregen',
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
 * Store sentence data for a comic episode
 */
async function storeSentenceDataForComic(
  episodeId: string,
  data: Omit<ComicSentenceData, 'generatedAt'>
): Promise<void> {
  const docRef = adminFirestore!.collection('comic_sentence_data').doc(episodeId)

  await docRef.set({
    ...data,
    generatedAt: new Date(),
  })

  console.log(`[ComicSentencePreGen] Sentence data stored for comic ${episodeId}`)
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
  titleJa: string,
  modalApiKey: string
): Promise<{ fullAudioUrl: string; dialogueCount: number; narrationCount: number }> {
  console.log(`[ComicSentencePreGen] Starting pre-generation for ${episodeId}`)

  const dialogueSentences: ComicDialogueSentence[] = []
  const narrationSentences: ComicNarrationSentence[] = []
  const allTextForFullAudio: string[] = []

  // Batching configuration (proven pattern from transcriptTranslationGenerator)
  const BATCH_SIZE = 3 // Conservative batch size for parallel processing
  const BATCH_DELAY_MS = 300 // Delay between batches to respect rate limits

  // Step 1: Collect all audio generation tasks
  interface AudioTask {
    type: 'dialogue' | 'narration'
    panelNumber: number
    dialogueIndex?: number
    text: string
    textEn: string
    characterId?: string
    characterName?: string
    emotion?: string
    sentenceIndex: number
  }

  const audioTasks: AudioTask[] = []

  for (const panel of panels) {
    // Collect dialogue tasks
    if (panel.dialogues) {
      for (let dIndex = 0; dIndex < panel.dialogues.length; dIndex++) {
        const dialogue = panel.dialogues[dIndex]
        if (dialogue.textJa) {
          allTextForFullAudio.push(dialogue.textJa)
          audioTasks.push({
            type: 'dialogue',
            panelNumber: panel.panelNumber,
            dialogueIndex: dIndex,
            text: dialogue.textJa,
            textEn: dialogue.textEn,
            characterId: dialogue.characterId,
            characterName: dialogue.characterName,
            emotion: dialogue.emotion,
            sentenceIndex: panel.panelNumber * 100 + dIndex,
          })
        }
      }
    }

    // Collect narration tasks
    if (panel.narration?.textJa) {
      allTextForFullAudio.push(panel.narration.textJa)
      audioTasks.push({
        type: 'narration',
        panelNumber: panel.panelNumber,
        text: panel.narration.textJa,
        textEn: panel.narration.textEn,
        sentenceIndex: panel.panelNumber * 100 + 99,
      })
    }
  }

  console.log(`[ComicSentencePreGen] Processing ${audioTasks.length} audio tasks in batches of ${BATCH_SIZE}`)

  // Step 2: Process tasks in parallel batches
  for (let i = 0; i < audioTasks.length; i += BATCH_SIZE) {
    const batch = audioTasks.slice(i, i + BATCH_SIZE)
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(audioTasks.length / BATCH_SIZE)

    console.log(`[ComicSentencePreGen] Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)`)

    // Process batch in parallel using Promise.allSettled for graceful error handling
    const batchPromises = batch.map(async (task) => {
      try {
        const audioUrl = await generateSentenceAudio(
          task.text,
          episodeId,
          task.sentenceIndex,
          modalApiKey
        )

        if (task.type === 'dialogue') {
          dialogueSentences.push({
            panelNumber: task.panelNumber,
            dialogueIndex: task.dialogueIndex!,
            characterId: task.characterId!,
            characterName: task.characterName!,
            text: task.text,
            textEn: task.textEn,
            audioUrl,
            emotion: task.emotion,
          })
          console.log(`✅ [ComicSentencePreGen] Dialogue ${task.panelNumber}-${task.dialogueIndex} audio generated`)
        } else {
          narrationSentences.push({
            panelNumber: task.panelNumber,
            text: task.text,
            textEn: task.textEn,
            audioUrl,
          })
          console.log(`✅ [ComicSentencePreGen] Narration ${task.panelNumber} audio generated`)
        }

        return { success: true, task }
      } catch (error) {
        console.error(`❌ [ComicSentencePreGen] Error generating ${task.type} audio for panel ${task.panelNumber}:`, error)

        // Add empty audio entry on failure
        if (task.type === 'dialogue') {
          dialogueSentences.push({
            panelNumber: task.panelNumber,
            dialogueIndex: task.dialogueIndex!,
            characterId: task.characterId!,
            characterName: task.characterName!,
            text: task.text,
            textEn: task.textEn,
            audioUrl: '',
            emotion: task.emotion,
          })
        } else {
          narrationSentences.push({
            panelNumber: task.panelNumber,
            text: task.text,
            textEn: task.textEn,
            audioUrl: '',
          })
        }

        return { success: false, task, error }
      }
    })

    // Wait for batch to complete
    const results = await Promise.allSettled(batchPromises)

    // Log batch results
    const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.success).length
    const failed = results.filter(r => r.status === 'fulfilled' && !r.value.success).length
    console.log(`[ComicSentencePreGen] Batch ${batchNumber} complete: ${succeeded} succeeded, ${failed} failed`)

    // Delay between batches to respect rate limits (not needed for last batch)
    if (i + BATCH_SIZE < audioTasks.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS))
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
        9999,
        modalApiKey
      )
      console.log(`[ComicSentencePreGen] Full episode audio generated`)
    } catch (error) {
      console.error(`[ComicSentencePreGen] Error generating full episode audio:`, error)
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

  console.log(`[ComicSentencePreGen] Pre-generation completed: ${dialogueSentences.length} dialogues, ${narrationSentences.length} narrations`)

  return {
    fullAudioUrl,
    dialogueCount: dialogueSentences.length,
    narrationCount: narrationSentences.length,
  }
}
