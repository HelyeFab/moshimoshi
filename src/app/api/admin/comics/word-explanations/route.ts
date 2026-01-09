/**
 * Comic Word Explanations API
 *
 * Generates comprehensive word explanations for a published comic episode
 * Stores in comic_word_explanations collection for instant user lookups
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore, initAdmin } from '@/lib/firebase/admin'
import { precomputeWordExplanations } from '@/lib/ai/precompute/wordPrecompute'

// Initialize Firebase Admin
initAdmin()

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    // Check for admin key authentication
    const adminKey = request.headers.get('X-Admin-Key')
    // Use same fallback pattern as other comic routes
    const expectedAdminKey = process.env.COMIC_SCHEDULER_ADMIN_KEY || 'comic-scheduler-2025'

    let userId: string

    if (adminKey) {
      // Admin key provided - validate it
      if (adminKey !== expectedAdminKey) {
        return NextResponse.json({ error: 'Invalid admin key' }, { status: 401 })
      }
      userId = 'comic-scheduler'
    } else {
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

      userId = session.uid
    }

    const body = await request.json()
    const { episodeId, jlptLevel } = body

    if (!episodeId) {
      return NextResponse.json({ error: 'episodeId is required' }, { status: 400 })
    }

    console.log('[WordExplanations] Generating for episode:', episodeId)

    // Get the published episode
    const episodeDoc = await adminFirestore!.collection('comics').doc(episodeId).get()
    if (!episodeDoc.exists) {
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 })
    }

    const episode = episodeDoc.data()!

    // Validate episode has panels
    if (!episode.panels || episode.panels.length === 0) {
      return NextResponse.json({ error: 'Episode has no panels' }, { status: 400 })
    }

    // Extract text from panels (dialogues + narration)
    // Pattern from backfill-word-explanations.ts:126-140
    const text = episode.panels
      .flatMap((panel: any) => {
        const texts: string[] = []

        // Extract narration
        if (panel.narration?.textJa) {
          texts.push(panel.narration.textJa)
        }

        // Extract dialogues
        if (Array.isArray(panel.dialogues)) {
          texts.push(
            ...panel.dialogues
              .map((d: any) => d.textJa)
              .filter(Boolean)
          )
        }

        return texts
      })
      .filter(Boolean)
      .join(' ')

    // Validate we have text
    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'No text content found in episode panels' },
        { status: 400 }
      )
    }

    // Guard against excessively long text
    if (text.length > 20000) {
      return NextResponse.json(
        { error: 'Text content exceeds maximum length (20k characters)' },
        { status: 400 }
      )
    }

    console.log('[WordExplanations] Extracted text:', {
      episodeId,
      textLength: text.length,
      panelCount: episode.panels.length,
    })

    // Generate word explanations using the modern precompute system
    const result = await precomputeWordExplanations({
      contentId: episodeId,
      contentType: 'comic',
      text,
      limit: 1000,
      jlptLevel: jlptLevel || 'N5',
    })

    console.log('[WordExplanations] Generation complete:', {
      episodeId,
      generated: result.generated,
      cached: result.cached,
      skipped: result.skipped,
      total: result.total,
    })

    return NextResponse.json({
      success: true,
      episodeId,
      generated: result.generated,
      cached: result.cached,
      skipped: result.skipped,
      total: result.total,
    })
  } catch (error) {
    console.error('[WordExplanations] Generation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Word explanation generation failed'
      },
      { status: 500 }
    )
  }
}
