/**
 * Story Audio Generator - TTS utility for AI-generated stories
 * Uses VOICEVOX TTS API (via Modal) for high-quality FREE Japanese audio
 * Mirrors the news article audio generation approach
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore, initAdmin } from '@/lib/firebase/admin'
import { getStorage } from 'firebase-admin/storage'

// Initialize Firebase Admin
initAdmin()
const storage = getStorage()

export const runtime = 'nodejs'
export const maxDuration = 120 // 2 minutes for full story audio

// TTS API configuration - Using Modal VOICEVOX (FREE, high-quality Japanese)
const VOICEVOX_TTS_ENDPOINT =
  'https://emmanuelfabiani23--voicevox-tts-serve.modal.run/v1/audio/speech'

// VOICEVOX voices (high quality Japanese TTS)
// Speaker IDs: 1=四国めたん, 3=ずんだもん, 11=玄野武宏(Nemo), 13=青山龍星
const VOICEVOX_VOICES = {
  nemo: { id: '11', name: 'Nemo (玄野武宏)', description: 'Natural female voice - recommended' },
  zundamon: { id: '3', name: 'Zundamon (ずんだもん)', description: 'Cute mascot voice' },
  metan: { id: '1', name: 'Metan (四国めたん)', description: 'Gentle female voice' },
  ryusei: { id: '13', name: 'Ryusei (青山龍星)', description: 'Male voice' },
}

const DEFAULT_VOICE = 'nemo'
const MAX_TEXT_LENGTH = 10000 // 10K chars max for full story

type AudioType = 'full' | 'page'

interface AudioGenerationResult {
  url: string
  provider: 'voicevox'
  voice: string
  generatedAt: Date
  textLength: number
  audioType: AudioType
  pageNumber?: number
}

/**
 * Clean text for TTS (remove HTML tags, ruby annotations, etc.)
 */
