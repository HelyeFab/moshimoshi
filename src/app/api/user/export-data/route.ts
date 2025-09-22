// GDPR Data Export API Route
// Handles user data export requests for GDPR compliance

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { logAuditEvent, AuditEvent } from '@/lib/auth/audit'
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'
import { redis, RedisKeys, CacheTTL } from '@/lib/redis/client'
import { checkApiRateLimit } from '@/lib/auth/rateLimit'

export interface UserDataExport {
  exportId: string
  userId: string
  requestedAt: string
  exportedAt: string
  personalData: {
    profile: {
      uid: string
      email: string
      displayName: string | null
      preferredLanguage: string
      studyGoal: string
      studyTime: string
      createdAt: string
      lastActiveAt: string
      notifications: Record<string, boolean>
      privacy: Record<string, boolean>
    }
    subscription: {
      tier: string
      status: string | null
      subscriptionId: string | null
      customerId: string | null
      currentPeriodStart: string | null
      currentPeriodEnd: string | null
    } | null
    progress: Array<{
      lessonId: string
      completedAt: string
      score: number
      timeSpent: number
      attempts: number
    }>
    stats: {
      totalStudyTime: number
      lessonsCompleted: number
      streakDays: number
      lastStudyDate: string | null
      averageScore: number
      totalSessions: number
    }
  }
  technicalData: {
    sessions: Array<{
      sessionId: string
      createdAt: string
      ipAddress: string
      userAgent: string
      lastActivity: string
    }>
    auditLogs: Array<{
      timestamp: string
      action: string
      resource: string
      ipAddress: string
      details: Record<string, any>
    }>
  }
}

/**
 * POST /api/user/export-data
 * Request GDPR data export
 */
