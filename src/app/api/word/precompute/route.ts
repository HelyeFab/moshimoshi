import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { precomputeWordExplanations } from '@/lib/ai/precompute/wordPrecompute'
import { getAdminDb, Timestamp, FieldValue } from '@/lib/firebase/admin'
import { transcriptCache } from '@/lib/transcript/cache'
import crypto from 'crypto'

export const runtime = 'nodejs'
const PRECOMPUTE_VERSION = 'v2_all_tokens'

async function fetchContentText(
  db: ReturnType<typeof getAdminDb>,
  contentType: string,
  contentId: string
): Promise<string | null> {
  if (!db) return null

  if (contentType === 'story') {
    const doc = await db.collection('stories').doc(contentId).get()
    if (!doc.exists) return null
    const data = doc.data()
    if (data?.status && data.status !== 'published') return null
    const pages = Array.isArray(data?.pages) ? data.pages : []
    const text = pages.map((page: any) => page?.text || '').filter(Boolean).join(' ')
    return text.trim() ? text : null
  }

  if (contentType === 'article') {
    const doc = await db.collection('news_articles').doc(contentId).get()
    if (!doc.exists) return null
    const data = doc.data()
    const text = typeof data?.content === 'string' ? data.content : ''
    return text.trim() ? text : null
  }

  if (contentType === 'comic') {
    const doc = await db.collection('comics').doc(contentId).get()
    if (!doc.exists) return null
    const data = doc.data()
    if (data?.status && data.status !== 'published') return null
    const panels = Array.isArray(data?.panels) ? data.panels : []
    const panelText = panels
      .map((panel: any) => {
        const dialogueText = Array.isArray(panel?.dialogues)
          ? panel.dialogues.map((d: any) => d?.textJa || '').filter(Boolean).join(' ')
          : ''
        const narrationText = panel?.narration?.textJa || ''
        return [dialogueText, narrationText].filter(Boolean).join(' ')
      })
      .filter(Boolean)
      .join(' ')
    const vocabExamples = Array.isArray(data?.vocabulary)
      ? data.vocabulary
          .map((v: any) => v?.exampleFromComic || v?.word || '')
          .filter(Boolean)
          .join(' ')
      : ''
    const text = [panelText, vocabExamples].filter(Boolean).join(' ')
    return text.trim() ? text : null
  }

  if (contentType === 'youtube') {
    const transcriptId = contentId.startsWith('youtube_') ? contentId : `youtube_${contentId}`
    const cached = await transcriptCache.get(transcriptId)
    if (!cached) return null
    const transcript = Array.isArray(cached.formattedTranscript)
      ? cached.formattedTranscript
      : Array.isArray(cached.transcript)
        ? cached.transcript
        : []
    const text = transcript
      .map((line: any) => line?.text || '')
      .filter(Boolean)
      .join(' ')
    return text.trim() ? text : null
  }

  return null
}

