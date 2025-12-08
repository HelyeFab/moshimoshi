/**
 * Integrity Checker Status API
 *
 * GET: Get current running check status (for real-time polling)
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'

interface RunningCheckStatus {
  isRunning: boolean
  checkId?: string
  type?: 'scheduled' | 'manual'
  progress?: string
  progressDetails?: {
    current?: number
    total?: number
    stage?: string
  } | null
  startedAt?: string
  elapsedSeconds?: number
  triggeredBy?: string
}

// Progress labels for UI display
const progressLabels: Record<string, string> = {
  starting: 'Starting check...',
  checking_articles: 'Checking news articles...',
  repairing_article_audio: 'Repairing article audio...',
  repairing_translations: 'Repairing translations...',
  repairing_word_explanations: 'Repairing word explanations...',
  checking_stories: 'Checking stories...',
  repairing_story_audio: 'Repairing story audio...',
  repairing_story_images: 'Repairing story images...',
  cleanup: 'Cleaning up...',
}

export async function GET(request: NextRequest) {
  try {
    // Check adminDb is initialized
    if (!adminDb) {
      return NextResponse.json(
        { isRunning: false, error: 'Database not available' },
        { status: 503 }
      )
    }

    // Query for in-progress checks
    const snapshot = await adminDb
      .collection('ops')
      .doc('integrity')
      .collection('processed_checks')
      .where('status', '==', 'in_progress')
      .limit(1)
      .get()

    if (snapshot.empty) {
      return NextResponse.json({ isRunning: false })
    }

    const doc = snapshot.docs[0]
    const data = doc.data()

    // Calculate elapsed time
    const startedAt = data.processedAt?.toDate?.() || new Date()
    const elapsedMs = Date.now() - startedAt.getTime()
    const elapsedSeconds = Math.floor(elapsedMs / 1000)

    // Build progress display text
    const progressKey = data.progress || 'starting'
    const progressLabel = progressLabels[progressKey] || progressKey
    let progressText = progressLabel

    // Add details if available
    if (data.progressDetails) {
      if (data.progressDetails.current !== undefined && data.progressDetails.total !== undefined) {
        progressText += ` (${data.progressDetails.current}/${data.progressDetails.total})`
      } else if (data.progressDetails.stage) {
        progressText += ` - ${data.progressDetails.stage}`
      } else if (data.progressDetails.total !== undefined) {
        progressText += ` (${data.progressDetails.total} items)`
      }
    }

    const status: RunningCheckStatus = {
      isRunning: true,
      checkId: doc.id,
      type: data.type,
      progress: progressKey,
      progressDetails: data.progressDetails || null,
      startedAt: startedAt.toISOString(),
      elapsedSeconds,
      triggeredBy: data.triggeredBy,
    }

    return NextResponse.json({
      ...status,
      progressText,
      progressLabel,
    })
  } catch (error) {
    console.error('Error fetching integrity status:', error)
    return NextResponse.json({
      isRunning: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
