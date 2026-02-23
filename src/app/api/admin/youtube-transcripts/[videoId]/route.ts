import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminFirestore, adminStorage } from '@/lib/firebase/admin'

export const GET = withAdminAuth(async (_request: NextRequest, context: AdminContext) => {
  try {
    if (!adminFirestore) {
      return NextResponse.json({ error: { message: 'Database not available' } }, { status: 503 })
    }

    const videoId = context.params?.videoId
    if (!videoId) {
      return NextResponse.json({ error: { message: 'Video ID is required' } }, { status: 400 })
    }

    const contentId = `youtube_${videoId}`

    const [transcriptDoc, wordDoc] = await Promise.all([
      adminFirestore.collection('transcriptCache').doc(contentId).get(),
      adminFirestore.collection('youtube_word_explanations').doc(videoId).get(),
    ])

    if (!transcriptDoc.exists) {
      return NextResponse.json({ error: { message: 'Transcript not found' } }, { status: 404 })
    }

    const data = transcriptDoc.data()!
    let transcript = Array.isArray(data.transcript) ? data.transcript : []

    // Load from storage if offloaded
    if (data.transcriptStoragePath && transcript.length === 0 && adminStorage) {
      try {
        const file = adminStorage.bucket().file(data.transcriptStoragePath)
        const [exists] = await file.exists()
        if (exists) {
          const [buffer] = await file.download()
          const parsed = JSON.parse(buffer.toString('utf8'))
          transcript = Array.isArray(parsed.transcript) ? parsed.transcript : []
        }
      } catch (err) {
        console.error('[Admin YouTube Transcripts] Storage read error:', err)
      }
    }

    const wordData = wordDoc.exists ? wordDoc.data()! : null

    const result = {
      videoId,
      contentId,
      videoTitle: data.videoTitle || data.title || data.metadata?.videoTitle || null,

      thumbnailUrl: data.metadata?.thumbnailUrl || null,
      videoUrl: data.videoUrl || null,
      language: data.language || 'ja',

      accessCount: data.accessCount || 0,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      lastAccessed: data.lastAccessed?.toDate?.()?.toISOString() || null,
      isOffloaded: !!data.transcriptStoragePath,
      storagePath: data.transcriptStoragePath || null,
      isFormatted: !!data.metadata?.wasFormatted || (Array.isArray(data.formattedTranscript) && data.formattedTranscript.length > 0),
      formattingModel: data.metadata?.formattingModel || null,
      formattedAt: data.metadata?.formattedAt?.toDate?.()?.toISOString() || null,
      segmentCount: transcript.length,
      hasTranslations: transcript.some((s: Record<string, unknown>) => !!s.translation),
      segments: transcript.map((s: Record<string, unknown>) => ({
        text: s.text,
        startTime: s.startTime,
        endTime: s.endTime,
        translation: s.translation || null,
      })),
      // Word explanation data
      wordStatus: wordData
        ? (wordData.precomputeStatus === 'completed' ? 'complete' : wordData.precomputeStatus)
        : 'none',
      wordCount: wordData?.wordCount || (Array.isArray(wordData?.words) ? wordData.words.length : 0),
      precomputeChunkTotal: wordData?.precomputeChunkTotal ?? null,
      precomputeChunkCompleted: wordData?.precomputeChunkCompleted ?? null,
      wordStartedAt: wordData?.precomputeStartedAt?.toDate?.()?.toISOString() || null,
      wordCompletedAt: wordData?.precomputeCompletedAt?.toDate?.()?.toISOString() || null,
    }

    return NextResponse.json({ success: true, transcript: result })
  } catch (error) {
    console.error('[Admin YouTube Transcripts] GET detail error:', error)
    return NextResponse.json(
      { error: { message: 'Failed to fetch transcript details' } },
      { status: 500 }
    )
  }
})

export const PUT = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
  try {
    if (!adminFirestore) {
      return NextResponse.json({ error: { message: 'Database not available' } }, { status: 503 })
    }

    const videoId = context.params?.videoId
    if (!videoId) {
      return NextResponse.json({ error: { message: 'Video ID is required' } }, { status: 400 })
    }

    const body = await request.json()

    if (body.action === 'resetWordGeneration') {
      const wordDoc = await adminFirestore.collection('youtube_word_explanations').doc(videoId).get()
      if (!wordDoc.exists) {
        return NextResponse.json(
          { error: { message: 'Word explanation document not found' } },
          { status: 404 }
        )
      }

      await adminFirestore.collection('youtube_word_explanations').doc(videoId).update({
        precomputeStatus: 'pending',
        precomputeStartedAt: null,
        precomputeCompletedAt: null,
        precomputeChunkCompleted: 0,
        precomputeChunkIndex: 0,
      })

      return NextResponse.json({ success: true, message: 'Word generation reset to pending' })
    }

    return NextResponse.json(
      { error: { message: 'Unknown action' } },
      { status: 400 }
    )
  } catch (error) {
    console.error('[Admin YouTube Transcripts] PUT error:', error)
    return NextResponse.json(
      { error: { message: 'Failed to update transcript' } },
      { status: 500 }
    )
  }
})