function cleanTextForTTS(text: string): string {
  return (
    text
      // Remove ruby/furigana tags but keep the kanji
      .replace(/<ruby>([^<]+)<rt>[^<]+<\/rt><\/ruby>/g, '$1')
      // Remove any other HTML tags
      .replace(/<[^>]+>/g, '')
      // Remove moodboard kanji markers
      .replace(/\{\{MOODKANJI\}\}/g, '')
      .replace(/\{\{\/MOODKANJI\}\}/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/**
 * Call VOICEVOX TTS API (via Modal) to generate audio
 */
async function callVoicevoxTTS(text: string, voiceId: string): Promise<Buffer> {
  const apiKey = process.env.MODAL_API_KEY
  if (!apiKey) {
    throw new Error('MODAL_API_KEY not configured')
  }

  const response = await fetch(VOICEVOX_TTS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey.trim(),
    },
    body: JSON.stringify({
      model: 'voicevox',
      input: text,
      voice: voiceId,
      speed: 0.95, // Slightly slower for language learning
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
async function uploadToFirebaseStorage(
  audioBuffer: Buffer,
  storagePath: string,
  metadata: Record<string, string>
): Promise<string> {
  const bucket = storage.bucket()
  const file = bucket.file(storagePath)

  await file.save(audioBuffer, {
    metadata: {
      contentType: 'audio/mpeg',
      cacheControl: 'public, max-age=31536000', // 1 year
      metadata,
    },
  })

  await file.makePublic()
  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`
}

/**
 * Generate audio for a single text segment
 */
async function generateAudio(
  text: string,
  storyId: string,
  audioType: AudioType,
  voiceId: string,
  pageNumber?: number
): Promise<AudioGenerationResult> {
  const cleanText = cleanTextForTTS(text)

  if (!cleanText || cleanText.length === 0) {
    throw new Error('No valid text to convert to speech')
  }

  // Truncate if too long
  const finalText =
    cleanText.length > MAX_TEXT_LENGTH ? cleanText.substring(0, MAX_TEXT_LENGTH) : cleanText

  console.log(
    `[StoryAudio] Generating ${audioType} audio for story ${storyId}, ${finalText.length} chars`
  )

  // Generate audio with VOICEVOX
  const audioBuffer = await callVoicevoxTTS(finalText, voiceId)

  // Upload to Firebase Storage
  const fileName =
    audioType === 'full'
      ? `ai-stories/${storyId}/audio/full-story.mp3`
      : `ai-stories/${storyId}/audio/page-${pageNumber}.mp3`

  const publicUrl = await uploadToFirebaseStorage(audioBuffer, fileName, {
    storyId,
    audioType,
    voice: voiceId,
    textLength: finalText.length.toString(),
    generatedAt: new Date().toISOString(),
    provider: 'voicevox',
    ...(pageNumber !== undefined && { pageNumber: pageNumber.toString() }),
  })

  console.log(`[StoryAudio] Audio uploaded: ${publicUrl}`)

  return {
    url: publicUrl,
    provider: 'voicevox',
    voice: voiceId,
    generatedAt: new Date(),
    textLength: finalText.length,
    audioType,
    pageNumber,
  }
}

/**
 * POST - Generate audio for a story (full story + per-page)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userDoc = await adminFirestore!.collection('users').doc(session.uid).get()
    const userData = userDoc?.data()
    if (!userData?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const {
      storyId,
      pages,
      voice = DEFAULT_VOICE,
      generateFullAudio = true,
      generatePageAudio = true,
    } = body

    if (!storyId) {
      return NextResponse.json({ error: 'Story ID is required' }, { status: 400 })
    }

    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return NextResponse.json({ error: 'Pages array is required' }, { status: 400 })
    }

    // Get voice ID
    const voiceConfig =
      VOICEVOX_VOICES[voice as keyof typeof VOICEVOX_VOICES] || VOICEVOX_VOICES[DEFAULT_VOICE]
    const voiceId = voiceConfig.id

    const results: {
      fullAudio?: AudioGenerationResult
      pageAudio: AudioGenerationResult[]
      errors: string[]
    } = {
      pageAudio: [],
      errors: [],
    }

    // Generate full story audio (all pages concatenated)
    if (generateFullAudio) {
      try {
        const fullText = pages
          .map((p: any) => cleanTextForTTS(p.text || p.textJa || ''))
          .filter((t: string) => t.length > 0)
          .join('\n\n') // Double newline between pages for natural pause

        if (fullText.length > 0) {
          results.fullAudio = await generateAudio(fullText, storyId, 'full', voiceId)
        }
      } catch (error) {
        const errorMsg = `Full audio generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        results.errors.push(errorMsg)
        console.error(`[StoryAudio] ${errorMsg}`)
      }
    }

    // Generate per-page audio
    if (generatePageAudio) {
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i]
        const pageNumber = page.pageNumber || i + 1
        const pageText = page.text || page.textJa || ''

        try {
          if (cleanTextForTTS(pageText).length > 0) {
            const pageResult = await generateAudio(pageText, storyId, 'page', voiceId, pageNumber)
            results.pageAudio.push(pageResult)
          }
        } catch (error) {
          const errorMsg = `Page ${pageNumber} audio failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          results.errors.push(errorMsg)
          console.error(`[StoryAudio] ${errorMsg}`)
        }

        // Small delay between requests to avoid rate limiting
        if (i < pages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300))
        }
      }
    }

    // Update story document in Firestore with audio URLs
    try {
      const updateData: Record<string, any> = {
        audioGeneratedAt: new Date(),
        audioProvider: 'voicevox',
        audioVoice: voice,
      }

      if (results.fullAudio?.url) {
        updateData.fullAudioUrl = results.fullAudio.url
      }

      // Update pages with their audio URLs
      if (results.pageAudio.length > 0) {
        const pagesWithAudio = pages.map((page: any, index: number) => {
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
      } else if (results.errors.length > 0) {
        updateData.audioStatus = 'failed'
        updateData.audioError = results.errors.join('; ')
      }

      await adminFirestore!.collection('stories').doc(storyId).update(updateData)
      console.log(`[StoryAudio] Story ${storyId} updated with audio URLs`)
    } catch (saveError) {
      console.error('[StoryAudio] Failed to update Firestore:', saveError)
      results.errors.push(
        `Firestore update failed: ${saveError instanceof Error ? saveError.message : 'Unknown'}`
      )
    }

    return NextResponse.json({
      success: true,
      storyId,
      fullAudioUrl: results.fullAudio?.url,
      pageAudioCount: results.pageAudio.length,
      errors: results.errors,
      provider: 'voicevox',
      voice: voiceConfig.name,
    })
  } catch (error) {
    console.error('[StoryAudio] Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate audio',
      },
      { status: 500 }
    )
  }
}

/**
 * GET - List available voices
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    provider: 'voicevox',
    voices: Object.entries(VOICEVOX_VOICES).map(([key, config]) => ({
      id: key,
      voiceId: config.id,
      name: config.name,
      description: config.description,
      recommended: key === DEFAULT_VOICE,
    })),
    defaultVoice: DEFAULT_VOICE,
    features: [
      'High-quality Japanese TTS',
      'Multiple voice options',
      'FREE (Modal-hosted)',
      'Full story + per-page audio',
    ],
  })
}
