/**
 * Integrity Checker Stats API
 *
 * GET: Fetch integrity check statistics and logs
 * POST: Trigger a manual integrity check
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { getSession } from '@/lib/auth/session'

interface IntegrityLog {
  id: string
  type: 'scheduled' | 'manual'
  checkId?: string
  timestamp: string | null
  duration: number
  newsArticles?: {
    checked: number
    missingAudio: string[]
    missingTranslations: string[]
    missingWordExplanations: string[]
    failedAudio: string[]
    repaired: {
      audio: number
      translations: number
      wordExplanations: number
    }
    repairFailed: {
      audio: number
      translations: number
      wordExplanations: number
    }
  }
  stories?: {
    checked: number
    missingAudio: string[]
    missingImages: string[]
    stalledDrafts: string[]
    repaired: {
      audio: number
      images: number
    }
    repairFailed: {
      audio: number
      images: number
    }
  }
  triggeredBy?: string
  success?: boolean
  error?: string
}

interface IntegrityStats {
  totalChecks: number
  successfulChecks: number
  failedChecks: number
  repairSuccessRate: number
  currentQueueDepth: number
  lastRunTimestamp: string | null
  lastRunDuration: number
  trends: {
    date: string
    repairsSucceeded: number
    repairsFailed: number
    checksRun: number
  }[]
  contentBreakdown: {
    type: string
    missing: number
    repaired: number
  }[]
}

function calculateStats(logs: IntegrityLog[]): IntegrityStats {
  if (logs.length === 0) {
    return {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      repairSuccessRate: 0,
      currentQueueDepth: 0,
      lastRunTimestamp: null,
      lastRunDuration: 0,
      trends: [],
      contentBreakdown: [],
    }
  }

  // Sort by timestamp desc
  const sortedLogs = [...logs].sort((a, b) => {
    const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0
    const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0
    return dateB - dateA
  })

  const latestLog = sortedLogs[0]

  // Calculate totals
  let totalRepairsAttempted = 0
  let totalRepairsSucceeded = 0
  let successfulChecks = 0
  let failedChecks = 0

  // Track daily trends
  const dailyTrends = new Map<
    string,
    { repairsSucceeded: number; repairsFailed: number; checksRun: number }
  >()

  // Content breakdown totals
  const contentBreakdown = {
    audio: { missing: 0, repaired: 0 },
    translations: { missing: 0, repaired: 0 },
    wordExplanations: { missing: 0, repaired: 0 },
    storyAudio: { missing: 0, repaired: 0 },
    storyImages: { missing: 0, repaired: 0 },
  }

  for (const log of logs) {
    // Count successful vs failed checks
    if (log.success === false || log.error) {
      failedChecks++
    } else {
      successfulChecks++
    }

    // Get date for trends
    const date = log.timestamp ? log.timestamp.split('T')[0] : 'unknown'
    if (!dailyTrends.has(date)) {
      dailyTrends.set(date, { repairsSucceeded: 0, repairsFailed: 0, checksRun: 0 })
    }
    const dayStats = dailyTrends.get(date)!
    dayStats.checksRun++

    // News articles
    if (log.newsArticles) {
      const na = log.newsArticles
      const newsRepaired =
        (na.repaired?.audio || 0) +
        (na.repaired?.translations || 0) +
        (na.repaired?.wordExplanations || 0)
      const newsFailed =
        (na.repairFailed?.audio || 0) +
        (na.repairFailed?.translations || 0) +
        (na.repairFailed?.wordExplanations || 0)

      totalRepairsSucceeded += newsRepaired
      totalRepairsAttempted += newsRepaired + newsFailed

      dayStats.repairsSucceeded += newsRepaired
      dayStats.repairsFailed += newsFailed

      // Content breakdown
      contentBreakdown.audio.missing += na.missingAudio?.length || 0
      contentBreakdown.audio.repaired += na.repaired?.audio || 0
      contentBreakdown.translations.missing += na.missingTranslations?.length || 0
      contentBreakdown.translations.repaired += na.repaired?.translations || 0
      contentBreakdown.wordExplanations.missing += na.missingWordExplanations?.length || 0
      contentBreakdown.wordExplanations.repaired += na.repaired?.wordExplanations || 0
    }

    // Stories
    if (log.stories) {
      const st = log.stories
      const storyRepaired = (st.repaired?.audio || 0) + (st.repaired?.images || 0)
      const storyFailed = (st.repairFailed?.audio || 0) + (st.repairFailed?.images || 0)

      totalRepairsSucceeded += storyRepaired
      totalRepairsAttempted += storyRepaired + storyFailed

      dayStats.repairsSucceeded += storyRepaired
      dayStats.repairsFailed += storyFailed

      // Content breakdown
      contentBreakdown.storyAudio.missing += st.missingAudio?.length || 0
      contentBreakdown.storyAudio.repaired += st.repaired?.audio || 0
      contentBreakdown.storyImages.missing += st.missingImages?.length || 0
      contentBreakdown.storyImages.repaired += st.repaired?.images || 0
    }
  }

  // Calculate current queue depth from latest log
  let currentQueueDepth = 0
  if (latestLog.newsArticles) {
    currentQueueDepth +=
      (latestLog.newsArticles.missingAudio?.length || 0) +
      (latestLog.newsArticles.missingTranslations?.length || 0) +
      (latestLog.newsArticles.missingWordExplanations?.length || 0)
  }
  if (latestLog.stories) {
    currentQueueDepth +=
      (latestLog.stories.missingAudio?.length || 0) + (latestLog.stories.missingImages?.length || 0)
  }

  // Convert trends to sorted array
  const trends = Array.from(dailyTrends.entries())
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Convert content breakdown to array format
  const contentBreakdownArray = [
    {
      type: 'Article Audio',
      missing: contentBreakdown.audio.missing,
      repaired: contentBreakdown.audio.repaired,
    },
    {
      type: 'Translations',
      missing: contentBreakdown.translations.missing,
      repaired: contentBreakdown.translations.repaired,
    },
    {
      type: 'Word Explanations',
      missing: contentBreakdown.wordExplanations.missing,
      repaired: contentBreakdown.wordExplanations.repaired,
    },
    {
      type: 'Story Audio',
      missing: contentBreakdown.storyAudio.missing,
      repaired: contentBreakdown.storyAudio.repaired,
    },
    {
      type: 'Story Images',
      missing: contentBreakdown.storyImages.missing,
      repaired: contentBreakdown.storyImages.repaired,
    },
  ]

  return {
    totalChecks: logs.length,
    successfulChecks,
    failedChecks,
    repairSuccessRate:
      totalRepairsAttempted > 0 ? (totalRepairsSucceeded / totalRepairsAttempted) * 100 : 100,
    currentQueueDepth,
    lastRunTimestamp: latestLog.timestamp,
    lastRunDuration: latestLog.duration || 0,
    trends,
    contentBreakdown: contentBreakdownArray,
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check adminDb is initialized
    if (!adminDb) {
      return NextResponse.json({ success: false, error: 'Database not available' }, { status: 503 })
    }

    // Get query params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const type = searchParams.get('type') // 'scheduled', 'manual', or null for all
    const days = parseInt(searchParams.get('days') || '7')

    // Calculate date range
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Build query
    const collectionRef = adminDb.collection('integrity_check_logs')
    let snapshot

    if (type && (type === 'scheduled' || type === 'manual')) {
      // Filter by type - simple query without compound index
      snapshot = await collectionRef
        .where('type', '==', type)
        .limit(limit * 2)
        .get()
    } else {
      snapshot = await collectionRef.orderBy('createdAt', 'desc').limit(limit).get()
    }

    // Process logs
    let logs: IntegrityLog[] = snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        type: data.type || 'scheduled',
        checkId: data.checkId,
        timestamp: data.timestamp || data.createdAt?.toDate?.()?.toISOString() || null,
        duration: data.duration || 0,
        newsArticles: data.newsArticles,
        stories: data.stories,
        triggeredBy: data.triggeredBy,
        success: data.success,
        error: data.error,
      }
    })

    // Sort by timestamp desc in memory if we filtered by type
    if (type) {
      logs = logs
        .sort((a, b) => {
          const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0
          const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0
          return dateB - dateA
        })
        .slice(0, limit)
    }

    // Calculate statistics
    const stats = calculateStats(logs)

    return NextResponse.json({
      success: true,
      stats,
      logs,
      count: logs.length,
    })
  } catch (error) {
    console.error('Error fetching integrity stats:', error)
    return NextResponse.json({
      success: true,
      stats: calculateStats([]),
      logs: [],
      count: 0,
      message: 'No logs found or collection does not exist yet',
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check adminDb is initialized
    if (!adminDb) {
      return NextResponse.json({ success: false, error: 'Database not available' }, { status: 503 })
    }

    // Verify admin authentication
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const userDoc = await adminDb.collection('users').doc(session.uid).get()
    const userData = userDoc.data()
    const isAdmin = userData?.role === 'admin' || userData?.isAdmin === true

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    // Call the Firebase Cloud Function
    const functionsUrl =
      process.env.FIREBASE_FUNCTIONS_URL ||
      'https://us-central1-moshimoshi-de237.cloudfunctions.net'
    const adminKey = process.env.INTEGRITY_CHECKER_ADMIN_KEY || 'integrity-checker-2025'

    const response = await fetch(`${functionsUrl}/manualIntegrityCheckerFunction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          adminKey,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to trigger integrity check:', response.status, errorText)
      return NextResponse.json(
        {
          success: false,
          error: `Failed to trigger integrity check: ${response.status}`,
          details: errorText,
        },
        { status: response.status }
      )
    }

    const result = await response.json()

    return NextResponse.json({
      success: true,
      message: 'Integrity check triggered successfully',
      result: result.result,
    })
  } catch (error) {
    console.error('Error triggering integrity check:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to trigger integrity check',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