export async function POST(request: NextRequest) {
  let contentId: string | undefined
  let contentType: string | undefined
  let includeParticles: boolean | undefined
  let minLength: number | undefined
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ success: false, error: 'UNAUTHENTICATED' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const {
      contentId: bodyContentId,
      contentType: bodyContentType,
      text,
      limit,
      chunkIndex,
      includeParticles: bodyIncludeParticles,
      minLength: bodyMinLength,
      allowWhileGenerating,
      fetchContent,
      background,
      totalChunks,
    } = body || {}
    contentId = bodyContentId
    contentType = bodyContentType
    includeParticles = bodyIncludeParticles
    minLength = bodyMinLength
    const allowWhileGeneratingEffective =
      allowWhileGenerating === true || (contentType === 'youtube' && fetchContent === true)

    if (!contentId || !contentType) {
      return NextResponse.json(
        { success: false, error: 'contentId and contentType are required' },
        { status: 400 }
      )
    }

    const collectionMap: Record<string, string> = {
      article: 'news_article_word_explanations',
      book: 'book_word_explanations',
      story: 'story_word_explanations',
      youtube: 'youtube_word_explanations',
      video: 'video_word_explanations',
      comic: 'comic_word_explanations',
    }
    const collection = collectionMap[contentType]
    if (!collection) {
      return NextResponse.json(
        { success: false, error: 'unsupported contentType' },
        { status: 400 }
      )
    }

    const db = getAdminDb()
    const docRef = db.collection(collection).doc(contentId)
    const lockId = crypto.randomUUID()
    const lockTtlMs = 30 * 60 * 1000
    const now = Timestamp.now()

    const lockResult = await db.runTransaction(async tx => {
      const snap = await tx.get(docRef)
      const data = snap.exists ? snap.data() : undefined
      const status = data?.precomputeStatus
      const startedAt = data?.precomputeStartedAt?.toDate?.()
      const isFresh =
        status === 'generating' &&
        startedAt &&
        Date.now() - startedAt.getTime() < lockTtlMs

      if (isFresh && !allowWhileGeneratingEffective) {
        return { allowed: false, reason: 'locked' }
      }

      // Skip if already complete, unless allowWhileGenerating (for background batches adding more words)
      if (
        !isFresh &&
        status === 'complete' &&
        data?.words?.length &&
        data?.precomputeVersion === PRECOMPUTE_VERSION &&
        !allowWhileGeneratingEffective
      ) {
        return { allowed: false, reason: 'complete' }
      }

      if (!isFresh) {
        tx.set(
          docRef,
          {
            precomputeStatus: 'generating',
            precomputeStartedAt: now,
            precomputeLockId: lockId,
            precomputeUpdatedAt: now,
            precomputeVersion: PRECOMPUTE_VERSION,
            ...(typeof totalChunks === 'number' ? { precomputeChunkTotal: totalChunks } : {}),
            ...(typeof chunkIndex === 'number' ? { precomputeChunkIndex: chunkIndex } : {}),
            precomputeOptions: {
              includeParticles: includeParticles === true,
              minLength: typeof minLength === 'number' ? minLength : undefined,
            },
          },
          { merge: true }
        )
      } else if (allowWhileGeneratingEffective && (typeof chunkIndex === 'number' || typeof totalChunks === 'number')) {
        tx.set(
          docRef,
          {
            precomputeUpdatedAt: now,
            ...(typeof totalChunks === 'number' ? { precomputeChunkTotal: totalChunks } : {}),
            ...(typeof chunkIndex === 'number' ? { precomputeChunkIndex: chunkIndex } : {}),
          },
          { merge: true }
        )
      }

      return { allowed: true }
    })

    if (!lockResult.allowed) {
      return NextResponse.json({
        success: true,
        skipped: lockResult.reason,
      })
    }

    let resolvedText = text
    if (!resolvedText && fetchContent === true) {
      resolvedText = await fetchContentText(db, contentType, contentId)
      if (!resolvedText) {
        return NextResponse.json(
          { success: false, error: 'content text not found' },
          { status: 404 }
        )
      }
    }

    if (typeof resolvedText !== 'string' || resolvedText.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'text must be a non-empty string' },
        { status: 400 }
      )
    }

    // Guard against extremely large payloads
    if (resolvedText.length > 20000) {
      return NextResponse.json(
        { success: false, error: 'text too large (max 20k characters)' },
        { status: 400 }
      )
    }

    const runPrecompute = async () => {
      const result = await precomputeWordExplanations({
        contentId,
        contentType,
        text: resolvedText,
        limit: typeof limit === 'number' ? Math.min(Math.max(limit, 10), 1000) : undefined, // Increased from 400 to 1000
        includeParticles: includeParticles === true,
        minLength: typeof minLength === 'number' ? minLength : undefined,
        chunkIndex: typeof chunkIndex === 'number' ? chunkIndex : undefined,
        db,
      } as any)

      await docRef.set(
        {
          precomputeStatus: 'complete',
          precomputeCompletedAt: Timestamp.now(),
          precomputeUpdatedAt: Timestamp.now(),
          precomputeVersion: PRECOMPUTE_VERSION,
          ...(typeof chunkIndex === 'number' ? { precomputeChunkLastCompletedIndex: chunkIndex } : {}),
          precomputeChunkCompleted: FieldValue.increment(1),
          precomputeOptions: {
            includeParticles: includeParticles === true,
            minLength: typeof minLength === 'number' ? minLength : undefined,
          },
        },
        { merge: true }
      )

      return result
    }

    if (background === true) {
      // Best-effort fire-and-forget in dev; for production consider a job queue.
      runPrecompute().catch(() => {})
      return NextResponse.json({ success: true, queued: true }, { status: 202 })
    }

    const result = await runPrecompute()
    return NextResponse.json({ success: true, result })
  } catch (error) {
    if (contentId && contentType) {
      try {
        const collectionMap: Record<string, string> = {
          article: 'news_article_word_explanations',
          book: 'book_word_explanations',
          story: 'story_word_explanations',
          youtube: 'youtube_word_explanations',
          video: 'video_word_explanations',
          comic: 'comic_word_explanations',
        }
        const collection = collectionMap[contentType]
        if (collection) {
          const db = getAdminDb()
          await db.collection(collection).doc(contentId).set(
            {
              precomputeStatus: 'failed',
              precomputeError: error instanceof Error ? error.message : String(error),
              precomputeUpdatedAt: Timestamp.now(),
              precomputeVersion: PRECOMPUTE_VERSION,
              precomputeOptions: {
                includeParticles: includeParticles === true,
                minLength: typeof minLength === 'number' ? minLength : undefined,
              },
            },
            { merge: true }
          )
        }
      } catch {
        // ignore secondary error
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : String(error),
        stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
