import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminFirestore } from '@/lib/firebase/admin'
import { adminStorage } from '@/lib/firebase/admin'

export const GET = withAdminAuth(async (_request: NextRequest, _context: AdminContext) => {
  try {
    if (!adminFirestore) {
      return NextResponse.json({ error: { message: 'Database not available' } }, { status: 503 })
    }

    const [transcriptSnap, wordExplSnap] = await Promise.all([
      adminFirestore.collection('transcriptCache').get(),
      adminFirestore.collection('youtube_word_explanations').get(),
    ])

    const wordExplMap = new Map<string, FirebaseFirestore.DocumentData>()
    wordExplSnap.forEach(doc => wordExplMap.set(doc.id, doc.data()))

    const transcripts = transcriptSnap.docs
      .filter(doc => doc.id.startsWith('youtube_'))
      .map(doc => {
        const data = doc.data()
        const contentId = doc.id
        const videoId = contentId.replace('youtube_', '')
        const wordData = wordExplMap.get(videoId)
        const transcript = Array.isArray(data.transcript) ? data.transcript : []

        return {
          videoId,
          contentId,
          videoTitle: data.videoTitle || data.title || data.metadata?.videoTitle || null,

          thumbnailUrl: data.metadata?.thumbnailUrl || null,
          videoUrl: data.videoUrl || null,
          segmentCount: transcript.length,
          hasTranslations: transcript.some((s: Record<string, unknown>) => !!s.translation),
          isOffloaded: !!data.transcriptStoragePath && transcript.length === 0,
          isFormatted: !!data.metadata?.wasFormatted || Array.isArray(data.formattedTranscript) && data.formattedTranscript.length > 0,
          formattingModel: data.metadata?.formattingModel || null,
          language: data.language || 'ja',

          accessCount: data.accessCount || 0,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
          lastAccessed: data.lastAccessed?.toDate?.()?.toISOString() || null,
          wordStatus: wordData?.precomputeStatus === 'completed'
            ? 'complete'
            : wordData?.precomputeStatus || 'none',
          wordCount: wordData?.wordCount || (Array.isArray(wordData?.words) ? wordData.words.length : 0),
          precomputeChunkTotal: wordData?.precomputeChunkTotal ?? null,
          precomputeChunkCompleted: wordData?.precomputeChunkCompleted ?? null,
        }
      })

    return NextResponse.json({ success: true, transcripts, count: transcripts.length })
  } catch (error) {
    console.error('[Admin YouTube Transcripts] GET error:', error)
    return NextResponse.json(
      { error: { message: 'Failed to fetch transcripts' } },
      { status: 500 }
    )
  }
})

export const DELETE = withAdminAuth(async (request: NextRequest, _context: AdminContext) => {
  try {
    if (!adminFirestore) {
      return NextResponse.json({ error: { message: 'Database not available' } }, { status: 503 })
    }

    const body = await request.json()
    const videoIds: string[] = body.videoIds

    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      return NextResponse.json(
        { error: { message: 'videoIds array is required' } },
        { status: 400 }
      )
    }

    let deletedTranscripts = 0
    let deletedWordExplanations = 0
    const errors: string[] = []

    // Process in batches of 250 (each transcript = up to 2 ops)
    const batchSize = 250
    for (let i = 0; i < videoIds.length; i += batchSize) {
      const chunk = videoIds.slice(i, i + batchSize)
      const batch = adminFirestore.batch()

      for (const videoId of chunk) {
        const contentId = `youtube_${videoId}`

        // Check for storage file before deleting doc
        try {
          const transcriptDoc = await adminFirestore.collection('transcriptCache').doc(contentId).get()
          if (transcriptDoc.exists) {
            const storagePath = transcriptDoc.data()?.transcriptStoragePath
            if (storagePath && adminStorage) {
              try {
                await adminStorage.bucket().file(storagePath).delete()
              } catch {
                // Storage file may not exist, continue
              }
            }
            batch.delete(adminFirestore.collection('transcriptCache').doc(contentId))
            deletedTranscripts++
          }
        } catch (err) {
          errors.push(`Failed to process transcript ${videoId}: ${err}`)
        }

        // Delete word explanations if they exist
        try {
          const wordDoc = await adminFirestore.collection('youtube_word_explanations').doc(videoId).get()
          if (wordDoc.exists) {
            batch.delete(adminFirestore.collection('youtube_word_explanations').doc(videoId))
            deletedWordExplanations++
          }
        } catch (err) {
          errors.push(`Failed to process word explanations ${videoId}: ${err}`)
        }
      }

      try {
        await batch.commit()
      } catch (err) {
        console.error('[Admin YouTube Transcripts] Batch delete error:', err)
        errors.push(`Batch commit failed: ${err}`)
      }
    }

    return NextResponse.json({
      success: true,
      deletedTranscripts,
      deletedWordExplanations,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('[Admin YouTube Transcripts] DELETE error:', error)
    return NextResponse.json(
      { error: { message: 'Failed to delete transcripts' } },
      { status: 500 }
    )
  }
})