export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized()
    const session = await requireAuth()

    // Check rate limiting - more restrictive for data exports
    const rateLimitResult = await checkApiRateLimit(request, session.uid)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: rateLimitResult.message,
          },
        },
        { status: 429 }
      )
    }

    // Check if there's already a recent export request
    const recentExportKey = RedisKeys.userProfile(`export_request:${session.uid}`)
    const recentExport = await redis.get(recentExportKey)
    
    if (recentExport) {
      return NextResponse.json(
        {
          error: {
            code: 'EXPORT_IN_PROGRESS',
            message: 'Data export request already in progress. Please wait before requesting another export.',
          },
        },
        { status: 429 }
      )
    }

    // Generate export ID
    const exportId = `export_${session.uid}_${Date.now()}`
    
    // Mark export as in progress (prevent duplicate requests)
    await redis.setex(recentExportKey, 24 * 60 * 60, exportId) // 24 hours

    // Start building the export data
    const exportData: UserDataExport = {
      exportId,
      userId: session.uid,
      requestedAt: new Date().toISOString(),
      exportedAt: new Date().toISOString(),
      personalData: {
        profile: {} as any,
        subscription: null,
        progress: [],
        stats: {} as any,
      },
      technicalData: {
        sessions: [],
        auditLogs: [],
      },
    }

    // Fetch user profile data
    const profileDoc = await adminFirestore!
      .collection('users')
      .doc(session.uid)
      .get()

    if (profileDoc.exists) {
      const profileData = profileDoc.data()!
      exportData.personalData.profile = {
        uid: session.uid,
        email: session.email,
        displayName: profileData.displayName || null,
        preferredLanguage: profileData.preferredLanguage || 'en',
        studyGoal: profileData.studyGoal || 'casual',
        studyTime: profileData.studyTime || '30min',
        createdAt: profileData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        lastActiveAt: profileData.lastActiveAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        notifications: profileData.notifications || {},
        privacy: profileData.privacy || {},
      }

      exportData.personalData.stats = {
        totalStudyTime: profileData.stats?.totalStudyTime || 0,
        lessonsCompleted: profileData.stats?.lessonsCompleted || 0,
        streakDays: profileData.stats?.streakDays || 0,
        lastStudyDate: profileData.stats?.lastStudyDate?.toDate?.()?.toISOString() || null,
        averageScore: profileData.stats?.averageScore || 0,
        totalSessions: profileData.stats?.totalSessions || 0,
      }
    }

    // Fetch subscription data
    try {
      const subscriptionDoc = await adminFirestore!
        .collection('subscriptions')
        .doc(session.uid)
        .get()

      if (subscriptionDoc.exists) {
        const subData = subscriptionDoc.data()!
        exportData.personalData.subscription = {
          tier: session.tier,
          status: subData.status || null,
          subscriptionId: subData.subscriptionId || null,
          customerId: subData.customerId || null,
          currentPeriodStart: subData.currentPeriodStart?.toDate?.()?.toISOString() || null,
          currentPeriodEnd: subData.currentPeriodEnd?.toDate?.()?.toISOString() || null,
        }
      }
    } catch (error) {
      console.warn('Could not fetch subscription data:', error)
    }

    // Fetch lesson progress
    try {
      const progressQuery = await adminFirestore!
        .collection('progress')
        .where('userId', '==', session.uid)
        .limit(1000) // Reasonable limit
        .get()

      exportData.personalData.progress = progressQuery.docs.map(doc => {
        const data = doc.data()
        return {
          lessonId: data.lessonId,
          completedAt: data.completedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          score: data.score || 0,
          timeSpent: data.timeSpent || 0,
          attempts: data.attempts || 1,
        }
      })
    } catch (error) {
      console.warn('Could not fetch progress data:', error)
    }

    // Fetch recent audit logs (last 90 days for privacy)
    try {
      const auditQuery = await adminFirestore!
        .collection('audit_logs')
        .where('userId', '==', session.uid)
        .where('timestamp', '>=', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)) // 90 days
        .orderBy('timestamp', 'desc')
        .limit(500) // Reasonable limit
        .get()

      exportData.technicalData.auditLogs = auditQuery.docs.map(doc => {
        const data = doc.data()
        return {
          timestamp: data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
          action: data.action,
          resource: data.resource,
          ipAddress: data.details?.ipAddress || 'unknown',
          details: {
            ...data.details,
            // Remove sensitive data
            sessionId: undefined,
            fingerprint: undefined,
          },
        }
      })
    } catch (error) {
      console.warn('Could not fetch audit logs:', error)
    }

    // For sessions, we can only get current session info since we don't store historical sessions
    exportData.technicalData.sessions = [{
      sessionId: session.sessionId,
      createdAt: new Date().toISOString(),
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      lastActivity: new Date().toISOString(),
    }]

    // Store export data temporarily for download
    const exportKey = `user_export:${exportId}`
    await redis.setex(exportKey, 7 * 24 * 60 * 60, JSON.stringify(exportData)) // 7 days

    // Log audit event
    await logAuditEvent(
      AuditEvent.ADMIN_DATA_EXPORT,
      {
        userId: session.uid,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        endpoint: '/api/user/export-data',
      },
      {
        exportId,
        action: 'data_export_requested',
        dataTypes: [
          'profile',
          'subscription',
          'progress',
          'stats',
          'audit_logs',
          'sessions',
        ],
      },
      'success'
    )

    return NextResponse.json({
      success: true,
      data: {
        exportId,
        requestedAt: exportData.requestedAt,
        downloadUrl: `/api/user/export-data/${exportId}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        message: 'Your data export has been prepared and is ready for download.',
      },
    })

  } catch (error) {
    console.error('Error creating data export:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create data export',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/user/export-data/:exportId
 * Download GDPR data export
 */
export async function GET(request: NextRequest) {
  try {
    ensureAdminInitialized()
    const session = await requireAuth()

    // Extract export ID from URL
    const url = new URL(request.url)
    const exportId = url.pathname.split('/').pop()

    if (!exportId || !exportId.startsWith(`export_${session.uid}_`)) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_EXPORT_ID',
            message: 'Invalid or unauthorized export request',
          },
        },
        { status: 403 }
      )
    }

    // Get export data from cache
    const exportKey = `user_export:${exportId}`
    const exportDataStr = await redis.get(exportKey)

    if (!exportDataStr) {
      return NextResponse.json(
        {
          error: {
            code: 'EXPORT_NOT_FOUND',
            message: 'Export not found or has expired',
          },
        },
        { status: 404 }
      )
    }

    const exportData: UserDataExport = JSON.parse(exportDataStr as string)

    // Log audit event for download
    await logAuditEvent(
      AuditEvent.ADMIN_DATA_EXPORT,
      {
        userId: session.uid,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        endpoint: '/api/user/export-data',
      },
      {
        exportId,
        action: 'data_export_downloaded',
      },
      'success'
    )

    // Return data as downloadable JSON
    const filename = `moshimoshi-data-export-${session.uid}-${new Date().toISOString().split('T')[0]}.json`
    
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': Buffer.byteLength(JSON.stringify(exportData, null, 2)).toString(),
      },
    })

  } catch (error) {
    console.error('Error downloading data export:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to download data export',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS /api/user/export-data
 * Handle preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}