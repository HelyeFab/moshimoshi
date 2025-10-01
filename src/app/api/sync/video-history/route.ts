/**
 * Video History Sync API
 * Server-side endpoint for syncing video history to Firebase
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { videoHistoryService } from '@/services/videoHistory'
import logger from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Force sync video history to Firebase
    await videoHistoryService.forceSyncToFirebase()

    logger.info(`[Video History Sync] Successfully synced for user ${session.uid}`)

    return NextResponse.json({
      success: true,
      message: 'Video history synced successfully'
    })

  } catch (error) {
    logger.error('[Video History Sync] Error:', error)
    return NextResponse.json(
      { error: 'Failed to sync video history' },
      { status: 500 }
    )
  }
}
